/* eslint-disable @typescript-eslint/no-unused-vars */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SensorReading } from '../sensor-reading/entities/sensor-reading.entity';
import { Sensor, SensorType } from '../sensor/entities/sensor.entity';
import { Device } from '../device/entities/device.entity';
import { Farm } from '../farm/entities/farm.entity';
// STEP 1: Add the SensorThresholdService import
import { SensorThresholdService } from '../sensor-threshold/sensor-threshold.service';

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
    // STEP 2: Add SensorThresholdService injection
    private readonly sensorThresholdService: SensorThresholdService,
  ) { }

  async getDashboardSummary(farmId: string) {
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

    // STEP 3: Get thresholds for the farm
    const thresholds = await this.sensorThresholdService.getThresholdsByFarm(farmId);
    const thresholdsByType = this.groupThresholdsBySensorType(thresholds);

    // STEP 4: Replace calculateAverageByType with calculateAverageByTypeWithSeverity
    const averagesByType = this.calculateAverageByTypeWithSeverity(
      sensors,
      latestReadings,
      thresholdsByType
    );

    return {
      latestTimestamp: latestReadingResult?.latestTimestamp || null,
      averages: averagesByType,
      activeSensorsCount: sensors.length,
      // STEP 5: Add thresholds to return object
      thresholds: thresholdsByType
    };
  }

  async getSensorData(farmId: string, hours: number = 24, sensorType?: string) {
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
      return [];
    }

    const deviceIds = devices.map((device) => device.id);

    // Build sensor query
    let sensorQuery = this.sensorRepository
      .createQueryBuilder('sensor')
      .where('sensor.deviceId IN (:...deviceIds)', { deviceIds })
      .andWhere('sensor.isActive = :isActive', { isActive: true });

    // Add sensor type filter if provided
    if (sensorType) {
      sensorQuery = sensorQuery.andWhere('sensor.type = :type', {
        type: sensorType,
      });
    }

    const sensors = await sensorQuery.getMany();

    if (sensors.length === 0) {
      return [];
    }

    // Get sensor IDs for each type to group them
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

    // Calculate time range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

    // Get time series data for each sensor type
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

  private async getLatestReadingsForSensors(sensorIds: string[]) {
    // For each sensor, get the latest reading
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

  // STEP 6: Replace the old calculateAverageByType method with this enhanced version
  private calculateAverageByTypeWithSeverity(
    sensors: Sensor[],
    readings: Record<string, SensorReading>,
    thresholdsByType: Record<string, any[]>
  ) {
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

    // Define the threshold range interface
    interface ThresholdRange {
      severity: string;
      min: number | null;
      max: number | null;
      color: string;
      label: string;
    }

    const averagesByType = Object.entries(sensorsByType).reduce(
      (acc, [type, sensorsOfType]) => {
        let sum = 0;
        let count = 0;
        let unit = '';
        const values: number[] = []; // Explicitly type as number array

        sensorsOfType.forEach((sensor) => {
          const reading = readings[sensor.id];
          if (reading) {
            sum += reading.value;
            count++;
            values.push(reading.value);
            if (!unit && sensor.unit) {
              unit = sensor.unit;
            }
          }
        });

        const average = count > 0 ? sum / count : null;

        // Calculate severity using thresholds
        let severity = { severity: 'unknown', color: '#grey', label: 'No Data', notification: false };
        let thresholdRanges: ThresholdRange[] = []; // Explicitly type the array

        if (average !== null && thresholdsByType[type]) {
          severity = this.sensorThresholdService.calculateSeverity(
            average,
            thresholdsByType[type]
          );

          // Get threshold ranges for gauge visualization
          thresholdRanges = this.getThresholdRanges(thresholdsByType[type]);
        }

        // Calculate min and max values with proper null checking
        const validMinValues = thresholdRanges
          .map(r => r.min)
          .filter((v): v is number => v !== null);

        const validMaxValues = thresholdRanges
          .map(r => r.max)
          .filter((v): v is number => v !== null);

        const minValue = validMinValues.length > 0
          ? Math.min(...validMinValues)
          : (values.length > 0 ? Math.min(...values) : 0);

        const maxValue = validMaxValues.length > 0
          ? Math.max(...validMaxValues)
          : (values.length > 0 ? Math.max(...values) : 100);

        acc[type] = {
          average,
          unit,
          sensorsCount: sensorsOfType.length,
          sensorsWithDataCount: count,
          values, // Individual sensor values
          // Severity information
          severity: severity.severity,
          severityColor: severity.color,
          severityLabel: severity.label,
          // Threshold ranges for gauge
          thresholdRanges,
          // Min/Max for gauge scaling
          minValue,
          maxValue,
        };

        return acc;
      },
      {} as Record<string, any>,
    );

    return averagesByType;
  }

  // STEP 7: Add new helper methods for threshold processing
  private groupThresholdsBySensorType(thresholds: any[]): Record<string, any[]> {
    return thresholds.reduce((acc, threshold) => {
      if (!acc[threshold.sensorType]) {
        acc[threshold.sensorType] = [];
      }
      acc[threshold.sensorType].push(threshold);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private getThresholdRanges(thresholds: any[]): Array<{
    severity: string;
    min: number | null;
    max: number | null;
    color: string;
    label: string;
  }> {
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
    // If we have no readings, return empty array
    if (readings.length === 0) {
      return [];
    }

    // Group readings by timestamp (rounded to nearest hour)
    const readingsByHour = readings.reduce(
      (acc, reading) => {
        const date = new Date(reading.timestamp);
        // Round to nearest hour for grouping
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

    // Calculate average for each time point
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
  ): Promise<any> {
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
      return [];
    }

    const deviceIds = devices.map((device) => device.id);

    // Convert string to SensorType enum
    const sensorTypeEnum = sensorType.toUpperCase() as SensorType;

    // Get all sensors of the specified type
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

    // Get readings for these sensors within the time range
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

    // Return the readings as-is, without aggregation, for real-time display
    return readings.map(reading => ({
      time: reading.timestamp,
      value: reading.value,
      sensorId: reading.sensorId
    }));
  }
}