import { Module } from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import { SensorReadingController } from './sensor-reading.controller';

@Module({
  controllers: [SensorReadingController],
  providers: [SensorReadingService],
})
export class SensorReadingModule {}
