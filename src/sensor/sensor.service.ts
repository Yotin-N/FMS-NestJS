import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
  InternalServerErrorException,
  ConflictException,
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
  private readonly logger = new Logger(SensorService.name);

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
    try {
      // Check if device exists
      const device = await this.deviceService.findOne(createSensorDto.deviceId);

      // Check if user has access to the farm that owns this device
      const isAdmin = await this.userHasAdminRole(userId);
      const isMember = await this.farmService.isUserMember(
        device.farmId,
        userId,
      );

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
        throw new ConflictException(
          `Sensor with serial number "${createSensorDto.serialNumber}" already exists`,
        );
      }

      const sensor = this.sensorRepository.create(createSensorDto);
      const savedSensor = await this.sensorRepository.save(sensor);

      // Load the complete sensor data with relationships
      return this.findOne(savedSensor.id);
    } catch (error) {
      this.logger.error(`Error creating sensor: ${error.message}`);
      if (
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create sensor');
    }
  }

  // Using SensorReadingService to add readings
  async addReading(
    sensorId: string,
    readingDto: SensorReadingDto,
  ): Promise<any> {
    try {
      // Verify the sensor exists
      await this.findOne(sensorId);

      return this.sensorReadingService.create({
        sensorId,
        value: readingDto.value,
        timestamp: readingDto.timestamp,
      });
    } catch (error) {
      this.logger.error(`Error adding reading: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add sensor reading');
    }
  }

  // Using SensorReadingService to get readings
  async getReadings(
    sensorId: string,
    startDate?: Date,
    endDate?: Date,
    page = 1,
    limit = 100,
  ): Promise<any> {
    try {
      // Verify the sensor exists
      await this.findOne(sensorId);

      return this.sensorReadingService.findBySensor(
        sensorId,
        startDate,
        endDate,
        page,
        limit,
      );
    } catch (error) {
      this.logger.error(`Error getting readings: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get sensor readings');
    }
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedSensorsDto> {
    try {
      const [sensors, total] = await this.sensorRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        relations: ['device', 'device.farm'],
      });

      return {
        data: sensors,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding all sensors: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve sensors');
    }
  }

  async findAllByDevice(
    deviceId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedSensorsDto> {
    try {
      // Verify the device exists
      await this.deviceService.findOne(deviceId);

      const [sensors, total] = await this.sensorRepository.findAndCount({
        where: { deviceId },
        skip: (page - 1) * limit,
        take: limit,
        relations: ['device', 'device.farm'],
      });

      return {
        data: sensors,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding sensors by device: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve sensors for device',
      );
    }
  }

  async findOne(id: string): Promise<Sensor> {
    try {
      const sensor = await this.sensorRepository.findOne({
        where: { id },
        relations: ['device', 'device.farm'],
      });

      if (!sensor) {
        throw new NotFoundException(`Sensor with ID "${id}" not found`);
      }

      return sensor;
    } catch (error) {
      this.logger.error(`Error finding sensor: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve sensor');
    }
  }

  async findBySerialNumber(serialNumber: string): Promise<Sensor> {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error finding sensor by serial number: ${error.message}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve sensor by serial number',
      );
    }
  }

  async update(
    id: string,
    updateSensorDto: UpdateSensorDto,
    userId: string,
  ): Promise<Sensor> {
    try {
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

        if (existingSensor && existingSensor.id !== id) {
          throw new ConflictException(
            `Sensor with serial number "${updateSensorDto.serialNumber}" already exists`,
          );
        }
      }

      Object.assign(sensor, updateSensorDto);
      await this.sensorRepository.save(sensor);

      // Return the updated sensor with full relations
      return this.findOne(id);
    } catch (error) {
      this.logger.error(`Error updating sensor: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update sensor');
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.error(`Error removing sensor: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete sensor');
    }
  }

  // Generate MQTT topic for a sensor
  generateMqttTopic(sensor: Sensor): string {
    // Primary topic structure: shrimp_farm/{farmId}/device/{deviceId}/sensor/{type}
    if (sensor.device?.farm?.id) {
      return `shrimp_farm/${sensor.device.farm.id}/device/${sensor.deviceId}/sensor/${sensor.type.toLowerCase()}`;
    }

    // Fallback to serial number if full hierarchy isn't available
    return `sensor/${sensor.serialNumber}`;
  }

  // Helper method to check if user has admin role
  private async userHasAdminRole(userId: string): Promise<boolean> {
    try {
      const user = await this.userService.findById(userId);
      return user && user.role === UserRole.ADMIN;
    } catch (error) {
      this.logger.error(`Error checking user role: ${error.message}`);
      return false;
    }
  }
}
