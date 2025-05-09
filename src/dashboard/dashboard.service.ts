/* eslint-disable @typescript-eslint/no-unused-vars */
// src/dashboard/dashboard.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SensorReading } from '../sensor-reading/entities/sensor-reading.entity';
import { Sensor } from '../sensor/entities/sensor.entity';
import { Device } from '../device/entities/device.entity';
import { Farm } from '../farm/entities/farm.entity';

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
  ) {}

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

    // Calculate averages by sensor type
    const averagesByType = this.calculateAverageByType(sensors, latestReadings);

    return {
      latestTimestamp: latestReadingResult?.latestTimestamp || null,
      averages: averagesByType,
      activeSensorsCount: sensors.length,
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

  private calculateAverageByType(
    sensors: Sensor[],
    readings: Record<string, SensorReading>,
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

    const averagesByType = Object.entries(sensorsByType).reduce(
      (acc, [type, sensorsOfType]) => {
        let sum = 0;
        let count = 0;
        let unit = '';

        sensorsOfType.forEach((sensor) => {
          const reading = readings[sensor.id];
          if (reading) {
            sum += reading.value;
            count++;
            if (!unit && sensor.unit) {
              unit = sensor.unit;
            }
          }
        });

        acc[type] = {
          average: count > 0 ? sum / count : null,
          unit: unit,
          sensorsCount: sensorsOfType.length,
          sensorsWithDataCount: count,
        };

        return acc;
      },
      {} as Record<
        string,
        {
          average: number | null;
          unit: string;
          sensorsCount: number;
          sensorsWithDataCount: number;
        }
      >,
    );

    return averagesByType;
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
}
