import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Sensor } from './entities/sensor.entity';
import { SensorReading } from '../sensor-reading/entities/sensor-reading.entity';
import { DeviceService } from '../device/device.service';
import { FarmService } from '../farm/farm.service';
import {
  CreateSensorDto,
  UpdateSensorDto,
  PaginatedSensorsDto,
  SensorReadingDto,
  PaginatedSensorReadingsDto,
} from './dto/sensor.dto';
import { UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(SensorReading)
    private readonly sensorReadingRepository: Repository<SensorReading>,
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
    private readonly userService: UserService,
  ) {}

  async create(
    createSensorDto: CreateSensorDto,
    userId: string,
  ): Promise<Sensor> {
    // Check if device exists
    const device = await this.deviceService.findOne(createSensorDto.deviceId);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(userId);
    const isMember = await this.farmService.isUserMember(device.farmId, userId);

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to add sensors to this device',
      );
    }

    // Check for duplicate serial number
    const existingSensor = await this.sensorRepository.findOne({
      where: { serialNumber: createSensorDto.serialNumber },
    });

    if (existingSensor) {
      throw new ForbiddenException(
        `Sensor with serial number "${createSensorDto.serialNumber}" already exists`,
      );
    }

    const sensor = this.sensorRepository.create(createSensorDto);
    return this.sensorRepository.save(sensor);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedSensorsDto> {
    const [sensors, total] = await this.sensorRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      relations: ['device'],
    });

    return {
      data: sensors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllByDevice(
    deviceId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedSensorsDto> {
    // Verify the device exists
    await this.deviceService.findOne(deviceId);

    const [sensors, total] = await this.sensorRepository.findAndCount({
      where: { deviceId },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: sensors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Sensor> {
    const sensor = await this.sensorRepository.findOne({
      where: { id },
      relations: ['device', 'device.farm'],
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor with ID "${id}" not found`);
    }

    return sensor;
  }

  async findBySerialNumber(serialNumber: string): Promise<Sensor> {
    const sensor = await this.sensorRepository.findOne({
      where: { serialNumber },
      relations: ['device', 'device.farm'],
    });

    if (!sensor) {
      throw new NotFoundException(
        `Sensor with serial number "${serialNumber}" not found`,
      );
    }

    return sensor;
  }

  async update(
    id: string,
    updateSensorDto: UpdateSensorDto,
    userId: string,
  ): Promise<Sensor> {
    const sensor = await this.findOne(id);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to update this sensor',
      );
    }

    // If updating serial number, check for duplicates
    if (
      updateSensorDto.serialNumber &&
      updateSensorDto.serialNumber !== sensor.serialNumber
    ) {
      const existingSensor = await this.sensorRepository.findOne({
        where: { serialNumber: updateSensorDto.serialNumber },
      });

      if (existingSensor) {
        throw new ForbiddenException(
          `Sensor with serial number "${updateSensorDto.serialNumber}" already exists`,
        );
      }
    }

    Object.assign(sensor, updateSensorDto);
    return this.sensorRepository.save(sensor);
  }

  async remove(id: string, userId: string): Promise<void> {
    const sensor = await this.findOne(id);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to delete this sensor',
      );
    }

    await this.sensorRepository.remove(sensor);
  }

  // Sensor readings methods
  async addReading(
    sensorId: string,
    readingDto: SensorReadingDto,
  ): Promise<SensorReading> {
    const sensor = await this.findOne(sensorId);

    const reading = this.sensorReadingRepository.create({
      ...readingDto,
      sensorId: sensor.id,
    });

    return this.sensorReadingRepository.save(reading);
  }

  async getReadings(
    sensorId: string,
    startDate?: Date,
    endDate?: Date,
    page = 1,
    limit = 100,
  ): Promise<PaginatedSensorReadingsDto> {
    // Verify the sensor exists
    await this.findOne(sensorId);

    // Build query conditions
    const where: any = { sensorId };

    if (startDate && endDate) {
      where.timestamp = Between(startDate, endDate);
    } else if (startDate) {
      where.timestamp = Between(startDate, new Date());
    } else if (endDate) {
      where.timestamp = Between(new Date(0), endDate);
    }

    const [readings, total] = await this.sensorReadingRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' },
    });

    return {
      data: readings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Helper method to check if user has admin role
  private async userHasAdminRole(userId: string): Promise<boolean> {
    try {
      const user = await this.userService.findById(userId);
      return user && user.role === UserRole.ADMIN;
    } catch (error) {
      console.error('Error checking user role:', error);
      return false;
    }
  }
}
