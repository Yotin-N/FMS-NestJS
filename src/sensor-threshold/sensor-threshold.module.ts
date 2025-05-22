import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorThresholdService } from './sensor-threshold.service';
import { SensorThresholdController } from './sensor-threshold.controller';
import { SensorThreshold } from './entities/sensor-threshold.entity';
import { FarmModule } from '../farm/farm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SensorThreshold]),
    FarmModule,
  ],
  controllers: [SensorThresholdController],
  providers: [SensorThresholdService],
  exports: [SensorThresholdService],
})
export class SensorThresholdModule { }