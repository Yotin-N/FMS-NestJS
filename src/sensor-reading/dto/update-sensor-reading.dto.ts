import { PartialType } from '@nestjs/mapped-types';
import { CreateSensorReadingDto } from './create-sensor-reading.dto';

export class UpdateSensorReadingDto extends PartialType(
  CreateSensorReadingDto,
) {}
