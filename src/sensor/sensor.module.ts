import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorService } from './sensor.service';
import { SensorController } from './sensor.controller';
import { Sensor } from './entities/sensor.entity';
import { DeviceModule } from '../device/device.module';
import { UserModule } from '../user/user.module';
import { FarmModule } from '../farm/farm.module';
import { SensorReadingModule } from '../sensor-reading/sensor-reading.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sensor]),
    DeviceModule,
    UserModule,
    FarmModule,
    forwardRef(() => SensorReadingModule), // Use forwardRef to avoid circular dependency
  ],
  controllers: [SensorController],
  providers: [SensorService],
  exports: [SensorService, TypeOrmModule],
})
export class SensorModule {}
