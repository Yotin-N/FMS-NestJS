import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { UpdateSensorReadingDto } from './dto/update-sensor-reading.dto';

@Controller('sensor-reading')
export class SensorReadingController {
  constructor(private readonly sensorReadingService: SensorReadingService) {}

  @Post()
  create(@Body() createSensorReadingDto: CreateSensorReadingDto) {
    return this.sensorReadingService.create(createSensorReadingDto);
  }

  @Get()
  findAll() {
    return this.sensorReadingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sensorReadingService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSensorReadingDto: UpdateSensorReadingDto,
  ) {
    return this.sensorReadingService.update(+id, updateSensorReadingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sensorReadingService.remove(+id);
  }
}
