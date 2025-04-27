import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorReadingService } from './sensor-reading.service';
import { SensorReadingController } from './sensor-reading.controller';
import { SensorReading } from './entities/sensor-reading.entity';
import { FarmModule } from '../farm/farm.module';
import { UserModule } from '../user/user.module';
import { SensorModule } from '../sensor/sensor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SensorReading]),
    forwardRef(() => SensorModule),
    FarmModule,
    UserModule,
  ],
  controllers: [SensorReadingController],
  providers: [SensorReadingService],
  exports: [SensorReadingService, TypeOrmModule],
})
export class SensorReadingModule {}
