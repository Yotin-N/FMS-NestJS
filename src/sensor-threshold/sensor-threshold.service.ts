// src/sensor-threshold/sensor-threshold.service.ts - ENHANCED VERSION

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SensorThreshold, SeverityLevel } from './entities/sensor-threshold.entity';
import {
    CreateSensorThresholdDto,
    UpdateSensorThresholdDto,
    SeverityResult
} from './dto/sensor-threshold.dto';

@Injectable()
export class SensorThresholdService {
    constructor(
        @InjectRepository(SensorThreshold)
        private thresholdRepository: Repository<SensorThreshold>,
    ) { }

    async getThresholdsByFarm(farmId: string): Promise<SensorThreshold[]> {
        return this.thresholdRepository.find({
            where: { farmId },
            order: { sensorType: 'ASC', severityLevel: 'ASC' }
        });
    }

    async upsertThresholds(
        farmId: string,
        sensorType: string,
        thresholds: CreateSensorThresholdDto[]
    ): Promise<SensorThreshold[]> {
        // Delete existing thresholds for this sensor type
        await this.thresholdRepository.delete({ farmId, sensorType });

        // Insert new thresholds
        const entities = thresholds.map(threshold =>
            this.thresholdRepository.create({ ...threshold, farmId, sensorType })
        );

        return this.thresholdRepository.save(entities);
    }

    calculateSeverity(value: number, thresholds: SensorThreshold[]): SeverityResult {
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
                    notification: threshold.notificationEnabled
                };
            }
        }

        return {
            severity: 'unknown',
            color: '#9e9e9e',
            label: 'Out of Range',
            notification: false
        };
    }

    private isValueInRange(value: number, min: number | null, max: number | null): boolean {
        const minCheck = min === null || value >= min;
        const maxCheck = max === null || value <= max;
        return minCheck && maxCheck;
    }

    async getDefaultThresholds(sensorType: string): Promise<SensorThreshold[]> {
        // Return default threshold configurations based on sensor type
        const defaults = this.getDefaultThresholdConfig(sensorType);
        return defaults.map(config =>
            this.thresholdRepository.create(config)
        );
    }

    // ENHANCED: Better default threshold configurations
    private getDefaultThresholdConfig(sensorType: string) {
        const configs = {
            'pH': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 6.0, colorCode: '#f44336', label: 'Too Acidic' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 8.5, maxValue: null, colorCode: '#f44336', label: 'Too Basic' },
                { severityLevel: SeverityLevel.WARNING, minValue: 6.0, maxValue: 6.5, colorCode: '#ff9800', label: 'Low pH' },
                { severityLevel: SeverityLevel.WARNING, minValue: 8.0, maxValue: 8.5, colorCode: '#ff9800', label: 'High pH' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 6.5, maxValue: 8.0, colorCode: '#4caf50', label: 'Optimal' }
            ],
            'DO': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 3.0, colorCode: '#f44336', label: 'Critical Low' },
                { severityLevel: SeverityLevel.WARNING, minValue: 3.0, maxValue: 5.0, colorCode: '#ff9800', label: 'Low' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 5.0, maxValue: null, colorCode: '#4caf50', label: 'Good' }
            ],
            'Temperature': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 20, colorCode: '#f44336', label: 'Too Cold' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 35, maxValue: null, colorCode: '#f44336', label: 'Too Hot' },
                { severityLevel: SeverityLevel.WARNING, minValue: 20, maxValue: 24, colorCode: '#ff9800', label: 'Cool' },
                { severityLevel: SeverityLevel.WARNING, minValue: 32, maxValue: 35, colorCode: '#ff9800', label: 'Warm' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 24, maxValue: 32, colorCode: '#4caf50', label: 'Optimal' }
            ],
            'TempA': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 20, colorCode: '#f44336', label: 'Too Cold' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 35, maxValue: null, colorCode: '#f44336', label: 'Too Hot' },
                { severityLevel: SeverityLevel.WARNING, minValue: 20, maxValue: 24, colorCode: '#ff9800', label: 'Cool' },
                { severityLevel: SeverityLevel.WARNING, minValue: 32, maxValue: 35, colorCode: '#ff9800', label: 'Warm' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 24, maxValue: 32, colorCode: '#4caf50', label: 'Optimal' }
            ],
            'TempB': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 20, colorCode: '#f44336', label: 'Too Cold' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 35, maxValue: null, colorCode: '#f44336', label: 'Too Hot' },
                { severityLevel: SeverityLevel.WARNING, minValue: 20, maxValue: 24, colorCode: '#ff9800', label: 'Cool' },
                { severityLevel: SeverityLevel.WARNING, minValue: 32, maxValue: 35, colorCode: '#ff9800', label: 'Warm' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 24, maxValue: 32, colorCode: '#4caf50', label: 'Optimal' }
            ],
            'TempC': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 20, colorCode: '#f44336', label: 'Too Cold' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 35, maxValue: null, colorCode: '#f44336', label: 'Too Hot' },
                { severityLevel: SeverityLevel.WARNING, minValue: 20, maxValue: 24, colorCode: '#ff9800', label: 'Cool' },
                { severityLevel: SeverityLevel.WARNING, minValue: 32, maxValue: 35, colorCode: '#ff9800', label: 'Warm' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 24, maxValue: 32, colorCode: '#4caf50', label: 'Optimal' }
            ],
            'Saltlinity': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: 10, colorCode: '#f44336', label: 'Too Low' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 40, maxValue: null, colorCode: '#f44336', label: 'Too High' },
                { severityLevel: SeverityLevel.WARNING, minValue: 10, maxValue: 15, colorCode: '#ff9800', label: 'Low' },
                { severityLevel: SeverityLevel.WARNING, minValue: 35, maxValue: 40, colorCode: '#ff9800', label: 'High' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 15, maxValue: 35, colorCode: '#4caf50', label: 'Optimal' }
            ],
            'NHx': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: 5, maxValue: null, colorCode: '#f44336', label: 'Toxic' },
                { severityLevel: SeverityLevel.WARNING, minValue: 2, maxValue: 5, colorCode: '#ff9800', label: 'High' },
                { severityLevel: SeverityLevel.NORMAL, minValue: null, maxValue: 2, colorCode: '#4caf50', label: 'Safe' }
            ],
            'EC': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: 3000, maxValue: null, colorCode: '#f44336', label: 'Too High' },
                { severityLevel: SeverityLevel.WARNING, minValue: 2000, maxValue: 3000, colorCode: '#ff9800', label: 'High' },
                { severityLevel: SeverityLevel.NORMAL, minValue: null, maxValue: 2000, colorCode: '#4caf50', label: 'Normal' }
            ],
            'TDS': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: 1500, maxValue: null, colorCode: '#f44336', label: 'Too High' },
                { severityLevel: SeverityLevel.WARNING, minValue: 1000, maxValue: 1500, colorCode: '#ff9800', label: 'High' },
                { severityLevel: SeverityLevel.NORMAL, minValue: null, maxValue: 1000, colorCode: '#4caf50', label: 'Normal' }
            ],
            'ORP': [
                { severityLevel: SeverityLevel.CRITICAL, minValue: null, maxValue: -100, colorCode: '#f44336', label: 'Too Low' },
                { severityLevel: SeverityLevel.CRITICAL, minValue: 400, maxValue: null, colorCode: '#f44336', label: 'Too High' },
                { severityLevel: SeverityLevel.WARNING, minValue: -100, maxValue: 0, colorCode: '#ff9800', label: 'Low' },
                { severityLevel: SeverityLevel.WARNING, minValue: 300, maxValue: 400, colorCode: '#ff9800', label: 'High' },
                { severityLevel: SeverityLevel.NORMAL, minValue: 0, maxValue: 300, colorCode: '#4caf50', label: 'Normal' }
            ]
        };

        return configs[sensorType] || [
            { severityLevel: SeverityLevel.NORMAL, minValue: null, maxValue: null, colorCode: '#4caf50', label: 'Normal' }
        ];
    }

    // ENHANCED: Method to ensure thresholds exist for a farm and sensor type
    async ensureThresholdsExist(farmId: string, sensorType: string): Promise<SensorThreshold[]> {
        // Check if thresholds already exist
        const existingThresholds = await this.thresholdRepository.find({
            where: { farmId, sensorType }
        });

        if (existingThresholds.length > 0) {
            return existingThresholds;
        }

        // Create default thresholds if none exist
        const defaultConfigs = this.getDefaultThresholdConfig(sensorType);
        const thresholds = defaultConfigs.map(config =>
            this.thresholdRepository.create({
                ...config,
                farmId,
                sensorType,
                notificationEnabled: true
            })
        );

        return await this.thresholdRepository.save(thresholds);
    }
}