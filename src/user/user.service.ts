import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  logger: any;
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(registerDto: RegisterDto): Promise<User> {
    try {
      // Check if user with this email already exists
      const existingUser = await this.findByEmail(registerDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Set default role if not provided
      if (!registerDto.role) {
        registerDto.role = UserRole.USER;
      }

      // สร้าง entity ก่อนแล้วค่อย save เพื่อให้ BeforeInsert hooks ทำงาน
      const user = this.userRepository.create(registerDto);

      // Save user with hashed password
      const savedUser = await this.userRepository.save(user);

      // Fetch the user WITHOUT password for returning
      return this.findById(savedUser.id);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async findAll(): Promise<User[]> {
    // Get users but exclude password field
    return this.userRepository.find({
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'googleId',
        'createdAt',
        'isActive',
        'updatedAt',
      ],
    });
  }

  async findById(id: string, relations: string[] = []): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        relations,
        select: [
          'id',
          'email',
          'firstName',
          'lastName',
          'role',
          'googleId',
          'createdAt',
          'updatedAt',
        ],
      });

      if (!user) {
        throw new NotFoundException(`User with ID "${id}" not found`);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error finding user by ID: ${error.message}`);
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  async findByEmail(
    email: string,
    includePassword: boolean = false,
  ): Promise<User | null> {
    try {
      // Log for debugging
      console.log(
        `Finding user by email: ${email}, includePassword: ${includePassword}`,
      );

      // Use the repository directly instead of query builder to avoid field list issues
      const query: any = { email };
      const options: any = {};

      // Only include password field if explicitly requested
      if (includePassword) {
        options.select = [
          'id',
          'email',
          'firstName',
          'lastName',
          'role',
          'password',
          'googleId',
          'createdAt',
          'updatedAt',
        ];
      }

      const user = await this.userRepository.findOne({
        where: query,
        ...options,
      });

      // Log whether user was found
      console.log(
        `User found: ${!!user}, has password: ${user && !!user.password}`,
      );

      return user;
    } catch (error) {
      console.error(`Error finding user by email: ${error.message}`);
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  async searchByEmail(email: string, farmId?: string): Promise<User[]> {
    try {
      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .where('user.email LIKE :email', { email: `%${email}%` })
        .take(10); // Limit results

      // If farmId is provided, exclude users who are already members
      if (farmId) {
        queryBuilder
          .leftJoin('user.farms', 'farm', 'farm.id = :farmId', { farmId })
          .andWhere('farm.id IS NULL');
      }

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error(`Error searching users by email: ${error.message}`);
      throw new InternalServerErrorException('Failed to search users');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // If updating password, it will be automatically hashed by BeforeUpdate hook in the entity
    Object.assign(user, updateUserDto);
    await this.userRepository.save(user);

    // Return user without password
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async save(user: User): Promise<User> {
    await this.userRepository.save(user);

    // Return user without password
    return this.findById(user.id);
  }
}
