import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorService } from './sensor.service';
import { SensorController } from './sensor.controller';
import { Sensor } from './entities/sensor.entity';
import { SensorReading } from '../sensor-reading/entities/sensor-reading.entity';
import { DeviceModule } from '../device/device.module';
import { UserModule } from '../user/user.module';
import { FarmModule } from '../farm/farm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sensor, SensorReading]),
    DeviceModule,
    UserModule,
    FarmModule,
  ],
  controllers: [SensorController],
  providers: [SensorService],
  exports: [SensorService, TypeOrmModule],
})
export class SensorModule {}
