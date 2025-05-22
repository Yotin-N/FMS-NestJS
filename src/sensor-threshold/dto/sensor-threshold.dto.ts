import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { SeverityLevel } from '../entities/sensor-threshold.entity';

export class CreateSensorThresholdDto {
  @IsNotEmpty()
  @IsUUID()
  farmId: string;

  @IsNotEmpty()
  @IsString()
  sensorType: string;

  @IsNotEmpty()
  @IsEnum(SeverityLevel)
  severityLevel: SeverityLevel;

  @IsOptional()
  @IsInt()
  @Min(0)
  rangeOrder?: number;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class UpdateSensorThresholdDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  rangeOrder?: number;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;

  @IsOptional()
  @IsString()
  colorCode?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class SeverityResult {
  severity: string;
  color: string;
  label: string;
  notification: boolean;
}
