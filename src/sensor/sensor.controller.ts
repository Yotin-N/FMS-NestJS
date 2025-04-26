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

@Controller('sensors')
@UseGuards(JwtAuthGuard)
export class SensorController {
  constructor(
    private readonly sensorService: SensorService,
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
  ) {}

  @Post()
  async create(@Body() createSensorDto: CreateSensorDto, @Request() req) {
    return this.sensorService.create(createSensorDto, req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.sensorService.findAll(page, limit);
  }

  @Get('by-device/:deviceId')
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSensorDto: UpdateSensorDto,
    @Request() req,
  ) {
    return this.sensorService.update(id, updateSensorDto, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.sensorService.remove(id, req.user.userId);
  }

  // This endpoint would typically be protected by an API key or other mechanism for IoT devices
  // Here we're keeping it behind JWT for consistency, but in a real app you might have a different auth strategy
  @Post(':id/readings')
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
      return false;
    }
  }
}
