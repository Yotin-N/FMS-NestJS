/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
  ParseUUIDPipe,
  ParseIntPipe,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { SensorService } from './sensor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateSensorDto, UpdateSensorDto } from './dto/sensor.dto';
import { FarmService } from '../farm/farm.service';
import { DeviceService } from '../device/device.service';
import { SensorType } from './entities/sensor.entity';
import { SensorReadingService } from '../sensor-reading/sensor-reading.service';
import { CreateSensorReadingDto } from '../sensor-reading/dto/create-sensor-reading.dto';
import { MqttService } from '../mqtt/mqtt.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';

// Example response DTOs for Swagger documentation
class SensorDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'pH Sensor 1' })
  name: string;

  @ApiProperty({ example: 'SN12345678' })
  serialNumber: string;

  @ApiProperty({ enum: SensorType, example: SensorType.pH })
  type: SensorType;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  deviceId: string;

  @ApiPropertyOptional({ example: 'pH' })
  unit?: string;

  @ApiPropertyOptional({ example: 0 })
  minValue?: number;

  @ApiPropertyOptional({ example: 14 })
  maxValue?: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 'shrimp_farm/farm123/device/device456/sensor/ph' })
  mqttTopic: string;
}

class PaginatedSensorsDto {
  @ApiProperty({ type: [SensorDto] })
  data: SensorDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

// Reading response schema
class SensorReadingResponseSchema {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 7.2 })
  value: number;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  timestamp: Date;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  sensorId: string;
}

class PaginatedSensorReadingsSchema {
  @ApiProperty({ type: [SensorReadingResponseSchema] })
  data: SensorReadingResponseSchema[];

  @ApiProperty({ example: 1000 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 100 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}

@ApiTags('sensors')
@Controller('sensors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@ApiExtraModels(SensorReadingResponseSchema, PaginatedSensorReadingsSchema)
export class SensorController {
  constructor(
    private readonly sensorService: SensorService,
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
    private readonly sensorReadingService: SensorReadingService,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: MqttService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sensor' })
  @ApiBody({
    type: CreateSensorDto,
    examples: {
      phSensor: {
        value: {
          name: 'pH Sensor 1',
          serialNumber: 'SN12345678',
          type: SensorType.pH,
          deviceId: '123e4567-e89b-12d3-a456-426614174000',
          unit: 'pH',
          minValue: 0,
          maxValue: 14,
          isActive: true,
        },
        summary: 'pH Sensor',
      },
      temperatureSensor: {
        value: {
          name: 'Temperature Sensor 1',
          serialNumber: 'SN87654321',
          type: SensorType.TempA,
          deviceId: '123e4567-e89b-12d3-a456-426614174000',
          unit: '°C',
          minValue: 0,
          maxValue: 40,
          isActive: true,
        },
        summary: 'Temperature Sensor',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Sensor successfully created',
    type: SensorDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - serial number already exists',
  })
  async create(@Body() createSensorDto: CreateSensorDto, @Request() req) {
    // Create sensor
    const sensor = await this.sensorService.create(
      createSensorDto,
      req.user.userId,
    );

    // Subscribe to MQTT topics for this sensor
    const mqttTopic = await this.mqttService.handleSensorCreated(sensor.id);

    // Return the sensor with MQTT topic
    return {
      ...sensor,
      mqttTopic,
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all sensors (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns all sensors with pagination',
    type: PaginatedSensorsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    const result = await this.sensorService.findAll(page, limit);

    // Add MQTT topics to each sensor
    const enhancedData = result.data.map((sensor) => ({
      ...sensor,
      mqttTopic: this.mqttService.generateMqttTopic(sensor),
    }));

    return {
      ...result,
      data: enhancedData,
    };
  }

  @Get('by-device/:deviceId')
  @ApiOperation({ summary: 'Get sensors by device ID' })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description:
      'Returns sensors belonging to specified device with pagination',
    type: PaginatedSensorsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - device does not exist',
  })
  async findByDevice(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Request() req,
  ) {
    // Fetch the device to get the farm ID
    const device = await this.deviceService.findOne(deviceId);

    // Check if user has access to this farm
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      device.farmId,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view sensors for this device',
      );
    }

    const result = await this.sensorService.findAllByDevice(
      deviceId,
      page,
      limit,
    );

    // Add MQTT topics to each sensor
    const enhancedData = result.data.map((sensor) => ({
      ...sensor,
      mqttTopic: this.mqttService.generateMqttTopic(sensor),
    }));

    return {
      ...result,
      data: enhancedData,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sensor by ID' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the sensor with specified ID',
    type: SensorDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor does not exist',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const sensor = await this.sensorService.findOne(id);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view this sensor',
      );
    }

    // Generate MQTT topic for the sensor
    const mqttTopic = this.mqttService.generateMqttTopic(sensor);

    // Return the sensor with MQTT topic
    return {
      ...sensor,
      mqttTopic,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sensor' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateSensorDto,
    examples: {
      example: {
        value: {
          name: 'Updated Sensor Name',
          isActive: false,
          minValue: 2,
          maxValue: 12,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor successfully updated',
    type: SensorDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor does not exist',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - serial number already exists',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSensorDto: UpdateSensorDto,
    @Request() req,
  ) {
    // Get the original sensor for comparison
    const originalSensor = await this.sensorService.findOne(id);
    const oldSerialNumber = originalSensor.serialNumber;

    // Update the sensor
    const updatedSensor = await this.sensorService.update(
      id,
      updateSensorDto,
      req.user.userId,
    );

    // Update MQTT subscriptions if needed
    let mqttTopic = this.mqttService.generateMqttTopic(updatedSensor);

    // If serial number changed, update MQTT subscriptions
    if (
      updateSensorDto.serialNumber &&
      updateSensorDto.serialNumber !== oldSerialNumber
    ) {
      mqttTopic = await this.mqttService.handleSensorUpdated(
        id,
        oldSerialNumber,
      );
    }

    // Return the updated sensor with MQTT topic
    return {
      ...updatedSensor,
      mqttTopic,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete sensor' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Sensor successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor does not exist',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    // Get the sensor before removing it
    const sensor = await this.sensorService.findOne(id);
    const serialNumber = sensor.serialNumber;
    const type = sensor.type;

    // Remove the sensor
    await this.sensorService.remove(id, req.user.userId);

    // Remove MQTT subscriptions
    await this.mqttService.handleSensorDeleted(id, serialNumber, type);

    return { message: 'Sensor successfully deleted' };
  }

  // READINGS ENDPOINTS

  @Get(':id/readings')
  @ApiOperation({ summary: 'Get readings for a specific sensor' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    example: '2025-01-31T23:59:59.999Z',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiResponse({
    status: 200,
    description: 'Returns readings for the specified sensor with pagination',
    schema: { $ref: getSchemaPath(PaginatedSensorReadingsSchema) },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor does not exist',
  })
  async getReadings(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
  ) {
    const sensor = await this.sensorService.findOne(id);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view readings for this sensor',
      );
    }

    // Parse dates if provided
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    const parsedEndDate = endDate ? new Date(endDate) : undefined;

    return this.sensorReadingService.findBySensor(
      id,
      parsedStartDate,
      parsedEndDate,
      page,
      limit,
    );
  }

  @Post(':id/readings')
  @ApiOperation({ summary: 'Add a reading to a specific sensor' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    schema: {
      properties: {
        value: {
          type: 'number',
          example: 7.2,
        },
        timestamp: {
          type: 'string',
          example: '2025-01-01T12:00:00.000Z',
          description: 'Optional. Current time will be used if not provided.',
        },
      },
      required: ['value'],
    },
    examples: {
      withTimestamp: {
        value: {
          value: 7.2,
          timestamp: '2025-01-01T12:00:00.000Z',
        },
        summary: 'Reading with timestamp',
      },
      valueOnly: {
        value: {
          value: 7.2,
        },
        summary: 'Reading with current timestamp',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Reading successfully added',
    schema: { $ref: getSchemaPath(SensorReadingResponseSchema) },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor does not exist',
  })
  async addReading(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() readingDto: { value: number; timestamp?: string },
    @Request() req,
  ) {
    const sensor = await this.sensorService.findOne(id);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to add readings to this sensor',
      );
    }

    // Create the reading using the SensorReadingService
    const createReadingDto: CreateSensorReadingDto = {
      sensorId: id,
      value: readingDto.value,
      timestamp: readingDto.timestamp
        ? new Date(readingDto.timestamp)
        : undefined,
    };

    return this.sensorReadingService.create(createReadingDto);
  }

  @Get(':sensorId/readings/:readingId')
  @ApiOperation({ summary: 'Get a specific reading for a sensor' })
  @ApiParam({
    name: 'sensorId',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'readingId',
    description: 'Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the specific reading',
    schema: { $ref: getSchemaPath(SensorReadingResponseSchema) },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor or reading does not exist',
  })
  async getReading(
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Param('readingId', ParseUUIDPipe) readingId: string,
    @Request() req,
  ) {
    // First verify the sensor exists and the user has access
    const sensor = await this.sensorService.findOne(sensorId);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view readings for this sensor',
      );
    }

    // Get the reading
    const reading = await this.sensorReadingService.findOne(readingId);

    // Verify the reading belongs to the requested sensor
    if (reading.sensorId !== sensorId) {
      throw new ForbiddenException(
        'The requested reading does not belong to this sensor',
      );
    }

    return reading;
  }

  @Patch(':sensorId/readings/:readingId')
  @ApiOperation({ summary: 'Update a specific reading for a sensor' })
  @ApiParam({
    name: 'sensorId',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'readingId',
    description: 'Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    schema: {
      properties: {
        value: {
          type: 'number',
          example: 7.5,
        },
        timestamp: {
          type: 'string',
          example: '2025-01-01T12:30:00.000Z',
        },
      },
    },
    examples: {
      example: {
        value: {
          value: 7.5,
          timestamp: '2025-01-01T12:30:00.000Z',
        },
      },
      valueOnly: {
        value: {
          value: 7.5,
        },
        summary: 'Update value only',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Reading successfully updated',
    schema: { $ref: getSchemaPath(SensorReadingResponseSchema) },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor or reading does not exist',
  })
  async updateReading(
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Param('readingId', ParseUUIDPipe) readingId: string,
    @Body() updateDto: { value?: number; timestamp?: string },
    @Request() req,
  ) {
    // First verify the sensor exists and the user has access
    const sensor = await this.sensorService.findOne(sensorId);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to update readings for this sensor',
      );
    }

    // Get the reading
    const reading = await this.sensorReadingService.findOne(readingId);

    // Verify the reading belongs to the requested sensor
    if (reading.sensorId !== sensorId) {
      throw new ForbiddenException(
        'The requested reading does not belong to this sensor',
      );
    }

    // Prepare the update data
    const updateData: any = {};
    if (updateDto.value !== undefined) updateData.value = updateDto.value;
    if (updateDto.timestamp !== undefined)
      updateData.timestamp = new Date(updateDto.timestamp);

    // Update the reading
    return this.sensorReadingService.update(readingId, updateData);
  }

  @Delete(':sensorId/readings/:readingId')
  @ApiOperation({ summary: 'Delete a specific reading for a sensor' })
  @ApiParam({
    name: 'sensorId',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'readingId',
    description: 'Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Reading successfully deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor or reading does not exist',
  })
  async deleteReading(
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Param('readingId', ParseUUIDPipe) readingId: string,
    @Request() req,
  ) {
    // First verify the sensor exists and the user has access
    const sensor = await this.sensorService.findOne(sensorId);

    // Only admins or farm owners can delete readings
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isFarmOwner = sensor.device.farm.ownerId === req.user.userId;

    if (!isAdmin && !isFarmOwner) {
      throw new ForbiddenException(
        'Only administrators or farm owners can delete sensor readings',
      );
    }

    // Get the reading
    const reading = await this.sensorReadingService.findOne(readingId);

    // Verify the reading belongs to the requested sensor
    if (reading.sensorId !== sensorId) {
      throw new ForbiddenException(
        'The requested reading does not belong to this sensor',
      );
    }

    // Delete the reading
    await this.sensorReadingService.remove(readingId);
    return { message: 'Reading successfully deleted' };
  }

  @Get(':id/readings/latest')
  @ApiOperation({ summary: 'Get latest reading for a sensor' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the latest reading for the specified sensor',
    schema: { $ref: getSchemaPath(SensorReadingResponseSchema) },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor does not exist or no readings available',
  })
  async getLatestReading(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    // First verify the sensor exists and the user has access
    const sensor = await this.sensorService.findOne(id);

    // Check if user has access to the farm that owns this device
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view readings for this sensor',
      );
    }

    // Get the latest reading
    const reading = await this.sensorReadingService.getLatestReading(id);

    if (!reading) {
      throw new NotFoundException('No readings available for this sensor');
    }

    return reading;
  }

  // Helper method to check if user has admin role
  private async userHasAdminRole(userId: string): Promise<boolean> {
    try {
      // We'll use the farmService to access userService to avoid circular dependencies
      const user = await this.farmService['userService'].findById(userId);
      return user && user.role === UserRole.ADMIN;
    } catch (error) {
      return false;
    }
  }
}
