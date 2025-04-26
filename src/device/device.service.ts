/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { FarmService } from '../farm/farm.service';
import {
  CreateDeviceDto,
  UpdateDeviceDto,
  PaginatedDevicesDto,
} from './dto/device.dto';
import { UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly farmService: FarmService,
    private readonly userService: UserService,
  ) {}

  async create(
    createDeviceDto: CreateDeviceDto,
    userId: string,
  ): Promise<Device> {
    // Check if farm exists and user has access
    const farm = await this.farmService.findOne(createDeviceDto.farmId);

    // Check if user is an admin or a member of the farm
    const isAdmin = await this.userHasAdminRole(userId);
    const isMember = await this.farmService.isUserMember(farm.id, userId);

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to add devices to this farm',
      );
    }

    const device = this.deviceRepository.create(createDeviceDto);
    return this.deviceRepository.save(device);
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedDevicesDto> {
    const [devices, total] = await this.deviceRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      relations: ['farm'],
    });

    return {
      data: devices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllByFarm(
    farmId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedDevicesDto> {
    // Verify the farm exists
    await this.farmService.findOne(farmId);

    const [devices, total] = await this.deviceRepository.findAndCount({
      where: { farmId },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['sensors'],
    });

    return {
      data: devices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: { id },
      relations: ['farm', 'sensors'],
    });

    if (!device) {
      throw new NotFoundException(`Device with ID "${id}" not found`);
    }

    return device;
  }

  async update(
    id: string,
    updateDeviceDto: UpdateDeviceDto,
    userId: string,
  ): Promise<Device> {
    const device = await this.findOne(id);

    // Check if user is an admin or a member of the farm
    const isAdmin = await this.userHasAdminRole(userId);
    const isMember = await this.farmService.isUserMember(device.farmId, userId);

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to update this device',
      );
    }

    Object.assign(device, updateDeviceDto);
    return this.deviceRepository.save(device);
  }

  async remove(id: string, userId: string): Promise<void> {
    const device = await this.findOne(id);

    // Check if user is an admin or a member of the farm
    const isAdmin = await this.userHasAdminRole(userId);
    const isMember = await this.farmService.isUserMember(device.farmId, userId);

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to delete this device',
      );
    }

    await this.deviceRepository.remove(device);
  }

  // Check if a device belongs to a farm
  async isDeviceInFarm(deviceId: string, farmId: string): Promise<boolean> {
    const device = await this.findOne(deviceId);
    return device.farmId === farmId;
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
