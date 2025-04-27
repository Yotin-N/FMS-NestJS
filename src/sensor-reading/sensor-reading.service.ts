/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SensorReading } from './entities/sensor-reading.entity';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { UpdateSensorReadingDto } from './dto/update-sensor-reading.dto';

@Injectable()
export class SensorReadingService {
  private readonly logger = new Logger(SensorReadingService.name);

  constructor(
    @InjectRepository(SensorReading)
    private readonly sensorReadingRepository: Repository<SensorReading>,
  ) {}

  async create(
    createSensorReadingDto: CreateSensorReadingDto,
  ): Promise<SensorReading> {
    try {
      const reading = this.sensorReadingRepository.create({
        ...createSensorReadingDto,
        timestamp: createSensorReadingDto.timestamp || new Date(),
      });

      return this.sensorReadingRepository.save(reading);
    } catch (error) {
      this.logger.error(`Error creating sensor reading: ${error.message}`);
      throw error;
    }
  }

  async findAll(
    page = 1,
    limit = 100,
  ): Promise<{
    data: SensorReading[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const [readings, total] = await this.sensorReadingRepository.findAndCount(
        {
          skip: (page - 1) * limit,
          take: limit,
          order: { timestamp: 'DESC' },
          relations: ['sensor'],
        },
      );

      return {
        data: readings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding all sensor readings: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<SensorReading> {
    try {
      const reading = await this.sensorReadingRepository.findOne({
        where: { id },
        relations: ['sensor'],
      });

      if (!reading) {
        throw new NotFoundException(`Sensor reading with ID "${id}" not found`);
      }

      return reading;
    } catch (error) {
      this.logger.error(`Error finding sensor reading: ${error.message}`);
      throw error;
    }
  }

  async findBySensor(
    sensorId: string,
    startDate?: Date,
    endDate?: Date,
    page = 1,
    limit = 100,
  ): Promise<{
    data: SensorReading[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      // Build query conditions
      const where: any = { sensorId };

      if (startDate && endDate) {
        where.timestamp = Between(startDate, endDate);
      } else if (startDate) {
        where.timestamp = Between(startDate, new Date());
      } else if (endDate) {
        where.timestamp = Between(new Date(0), endDate);
      }

      const [readings, total] = await this.sensorReadingRepository.findAndCount(
        {
          where,
          skip: (page - 1) * limit,
          take: limit,
          order: { timestamp: 'DESC' },
        },
      );

      return {
        data: readings,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding sensor readings: ${error.message}`);
      throw error;
    }
  }

  async update(
    id: string,
    updateSensorReadingDto: UpdateSensorReadingDto,
  ): Promise<SensorReading> {
    try {
      const reading = await this.findOne(id);

      // Do not allow changing the sensorId
      const { sensorId, ...updateData } = updateSensorReadingDto;

      Object.assign(reading, updateData);
      return this.sensorReadingRepository.save(reading);
    } catch (error) {
      this.logger.error(`Error updating sensor reading: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const reading = await this.findOne(id);
      await this.sensorReadingRepository.remove(reading);
    } catch (error) {
      this.logger.error(`Error removing sensor reading: ${error.message}`);
      throw error;
    }
  }

  // Method to add a reading with minimum data
  async addReading(
    sensorId: string,
    value: number,
    timestamp: Date = new Date(),
  ): Promise<SensorReading> {
    try {
      return this.create({
        sensorId,
        value,
        timestamp,
      });
    } catch (error) {
      this.logger.error(`Error adding sensor reading: ${error.message}`);
      throw error;
    }
  }

  // Method to get latest reading for a sensor
  async getLatestReading(sensorId: string): Promise<SensorReading | null> {
    try {
      return this.sensorReadingRepository.findOne({
        where: { sensorId },
        order: { timestamp: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Error getting latest sensor reading: ${error.message}`,
      );
      throw error;
    }
  }

  // Method to get average readings for a time period
  async getAverageReading(
    sensorId: string,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<number | null> {
    try {
      const result = await this.sensorReadingRepository
        .createQueryBuilder('reading')
        .select('AVG(reading.value)', 'average')
        .where('reading.sensorId = :sensorId', { sensorId })
        .andWhere('reading.timestamp BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .getRawOne();

      return result?.average || null;
    } catch (error) {
      this.logger.error(
        `Error getting average sensor reading: ${error.message}`,
      );
      throw error;
    }
  }
}
