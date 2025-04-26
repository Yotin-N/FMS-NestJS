import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Farm } from './entities/farm.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  CreateFarmDto,
  UpdateFarmDto,
  PaginatedFarmsDto,
} from './dto/farm.dto';

@Injectable()
export class FarmService {
  constructor(
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    private readonly userService: UserService,
  ) {}

  async create(createFarmDto: CreateFarmDto, userId: string): Promise<Farm> {
    const farm = this.farmRepository.create({
      ...createFarmDto,
      ownerId: userId,
    });

    // Save the farm first
    const savedFarm = await this.farmRepository.save(farm);

    // Add the owner as a member
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Add farm to user's farms
    if (!user.farms) {
      user.farms = [];
    }
    user.farms.push(savedFarm);
    await this.userService.save(user);

    return savedFarm;
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedFarmsDto> {
    const [farms, total] = await this.farmRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      relations: ['members'],
    });

    return {
      data: farms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedFarmsDto> {
    const user = await this.userService.findById(userId, ['farms']);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If farms relationship hasn't been loaded, load it
    if (!user.farms) {
      const userWithFarms = await this.userService.findById(userId, ['farms']);
      user.farms = userWithFarms.farms;
    }

    const farmIds = user.farms.map((farm) => farm.id);

    const [farms, total] = await this.farmRepository.findAndCount({
      where: { id: In(farmIds) },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['members'],
    });

    return {
      data: farms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Farm> {
    const farm = await this.farmRepository.findOne({
      where: { id },
      relations: ['members', 'devices'],
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID "${id}" not found`);
    }

    return farm;
  }

  async update(
    id: string,
    updateFarmDto: UpdateFarmDto,
    userId: string,
  ): Promise<Farm> {
    const farm = await this.findOne(id);

    if (farm.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this farm',
      );
    }

    Object.assign(farm, updateFarmDto);
    return this.farmRepository.save(farm);
  }

  async remove(id: string, userId: string): Promise<void> {
    const farm = await this.findOne(id);

    if (farm.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this farm',
      );
    }

    await this.farmRepository.remove(farm);
  }

  async addMember(
    farmId: string,
    userId: string,
    requestUserId: string,
  ): Promise<Farm> {
    const farm = await this.findOne(farmId);

    // Check if requester is the owner or admin
    if (farm.ownerId !== requestUserId) {
      throw new ForbiddenException(
        'You do not have permission to add members to this farm',
      );
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Add farm to user's farms
    if (!user.farms) {
      user.farms = [];
    }

    // Check if user is already a member
    const isAlreadyMember = user.farms.some((f) => f.id === farmId);
    if (!isAlreadyMember) {
      user.farms.push(farm);
      await this.userService.save(user);
    }

    return this.findOne(farmId);
  }

  async removeMember(
    farmId: string,
    userId: string,
    requestUserId: string,
  ): Promise<Farm> {
    const farm = await this.findOne(farmId);

    // Check if requester is the owner or admin
    if (farm.ownerId !== requestUserId) {
      throw new ForbiddenException(
        'You do not have permission to remove members from this farm',
      );
    }

    // Cannot remove the owner
    if (userId === farm.ownerId) {
      throw new ForbiddenException('Cannot remove the farm owner from members');
    }

    const user = await this.userService.findById(userId, ['farms']);
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Remove farm from user's farms
    if (user.farms) {
      user.farms = user.farms.filter((f) => f.id !== farmId);
      await this.userService.save(user);
    }

    return this.findOne(farmId);
  }

  async isUserMember(farmId: string, userId: string): Promise<boolean> {
    const user = await this.userService.findById(userId, ['farms']);

    if (!user || !user.farms) {
      return false;
    }

    return user.farms.some((farm) => farm.id === farmId);
  }
}
