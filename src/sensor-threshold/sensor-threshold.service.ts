/* eslint-disable @typescript-eslint/no-unused-vars */
// src/sensor-threshold/sensor-threshold.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SensorThreshold,
  SeverityLevel,
} from './entities/sensor-threshold.entity';
import {
  CreateSensorThresholdDto,
  UpdateSensorThresholdDto,
  SeverityResult,
} from './dto/sensor-threshold.dto';

@Injectable()
export class SensorThresholdService {
  constructor(
    @InjectRepository(SensorThreshold)
    private thresholdRepository: Repository<SensorThreshold>,
    private dataSource: DataSource,
  ) {}

  async getThresholdsByFarm(farmId: string): Promise<SensorThreshold[]> {
    return this.thresholdRepository.find({
      where: { farmId },
      order: { sensorType: 'ASC', severityLevel: 'ASC', rangeOrder: 'ASC' },
    });
  }

  // FIXED: Updated upsertThresholds to handle rangeOrder properly
  async upsertThresholds(
    farmId: string,
    sensorType: string,
    thresholds: CreateSensorThresholdDto[],
  ): Promise<SensorThreshold[]> {
    return await this.dataSource.transaction(async (manager) => {
      // Step 1: Delete ALL existing thresholds for this farmId + sensorType
      await manager.delete(SensorThreshold, { farmId, sensorType });

      // Step 2: Prepare thresholds with proper rangeOrder
      const entities = thresholds.map((threshold, index) => {
        const entity = new SensorThreshold();
        entity.farmId = farmId;
        entity.sensorType = sensorType;
        entity.severityLevel = threshold.severityLevel;
        entity.minValue = threshold.minValue ?? null;
        entity.maxValue = threshold.maxValue ?? null;
        entity.notificationEnabled = threshold.notificationEnabled ?? true;
        entity.colorCode = threshold.colorCode ?? '#4caf50';
        entity.label = threshold.label ?? 'Threshold';

        const sameSeverityIndex = thresholds
          .slice(0, index)
          .filter((t) => t.severityLevel === threshold.severityLevel).length;
        entity.rangeOrder = threshold.rangeOrder ?? sameSeverityIndex;

        return entity;
      });

      return await manager.save(SensorThreshold, entities);
    });
  }

  calculateSeverity(
    value: number,
    thresholds: SensorThreshold[],
  ): SeverityResult {
    const sortedThresholds = thresholds.sort((a, b) => {
      const priority = { critical: 1, warning: 2, normal: 3 };
      return priority[a.severityLevel] - priority[b.severityLevel];
    });

    for (const threshold of sortedThresholds) {
      if (this.isValueInRange(value, threshold.minValue, threshold.maxValue)) {
        return {
          severity: threshold.severityLevel,
          color: threshold.colorCode,
          label: threshold.label,
          notification: threshold.notificationEnabled,
        };
      }
    }

    return {
      severity: 'unknown',
      color: '#9e9e9e',
      label: 'Out of Range',
      notification: false,
    };
  }

  private isValueInRange(
    value: number,
    min: number | null,
    max: number | null,
  ): boolean {
    const minCheck = min === null || value >= min;
    const maxCheck = max === null || value <= max;
    return minCheck && maxCheck;
  }

  async getDefaultThresholds(sensorType: string): Promise<SensorThreshold[]> {
    const defaults = this.getDefaultThresholdConfig(sensorType);
    return defaults.map((config, index) => {
      const threshold = new SensorThreshold();
      Object.assign(threshold, config);

      // FIXED: Assign rangeOrder for default thresholds
      const sameSeverityIndex = defaults
        .slice(0, index)
        .filter((t) => t.severityLevel === config.severityLevel).length;
      threshold.rangeOrder = sameSeverityIndex;

      return threshold;
    });
  }

  private getDefaultThresholdConfig(sensorType: string) {
    const configs = {
      // Temperature sensors A, B, C (°C) - All use same thresholds from WQI table
      TempA: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 25,
          colorCode: '#f44336',
          label: 'Critical Cold',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 25,
          maxValue: 26,
          colorCode: '#ff9800',
          label: 'Cool',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 26,
          maxValue: 28,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: 28,
          maxValue: 29,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 30,
          maxValue: 34,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 35,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical Hot',
        },
      ],
      TempB: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 25,
          colorCode: '#f44336',
          label: 'Critical Cold',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 25,
          maxValue: 26,
          colorCode: '#ff9800',
          label: 'Cool',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 26,
          maxValue: 28,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: 28,
          maxValue: 29,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 30,
          maxValue: 34,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 35,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical Hot',
        },
      ],
      TempC: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 25,
          colorCode: '#f44336',
          label: 'Critical Cold',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 25,
          maxValue: 26,
          colorCode: '#ff9800',
          label: 'Cool',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 26,
          maxValue: 28,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: 28,
          maxValue: 29,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 30,
          maxValue: 34,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 35,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical Hot',
        },
      ],

      // Dissolved Oxygen (mg/L) - From WQI table
      DO: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 2,
          colorCode: '#f44336',
          label: 'Critical Low',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 2.1,
          maxValue: 5.0,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: 5.0,
          maxValue: null,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
      ],

      // Salinity (ppt) - From WQI table
      Salinity: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 25,
          colorCode: '#f44336',
          label: 'Critical Low',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 26,
          maxValue: 28,
          colorCode: '#ff9800',
          label: 'Low',
        },
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: 29,
          maxValue: 34,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 35,
          maxValue: 40,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 41,
          maxValue: 50,
          colorCode: '#ff9800',
          label: 'High',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 50,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical High',
        },
      ],

      // pH - From WQI table
      pH: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 7.5,
          colorCode: '#f44336',
          label: 'Critical Acidic',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 7.6,
          maxValue: 7.8,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: 7.9,
          maxValue: 8.2,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 8.3,
          maxValue: 8.4,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 8.5,
          maxValue: 14.0,
          colorCode: '#ff9800',
          label: 'High',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 14.0,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical Basic',
        },
      ],

      // Ammonia (PPM) - From WQI table
      Ammonia: [
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: null,
          maxValue: 80,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 81,
          maxValue: 120,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 121,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical High',
        },
      ],

      // Turbidity (cm) - From WQI table
      Turbidity: [
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: null,
          maxValue: 10,
          colorCode: '#f44336',
          label: 'Critical Turbid',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 11,
          maxValue: 20,
          colorCode: '#ff9800',
          label: 'Turbid',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 21,
          maxValue: 39,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 40,
          maxValue: 49,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 50,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical Clear',
        },
      ],

      // NO2 (Nitrite) - From WQI table
      NO2: [
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: null,
          maxValue: 0.1,
          colorCode: '#4caf50',
          label: 'Optimal',
        },
        {
          severityLevel: SeverityLevel.WARNING,
          minValue: 0.1,
          maxValue: 0.11,
          colorCode: '#ffeb3b',
          label: 'Good',
        },
        {
          severityLevel: SeverityLevel.CRITICAL,
          minValue: 0.12,
          maxValue: null,
          colorCode: '#f44336',
          label: 'Critical High',
        },
      ],
    };

    return (
      configs[sensorType] || [
        {
          severityLevel: SeverityLevel.NORMAL,
          minValue: null,
          maxValue: null,
          colorCode: '#4caf50',
          label: 'Normal',
        },
      ]
    );
  }

  async ensureThresholdsExist(
    farmId: string,
    sensorType: string,
  ): Promise<SensorThreshold[]> {
    const existingThresholds = await this.thresholdRepository.find({
      where: { farmId, sensorType },
      order: { rangeOrder: 'ASC' },
    });

    if (existingThresholds.length > 0) {
      return existingThresholds;
    }

    // Create default thresholds if none exist
    const defaultConfigs = this.getDefaultThresholdConfig(sensorType);
    const thresholds = defaultConfigs.map((config, index) => {
      const threshold = new SensorThreshold();
      threshold.farmId = farmId;
      threshold.sensorType = sensorType;
      threshold.severityLevel = config.severityLevel;
      threshold.minValue = config.minValue;
      threshold.maxValue = config.maxValue;
      threshold.notificationEnabled = true;
      threshold.colorCode = config.colorCode;
      threshold.label = config.label;

      // Assign rangeOrder
      const sameSeverityIndex = defaultConfigs
        .slice(0, index)
        .filter((t) => t.severityLevel === config.severityLevel).length;
      threshold.rangeOrder = sameSeverityIndex;

      return threshold;
    });

    return await this.thresholdRepository.save(thresholds);
  }
}
