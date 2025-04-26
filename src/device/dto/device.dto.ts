import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsNotEmpty()
  @IsUUID()
  farmId: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DeviceResponseDto {
  id: string;
  name: string;
  description?: string;
  location?: string;
  farmId: string;
  macAddress?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedDevicesDto {
  data: DeviceResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
