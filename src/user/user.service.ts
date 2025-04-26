import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
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

      // Fetch the user without password for returning
      return this.findById(savedUser.id);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findById(id: string, relations: string[] = []): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async findByEmail(
    email: string,
    includePassword: boolean = false,
  ): Promise<User | null> {
    try {
      // แสดง log เพื่อ debug
      console.log(
        `Finding user by email: ${email}, includePassword: ${includePassword}`,
      );

      const queryBuilder = this.userRepository
        .createQueryBuilder('user')
        .where('user.email = :email', { email });

      if (includePassword) {
        queryBuilder.addSelect('user.password');
      }

      const user = await queryBuilder.getOne();

      // แสดง log ว่าพบผู้ใช้หรือไม่
      console.log(
        `User found: ${!!user}, has password: ${user && !!user.password}`,
      );

      return user;
    } catch (error) {
      console.error(`Error finding user by email: ${error.message}`);
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}
