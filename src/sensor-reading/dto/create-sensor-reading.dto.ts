import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSensorReadingDto {
  @IsNotEmpty()
  @IsUUID()
  sensorId: string;

  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  timestamp?: Date;
}

export class UpdateSensorReadingDto {
  @IsOptional()
  @IsUUID()
  sensorId?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  timestamp?: Date;
}

export class SensorReadingResponseDto {
  id: string;
  sensorId: string;
  value: number;
  timestamp: Date;
}

export class PaginatedSensorReadingsDto {
  data: SensorReadingResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
