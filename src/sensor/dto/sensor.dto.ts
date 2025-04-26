import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { SensorType } from '../entities/sensor.entity';

export class CreateSensorDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  serialNumber: string;

  @IsNotEmpty()
  @IsEnum(SensorType)
  type: SensorType;

  @IsNotEmpty()
  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSensorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(SensorType)
  type?: SensorType;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SensorResponseDto {
  id: string;
  name: string;
  serialNumber: string;
  type: SensorType;
  deviceId: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedSensorsDto {
  data: SensorResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class SensorReadingDto {
  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsOptional()
  timestamp?: Date;
}

export class SensorReadingResponseDto {
  id: string;
  value: number;
  timestamp: Date;
  sensorId: string;
}

export class PaginatedSensorReadingsDto {
  data: SensorReadingResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
