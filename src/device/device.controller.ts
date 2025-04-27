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
} from '@nestjs/common';
import { DeviceService } from './device.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { FarmService } from '../farm/farm.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';

// Example response DTOs for Swagger documentation
class DeviceDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Main Pond Controller' })
  name: string;

  @ApiProperty({ example: 'Central device controlling pond sensors' })
  description: string;

  @ApiProperty({ example: 'Pond 1' })
  location: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  farmId: string;

  @ApiProperty({ example: '00:1B:44:11:3A:B7' })
  macAddress: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

class PaginatedDevicesDto {
  @ApiProperty({ type: [DeviceDto] })
  data: DeviceDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

@ApiTags('devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class DeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new device' })
  @ApiBody({
    type: CreateDeviceDto,
    examples: {
      example: {
        value: {
          name: 'Main Pond Controller',
          description: 'Central device controlling pond sensors',
          location: 'Pond 1',
          farmId: '123e4567-e89b-12d3-a456-426614174000',
          macAddress: '00:1B:44:11:3A:B7',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Device successfully created',
    type: DeviceDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async create(@Body() createDeviceDto: CreateDeviceDto, @Request() req) {
    return this.deviceService.create(createDeviceDto, req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all devices (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns all devices with pagination',
    type: PaginatedDevicesDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.deviceService.findAll(page, limit);
  }

  @Get('by-farm/:farmId')
  @ApiOperation({ summary: 'Get devices by farm ID' })
  @ApiParam({
    name: 'farmId',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns devices belonging to specified farm with pagination',
    type: PaginatedDevicesDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not found - farm does not exist' })
  async findByFarm(
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Request() req,
  ) {
    // Check if user has access to this farm
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      farmId,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view devices for this farm',
      );
    }

    return this.deviceService.findAllByFarm(farmId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiParam({
    name: 'id',
    description: 'Device ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the device with specified ID',
    type: DeviceDto,
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
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const device = await this.deviceService.findOne(id);

    // Check if user has access to this farm
    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(
      device.farmId,
      req.user.userId,
    );

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view this device',
      );
    }

    return device;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update device' })
  @ApiParam({
    name: 'id',
    description: 'Device ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateDeviceDto,
    examples: {
      example: {
        value: {
          name: 'Updated Device Name',
          description: 'Updated device description',
          isActive: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Device successfully updated',
    type: DeviceDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - device does not exist',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
    @Request() req,
  ) {
    return this.deviceService.update(id, updateDeviceDto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete device' })
  @ApiParam({
    name: 'id',
    description: 'Device ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Device successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - device does not exist',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.deviceService.remove(id, req.user.userId);
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
