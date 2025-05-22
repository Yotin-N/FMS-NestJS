// src/dashboard/types/dashboard.types.ts

export interface ThresholdRange {
    severity: string;
    min: number | null;
    max: number | null;
    color: string;
    label: string;
}

export interface SensorTypeData {
    average: number | null;
    latestValue: number | null;
    unit: string;
    sensorsCount: number;
    sensorsWithDataCount: number;
    values: number[];
    latestTimestamp: Date | null;
    severity: string;
    severityColor: string;
    severityLabel: string;
    thresholdRanges: ThresholdRange[];
    gaugeMin: number;
    gaugeMax: number;
    minValue: number;
    maxValue: number;
    sourceSensorName: string;
}

export interface DashboardSummary {
    latestTimestamp: Date | null;
    averages: Record<string, SensorTypeData>;
    activeSensorsCount: number;
    thresholds?: Record<string, any[]>;
}

export interface SensorChartData {
    type: string;
    data: Array<{
        time: Date;
        value: number;
    }>;
}

export interface RealtimeDataPoint {
    time: Date;
    value: number;
    sensorId: string;
}