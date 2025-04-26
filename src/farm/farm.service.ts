import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from './entities/farm.entity';
// import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import {
  CreateFarmDto,
  UpdateFarmDto,
  PaginatedFarmsDto,
} from './dto/farm.dto';

@Injectable()
export class FarmService {
  private readonly logger = new Logger(FarmService.name);

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

    try {
      // Add farm to user's farms - use the repository to manage the relationship
      await this.farmRepository
        .createQueryBuilder()
        .relation(Farm, 'members')
        .of(savedFarm)
        .add(user);

      return this.findOne(savedFarm.id);
    } catch (error) {
      this.logger.error(`Failed to add farm owner as member: ${error.message}`);
      // Still return the farm even if adding the member fails
      return savedFarm;
    }
  }

  async findAll(page = 1, limit = 10): Promise<PaginatedFarmsDto> {
    try {
      const [farms, total] = await this.farmRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        data: farms,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding all farms: ${error.message}`);
      throw error;
    }
  }

  async findAllByUser(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedFarmsDto> {
    try {
      // First check if the user exists
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Use a query builder approach for more control
      const queryBuilder = this.farmRepository
        .createQueryBuilder('farm')
        .innerJoin('farm.members', 'member')
        .where('member.id = :userId', { userId })
        .skip((page - 1) * limit)
        .take(limit);

      const [farms, total] = await queryBuilder.getManyAndCount();

      return {
        data: farms,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Error finding farms by user: ${error.message}`);
      throw error;
    }
  }

  async findOne(id: string): Promise<Farm> {
    try {
      const farm = await this.farmRepository.findOne({
        where: { id },
        relations: ['members', 'devices'],
      });

      if (!farm) {
        throw new NotFoundException(`Farm with ID "${id}" not found`);
      }

      return farm;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error finding farm: ${error.message}`);
      throw error;
    }
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

    try {
      // Add the user to farm members
      await this.farmRepository
        .createQueryBuilder()
        .relation(Farm, 'members')
        .of(farm)
        .add(user);

      return this.findOne(farmId);
    } catch (error) {
      this.logger.error(`Error adding member to farm: ${error.message}`);
      throw error;
    }
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

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    try {
      // Remove the relationship
      await this.farmRepository
        .createQueryBuilder()
        .relation(Farm, 'members')
        .of(farm)
        .remove(user);

      return this.findOne(farmId);
    } catch (error) {
      this.logger.error(`Error removing member from farm: ${error.message}`);
      throw error;
    }
  }

  async isUserMember(farmId: string, userId: string): Promise<boolean> {
    try {
      const count = await this.farmRepository
        .createQueryBuilder('farm')
        .innerJoin('farm.members', 'member')
        .where('farm.id = :farmId', { farmId })
        .andWhere('member.id = :userId', { userId })
        .getCount();

      return count > 0;
    } catch (error) {
      this.logger.error(`Error checking user membership: ${error.message}`);
      return false;
    }
  }
}
