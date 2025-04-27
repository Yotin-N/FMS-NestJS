/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { UpdateSensorReadingDto } from './dto/update-sensor-reading.dto';

@Injectable()
export class SensorReadingService {
  create(createSensorReadingDto: CreateSensorReadingDto) {
    return 'This action adds a new sensorReading';
  }

  findAll() {
    return `This action returns all sensorReading`;
  }

  findOne(id: number) {
    return `This action returns a #${id} sensorReading`;
  }

  update(id: number, updateSensorReadingDto: UpdateSensorReadingDto) {
    return `This action updates a #${id} sensorReading`;
  }

  remove(id: number) {
    return `This action removes a #${id} sensorReading`;
  }
}
