import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from './entities/user.entity';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiProperty,
} from '@nestjs/swagger';

// Example response DTOs for Swagger documentation
class UserResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'USER', enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

class RegisterResponseDto extends UserResponseDto {}

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    type: RegisterDto,
    examples: {
      normalUser: {
        value: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'securePassword123',
        },
        summary: 'Register Normal User',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.userService.create(registerDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the profile of the authenticated user',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req) {
    const user = await this.userService.findByEmail(req.user.email);
    return this.sanitizeUser(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all users',
    type: [UserResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async findAll() {
    const users = await this.userService.findAll();
    return users.map((user) => this.sanitizeUser(user));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the user with specified ID',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not found - user does not exist' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const user = await this.userService.findById(id);

    // Only allow admins or the user themselves to view user details
    if (
      req.user.userId !== user.id &&
      !(await this.isUserAdmin(req.user.userId))
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this user',
      );
    }

    return this.sanitizeUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateUserDto,
    examples: {
      updateProfile: {
        value: {
          firstName: 'Updated',
          lastName: 'Name',
        },
        summary: 'Update profile information',
      },
      updateRole: {
        value: {
          role: UserRole.ADMIN,
        },
        summary: 'Update user role (admin only)',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not found - user does not exist' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const user = await this.userService.findById(id);

    // Only allow admins or the user themselves to update user details
    const isAdmin = await this.isUserAdmin(req.user.userId);

    if (req.user.userId !== user.id && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to update this user',
      );
    }

    // Only admins can change roles
    if (updateUserDto.role && !isAdmin) {
      throw new ForbiddenException('Only administrators can change user roles');
    }

    const updatedUser = await this.userService.update(id, updateUserDto);
    return this.sanitizeUser(updatedUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'User successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({ status: 404, description: 'Not found - user does not exist' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }

  // Helper method to check if user is admin
  private async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.userService.findById(userId);
      return user.role === UserRole.ADMIN;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return false;
    }
  }

  // Helper method to remove sensitive data like password before returning user
  private sanitizeUser(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }
}
