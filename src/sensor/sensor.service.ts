import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from './entities/sensor.entity';
import { DeviceService } from '../device/device.service';
import { FarmService } from '../farm/farm.service';
import {
  CreateSensorDto,
  UpdateSensorDto,
  PaginatedSensorsDto,
  SensorReadingDto,
} from './dto/sensor.dto';
import { UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';

@Injectable()
export class SensorService {
  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => SensorReadingService))
    private readonly sensorReadingService: SensorReadingService,
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

  // Updated method to use SensorReadingService
  async addReading(
    sensorId: string,
    readingDto: SensorReadingDto,
  ): Promise<any> {
    // Verify the sensor exists
    await this.findOne(sensorId);

    return this.sensorReadingService.create({
      sensorId,
      value: readingDto.value,
      timestamp: readingDto.timestamp,
    });
  }

  // Updated method to use SensorReadingService
  async getReadings(
    sensorId: string,
    startDate?: Date,
    endDate?: Date,
    page = 1,
    limit = 100,
  ): Promise<any> {
    // Verify the sensor exists
    await this.findOne(sensorId);

    return this.sensorReadingService.findBySensor(
      sensorId,
      startDate,
      endDate,
      page,
      limit,
    );
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
