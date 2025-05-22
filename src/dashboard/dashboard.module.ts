import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dasboard.controller';
import { SensorReading } from 'src/sensor-reading/entities/sensor-reading.entity';
import { Sensor } from 'src/sensor/entities/sensor.entity';
import { Device } from 'src/device/entities/device.entity';
import { Farm } from 'src/farm/entities/farm.entity';
import { DashboardService } from './dashboard.service';
import { SensorThresholdModule } from '../sensor-threshold/sensor-threshold.module'

@Module({
  imports: [TypeOrmModule.forFeature([Farm, Device, Sensor, SensorReading, SensorThresholdModule]),
    SensorThresholdModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardModule],
})
export class DashboardModule { }
