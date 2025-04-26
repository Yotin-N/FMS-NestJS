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
} from '@nestjs/common';
import { DeviceService } from './device.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { FarmService } from '../farm/farm.service';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly farmService: FarmService,
  ) {}

  @Post()
  async create(@Body() createDeviceDto: CreateDeviceDto, @Request() req) {
    return this.deviceService.create(createDeviceDto, req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.deviceService.findAll(page, limit);
  }

  @Get('by-farm/:farmId')
  async findByFarm(
    @Param('farmId') farmId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
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
  async findOne(@Param('id') id: string, @Request() req) {
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
  async update(
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
    @Request() req,
  ) {
    return this.deviceService.update(id, updateDeviceDto, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
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
