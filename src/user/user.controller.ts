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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.userService.create(registerDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }
  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  async getProfile(@Request() req) {
    const user = await this.userService.findByEmail(req.user.email);
    return this.sanitizeUser(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async findAll() {
    const users = await this.userService.findAll();
    return users.map((user) => this.sanitizeUser(user));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
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
