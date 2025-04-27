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
} from '@nestjs/common';
import { SensorService } from './sensor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import {
  CreateSensorDto,
  UpdateSensorDto,
  SensorReadingDto,
} from './dto/sensor.dto';
import { FarmService } from '../farm/farm.service';
import { DeviceService } from '../device/device.service';
import { SensorType } from './entities/sensor.entity';
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
} from '@nestjs/swagger';

// Example response DTOs for Swagger documentation
class SensorDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'pH Sensor 1' })
  name: string;

  @ApiProperty({ example: 'SN12345678' })
  serialNumber: string;

  @ApiProperty({ enum: SensorType, example: SensorType.PH })
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

class SensorReadingResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 7.2 })
  value: number;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  timestamp: Date;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  sensorId: string;
}

class PaginatedSensorReadingsDto {
  @ApiProperty({ type: [SensorReadingResponseDto] })
  data: SensorReadingResponseDto[];

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
export class SensorController {
  constructor(
    private readonly sensorService: SensorService,
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
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
          type: SensorType.PH,
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
          type: SensorType.TEMP,
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
    return this.sensorService.create(createSensorDto, req.user.userId);
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
    return this.sensorService.findAll(page, limit);
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

    return this.sensorService.findAllByDevice(deviceId, page, limit);
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

    return sensor;
  }

  @Get(':id/readings')
  @ApiOperation({ summary: 'Get sensor readings' })
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
    type: PaginatedSensorReadingsDto,
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

    return this.sensorService.getReadings(
      id,
      parsedStartDate,
      parsedEndDate,
      page,
      limit,
    );
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
    return this.sensorService.update(id, updateSensorDto, req.user.userId);
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
    return this.sensorService.remove(id, req.user.userId);
  }

  @Post(':id/readings')
  @ApiOperation({ summary: 'Add a sensor reading' })
  @ApiParam({
    name: 'id',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: SensorReadingDto,
    examples: {
      example: {
        value: {
          value: 7.2,
          timestamp: '2025-01-01T12:00:00.000Z',
        },
      },
      simpleValue: {
        value: {
          value: 7.2,
        },
        summary: 'Simple value (current timestamp)',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Reading successfully added',
    type: SensorReadingResponseDto,
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
    @Body() readingDto: SensorReadingDto,
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

    return this.sensorService.addReading(id, readingDto);
  }

  // Helper method to check if user has admin role
  private async userHasAdminRole(userId: string): Promise<boolean> {
    try {
      // We'll use the farmService to access userService to avoid circular dependencies
      const user = await this.farmService['userService'].findById(userId);
      return user && user.role === UserRole.ADMIN;
    } catch (error) {
      console.error('Error checking user role:', error);
      return false;
    }
  }
}
