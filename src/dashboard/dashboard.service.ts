/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SensorReading } from '../sensor-reading/entities/sensor-reading.entity';
import { Sensor, SensorType } from '../sensor/entities/sensor.entity';
import { Device } from '../device/entities/device.entity';
import { Farm } from '../farm/entities/farm.entity';
import { SensorThresholdService } from '../sensor-threshold/sensor-threshold.service';
import {
  ThresholdRange,
  SensorTypeData,
  DashboardSummary,
  SensorChartData,
  RealtimeDataPoint
} from './types/dashboard.types';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(SensorReading)
    private readonly sensorReadingRepository: Repository<SensorReading>,
    private readonly sensorThresholdService: SensorThresholdService,
  ) { }

  async getDashboardSummary(farmId: string): Promise<DashboardSummary> {
    // Verify farm exists
    const farm = await this.farmRepository.findOne({
      where: { id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID "${farmId}" not found`);
    }

    // Get all devices for this farm
    const devices = await this.deviceRepository.find({
      where: { farmId, isActive: true },
    });

    if (devices.length === 0) {
      return {
        latestTimestamp: null,
        averages: {},
        activeSensorsCount: 0,
      };
    }

    const deviceIds = devices.map((device) => device.id);

    // Get all active sensors for these devices
    const sensors = await this.sensorRepository.find({
      where: { deviceId: In(deviceIds), isActive: true },
    });

    if (sensors.length === 0) {
      return {
        latestTimestamp: null,
        averages: {},
        activeSensorsCount: 0,
      };
    }

    const sensorIds = sensors.map((sensor) => sensor.id);

    // Get the latest timestamp across all readings
    const latestReadingResult = await this.sensorReadingRepository
      .createQueryBuilder('reading')
      .select('MAX(reading.timestamp)', 'latestTimestamp')
      .where('reading.sensorId IN (:...sensorIds)', { sensorIds })
      .getRawOne();

    // Get latest values for each sensor to calculate averages by type
    const latestReadings = await this.getLatestReadingsForSensors(sensorIds);

    // Get thresholds for the farm
    const thresholds = await this.sensorThresholdService.getThresholdsByFarm(farmId);
    const thresholdsByType = this.groupThresholdsBySensorType(thresholds);

    // Use the enhanced method with proper threshold integration
    const averagesByType = await this.calculateAverageByTypeWithSeverity(
      sensors,
      latestReadings,
      thresholdsByType
    );

    return {
      latestTimestamp: latestReadingResult?.latestTimestamp || null,
      averages: averagesByType,
      activeSensorsCount: sensors.length,
      thresholds: thresholdsByType
    };
  }

  // Enhanced method with proper TypeScript typing
  private async calculateAverageByTypeWithSeverity(
    sensors: Sensor[],
    readings: Record<string, SensorReading>,
    thresholdsByType: Record<string, any[]>
  ): Promise<Record<string, SensorTypeData>> {
    const sensorsByType = sensors.reduce(
      (acc, sensor) => {
        if (!acc[sensor.type]) {
          acc[sensor.type] = [];
        }
        acc[sensor.type].push(sensor);
        return acc;
      },
      {} as Record<string, Sensor[]>,
    );

    const averagesByType: Record<string, SensorTypeData> = {};

    for (const [type, sensorsOfType] of Object.entries(sensorsByType)) {
      let sum = 0;
      let count = 0;
      let unit = '';
      const values: number[] = [];
      let latestReading: SensorReading | null = null;
      let latestTimestamp: Date | null = null;

      // Calculate average and collect values
      for (const sensor of sensorsOfType) {
        const reading = readings[sensor.id];
        if (reading) {
          sum += reading.value;
          count++;
          values.push(reading.value);
          if (!unit && sensor.unit) {
            unit = sensor.unit;
          }

          // Keep track of the most recent reading
          if (!latestReading || new Date(reading.timestamp) > new Date(latestReading.timestamp)) {
            latestReading = reading;
            latestTimestamp = reading.timestamp;
          }
        }
      }

      const average = count > 0 ? sum / count : null;

      // Get or create default thresholds if none exist
      let sensorThresholds = thresholdsByType[type] || [];

      if (sensorThresholds.length === 0) {
        // Create default thresholds for this sensor type
        sensorThresholds = await this.createDefaultThresholds(type);
      }

      // Calculate severity and threshold ranges
      let severity = { severity: 'unknown', color: '#9e9e9e', label: 'No Data', notification: false };
      let thresholdRanges: ThresholdRange[] = [];

      if (average !== null && sensorThresholds.length > 0) {
        severity = this.sensorThresholdService.calculateSeverity(
          average,
          sensorThresholds
        );

        thresholdRanges = this.getThresholdRanges(sensorThresholds);
      }

      // Calculate proper min/max values for gauge scaling
      const { minValue, maxValue } = this.calculateGaugeRange(
        thresholdRanges,
        values,
        type
      );

      averagesByType[type] = {
        // Core sensor data
        average,
        latestValue: latestReading ? latestReading.value : average, // Use latest reading as current value
        unit,
        sensorsCount: sensorsOfType.length,
        sensorsWithDataCount: count,
        values,

        // Timestamp information
        latestTimestamp,

        // Severity and status
        severity: severity.severity,
        severityColor: severity.color,
        severityLabel: severity.label,

        // Gauge configuration
        thresholdRanges,
        gaugeMin: minValue,
        gaugeMax: maxValue,
        minValue, // Keep both for compatibility
        maxValue, // Keep both for compatibility

        // Additional metadata
        sourceSensorName: sensorsOfType[0]?.name || `${type} Sensor`,
      };
    }

    return averagesByType;
  }

  // Helper method to create default thresholds
  private async createDefaultThresholds(sensorType: string): Promise<any[]> {
    try {
      // Get default thresholds from the threshold service
      return await this.sensorThresholdService.getDefaultThresholds(sensorType);
    } catch (error) {
      console.warn(`Failed to get default thresholds for ${sensorType}:`, error);
      return [];
    }
  }

  // Enhanced gauge range calculation
  private calculateGaugeRange(
    thresholdRanges: ThresholdRange[],
    values: number[],
    sensorType: string
  ): { minValue: number; maxValue: number } {
    // First, try to use threshold ranges
    if (thresholdRanges.length > 0) {
      const validMinValues = thresholdRanges
        .map(r => r.min)
        .filter((v): v is number => v !== null && v !== undefined);

      const validMaxValues = thresholdRanges
        .map(r => r.max)
        .filter((v): v is number => v !== null && v !== undefined);

      if (validMinValues.length > 0 && validMaxValues.length > 0) {
        return {
          minValue: Math.min(...validMinValues),
          maxValue: Math.max(...validMaxValues)
        };
      }
    }

    // Fallback to value-based calculation
    if (values.length > 0) {
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);
      const range = dataMax - dataMin;
      const padding = range * 0.1; // 10% padding

      return {
        minValue: Math.max(0, dataMin - padding),
        maxValue: dataMax + padding
      };
    }

    // Final fallback to sensor-type specific defaults
    return this.getDefaultRangeForSensorType(sensorType);
  }

  // Default ranges for different sensor types
  private getDefaultRangeForSensorType(sensorType: string): { minValue: number; maxValue: number } {
    const defaults: Record<string, { minValue: number; maxValue: number }> = {
      'pH': { minValue: 0, maxValue: 14 },
      'DO': { minValue: 0, maxValue: 20 },
      'Temperature': { minValue: 0, maxValue: 50 },
      'TempA': { minValue: 0, maxValue: 50 },
      'TempB': { minValue: 0, maxValue: 50 },
      'TempC': { minValue: 0, maxValue: 50 },
      'Saltlinity': { minValue: 0, maxValue: 50 },
      'NHx': { minValue: 0, maxValue: 10 },
      'EC': { minValue: 0, maxValue: 5000 },
      'TDS': { minValue: 0, maxValue: 2000 },
      'ORP': { minValue: -500, maxValue: 500 },
    };

    return defaults[sensorType] || { minValue: 0, maxValue: 100 };
  }

  // Helper methods
  private async getLatestReadingsForSensors(sensorIds: string[]) {
    const latestReadings = await Promise.all(
      sensorIds.map(async (sensorId) => {
        const reading = await this.sensorReadingRepository
          .createQueryBuilder('reading')
          .where('reading.sensorId = :sensorId', { sensorId })
          .orderBy('reading.timestamp', 'DESC')
          .getOne();

        return { sensorId, reading };
      }),
    );

    return latestReadings.reduce(
      (acc, { sensorId, reading }) => {
        if (reading) {
          acc[sensorId] = reading;
        }
        return acc;
      },
      {} as Record<string, SensorReading>,
    );
  }

  private groupThresholdsBySensorType(thresholds: any[]): Record<string, any[]> {
    return thresholds.reduce((acc, threshold) => {
      if (!acc[threshold.sensorType]) {
        acc[threshold.sensorType] = [];
      }
      acc[threshold.sensorType].push(threshold);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private getThresholdRanges(thresholds: any[]): ThresholdRange[] {
    return thresholds.map(threshold => ({
      severity: threshold.severityLevel,
      min: threshold.minValue,
      max: threshold.maxValue,
      color: threshold.colorCode,
      label: threshold.label
    })).sort((a, b) => {
      const priority: Record<string, number> = { critical: 1, warning: 2, normal: 3 };
      return (priority[a.severity] || 999) - (priority[b.severity] || 999);
    });
  }

  // Sensor data methods with proper return types
  async getSensorData(farmId: string, hours: number = 24, sensorType?: string): Promise<SensorChartData[]> {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID "${farmId}" not found`);
    }

    const devices = await this.deviceRepository.find({
      where: { farmId, isActive: true },
    });

    if (devices.length === 0) {
      return [];
    }

    const deviceIds = devices.map((device) => device.id);

    let sensorQuery = this.sensorRepository
      .createQueryBuilder('sensor')
      .where('sensor.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('sensor.isActive = :isActive', { isActive: true });

    if (sensorType) {
      sensorQuery = sensorQuery.andWhere('sensor.type = :type', {
        type: sensorType,
      });
    }

    const sensors = await sensorQuery.getMany();

    if (sensors.length === 0) {
      return [];
    }

    const sensorsByType = sensors.reduce(
      (acc, sensor) => {
        if (!acc[sensor.type]) {
          acc[sensor.type] = [];
        }
        acc[sensor.type].push(sensor.id);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

    const result = await Promise.all(
      Object.entries(sensorsByType).map(async ([type, sensorIds]) => {
        const readings = await this.getSensorReadingsInTimeRange(
          sensorIds,
          startDate,
          endDate,
        );

        return {
          type,
          data: this.aggregateReadingsByTime(readings, startDate, endDate),
        };
      }),
    );

    return result;
  }

  private async getSensorReadingsInTimeRange(
    sensorIds: string[],
    startDate: Date,
    endDate: Date,
  ) {
    return this.sensorReadingRepository
      .createQueryBuilder('reading')
      .select('reading.sensorId', 'sensorId')
      .addSelect('reading.value', 'value')
      .addSelect('reading.timestamp', 'timestamp')
      .where('reading.sensorId IN (:...sensorIds)', { sensorIds })
      .andWhere('reading.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('reading.timestamp', 'ASC')
      .getRawMany();
  }

  private aggregateReadingsByTime(
    readings: Array<{ sensorId: string; value: number; timestamp: Date }>,
    startDate: Date,
    endDate: Date,
  ) {
    if (readings.length === 0) {
      return [];
    }

    const readingsByHour = readings.reduce(
      (acc, reading) => {
        const date = new Date(reading.timestamp);
        date.setMinutes(0, 0, 0);
        const timeKey = date.toISOString();

        if (!acc[timeKey]) {
          acc[timeKey] = {
            time: date,
            values: [],
          };
        }

        acc[timeKey].values.push(reading.value);
        return acc;
      },
      {} as Record<string, { time: Date; values: number[] }>,
    );

    return Object.values(readingsByHour)
      .map(({ time, values }) => {
        const sum = values.reduce((a, b) => a + b, 0);
        return {
          time,
          value: sum / values.length,
        };
      })
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  async getSensorRealtimeData(
    farmId: string,
    sensorType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RealtimeDataPoint[]> {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID "${farmId}" not found`);
    }

    const devices = await this.deviceRepository.find({
      where: { farmId, isActive: true },
    });

    if (devices.length === 0) {
      return [];
    }

    const deviceIds = devices.map((device) => device.id);
    const sensorTypeEnum = sensorType.toUpperCase() as SensorType;

    const sensors = await this.sensorRepository.find({
      where: {
        deviceId: In(deviceIds),
        isActive: true,
        type: sensorTypeEnum,
      },
    });

    if (sensors.length === 0) {
      return [];
    }

    const sensorIds = sensors.map((sensor) => sensor.id);

    const readings = await this.sensorReadingRepository
      .createQueryBuilder('reading')
      .select('reading.sensorId', 'sensorId')
      .addSelect('reading.value', 'value')
      .addSelect('reading.timestamp', 'timestamp')
      .where('reading.sensorId IN (:...sensorIds)', { sensorIds })
      .andWhere('reading.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('reading.timestamp', 'ASC')
      .getRawMany();

    return readings.map(reading => ({
      time: reading.timestamp,
      value: reading.value,
      sensorId: reading.sensorId
    }));
  }
}