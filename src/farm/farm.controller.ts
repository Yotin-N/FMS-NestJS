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
import { FarmService } from './farm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateFarmDto, UpdateFarmDto, FarmMemberDto } from './dto/farm.dto';

@Controller('farms')
@UseGuards(JwtAuthGuard)
export class FarmController {
  constructor(private readonly farmService: FarmService) {}

  @Post()
  async create(@Body() createFarmDto: CreateFarmDto, @Request() req) {
    return this.farmService.create(createFarmDto, req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.farmService.findAll(page, limit);
  }

  @Get('my-farms')
  async findMine(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.farmService.findAllByUser(req.user.userId, page, limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const farm = await this.farmService.findOne(id);

    const isAdmin = await this.userHasAdminRole(req.user.userId);
    const isMember = await this.farmService.isUserMember(id, req.user.userId);

    if (!isAdmin && !isMember) {
      throw new ForbiddenException(
        'You do not have permission to view this farm',
      );
    }

    return farm;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFarmDto: UpdateFarmDto,
    @Request() req,
  ) {
    const isAdmin = await this.userHasAdminRole(req.user.userId);

    if (isAdmin) {
      const farm = await this.farmService.findOne(id);
      Object.assign(farm, updateFarmDto);
      return this.farmService.update(id, updateFarmDto, farm.ownerId);
    }

    return this.farmService.update(id, updateFarmDto, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const isAdmin = await this.userHasAdminRole(req.user.userId);

    if (isAdmin) {
      const farm = await this.farmService.findOne(id);
      return this.farmService.remove(id, farm.ownerId);
    }

    return this.farmService.remove(id, req.user.userId);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() memberDto: FarmMemberDto,
    @Request() req,
  ) {
    return this.farmService.addMember(id, memberDto.userId, req.user.userId);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req,
  ) {
    return this.farmService.removeMember(id, userId, req.user.userId);
  }

  private async userHasAdminRole(userId: string): Promise<boolean> {
    try {
      // We would inject UserService, but to avoid circular dependencies
      // we'll get user information from the farmService
      const user = await this.farmService['userService'].findById(userId);
      return user && user.role === UserRole.ADMIN;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return false;
    }
  }
}
