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
  Query,
  Request,
  ForbiddenException,
  ParseUUIDPipe,
  ParseIntPipe,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import {
  CreateSensorReadingDto,
  UpdateSensorReadingDto,
  PaginatedSensorReadingsDto,
  SensorReadingResponseDto,
} from './dto/create-sensor-reading.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FarmService } from '../farm/farm.service';
import { SensorService } from '../sensor/sensor.service';
import { UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('sensor-readings')
@Controller('sensor-readings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SensorReadingController {
  constructor(
    private readonly sensorReadingService: SensorReadingService,
    @Inject(forwardRef(() => SensorService))
    private readonly sensorService: SensorService,
    private readonly farmService: FarmService,
    private readonly userService: UserService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sensor reading' })
  @ApiBody({
    type: CreateSensorReadingDto,
    examples: {
      example: {
        value: {
          sensorId: '123e4567-e89b-12d3-a456-426614174000',
          value: 7.2,
          timestamp: '2025-01-01T12:00:00.000Z',
        },
      },
      simpleExample: {
        value: {
          sensorId: '123e4567-e89b-12d3-a456-426614174000',
          value: 7.2,
        },
        summary: 'Simple reading (current timestamp)',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Sensor reading successfully created',
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
  async create(
    @Body() createSensorReadingDto: CreateSensorReadingDto,
    @Request() req,
  ) {
    // Get the sensor to check farm access
    const sensor = await this.sensorService.findOne(
      createSensorReadingDto.sensorId,
    );

    // Check if user has access to the farm
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

    return this.sensorReadingService.create(createSensorReadingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sensor readings (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiResponse({
    status: 200,
    description: 'Returns all sensor readings with pagination',
    type: PaginatedSensorReadingsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
    @Request() req,
  ) {
    // Only admins can see all readings
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only administrators can view all sensor readings',
      );
    }

    return this.sensorReadingService.findAll(page, limit);
  }

  @Get('by-sensor/:sensorId')
  @ApiOperation({ summary: 'Get readings by sensor ID' })
  @ApiParam({
    name: 'sensorId',
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
  async findBySensor(
    @Request() req,
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
  ) {
    // Get the sensor to check farm access
    const sensor = await this.sensorService.findOne(sensorId);

    // Check if user has access to the farm
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
      sensorId,
      parsedStartDate,
      parsedEndDate,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sensor reading by ID' })
  @ApiParam({
    name: 'id',
    description: 'Sensor Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the sensor reading with specified ID',
    type: SensorReadingResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor reading does not exist',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const reading = await this.sensorReadingService.findOne(id);

    // Get the sensor to check farm access
    const sensor = await this.sensorService.findOne(reading.sensorId);

    // Check if user has access to the farm
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view this sensor reading',
      );
    }

    return reading;
  }

  @Get('latest/:sensorId')
  @ApiOperation({ summary: 'Get latest reading for a sensor' })
  @ApiParam({
    name: 'sensorId',
    description: 'Sensor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the latest reading for the specified sensor',
    type: SensorReadingResponseDto,
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
  async getLatestReading(
    @Param('sensorId', ParseUUIDPipe) sensorId: string,
    @Request() req,
  ) {
    // Get the sensor to check farm access
    const sensor = await this.sensorService.findOne(sensorId);

    // Check if user has access to the farm
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

    return this.sensorReadingService.getLatestReading(sensorId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update sensor reading' })
  @ApiParam({
    name: 'id',
    description: 'Sensor Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateSensorReadingDto,
    examples: {
      example: {
        value: {
          value: 7.5,
          timestamp: '2025-01-01T12:30:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor reading successfully updated',
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
    description: 'Not found - sensor reading does not exist',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSensorReadingDto: UpdateSensorReadingDto,
    @Request() req,
  ) {
    const reading = await this.sensorReadingService.findOne(id);

    // Get the sensor to check farm access
    const sensor = await this.sensorService.findOne(reading.sensorId);

    // Check if user has access to the farm
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      sensor.device.farm.id,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to update this sensor reading',
      );
    }

    return this.sensorReadingService.update(id, updateSensorReadingDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete sensor reading' })
  @ApiParam({
    name: 'id',
    description: 'Sensor Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor reading successfully deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - sensor reading does not exist',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const reading = await this.sensorReadingService.findOne(id);

    // Get the sensor to check farm access
    const sensor = await this.sensorService.findOne(reading.sensorId);

    // Only admins or farm owners can delete readings
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isFarmOwner = sensor.device.farm.ownerId === req.user.userId;

    if (!isAdmin && !isFarmOwner) {
      throw new ForbiddenException(
        'Only administrators or farm owners can delete sensor readings',
      );
    }

    return this.sensorReadingService.remove(id);
  }

  // Helper method to check if user has admin role
  private async userHasAdminRole(userId: string): Promise<boolean> {
    try {
      const user = await this.userService.findById(userId);
      return user && user.role === UserRole.ADMIN;
    } catch (error) {
      return false;
    }
  }
}
