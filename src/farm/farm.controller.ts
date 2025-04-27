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
import { FarmService } from './farm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { CreateFarmDto, UpdateFarmDto, FarmMemberDto } from './dto/farm.dto';
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
class FarmDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Ocean View Shrimp Farm' })
  name: string;

  @ApiProperty({ example: 'Large coastal shrimp farm with 10 ponds' })
  description: string;

  @ApiProperty({ example: 'Coastal Road, Phuket' })
  location: string;

  @ApiProperty({ example: 7.8804 })
  latitude: number;

  @ApiProperty({ example: 98.3923 })
  longitude: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  ownerId: string;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

class PaginatedFarmsDto {
  @ApiProperty({ type: [FarmDto] })
  data: FarmDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

@ApiTags('farms')
@Controller('farms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FarmController {
  constructor(private readonly farmService: FarmService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new farm' })
  @ApiBody({
    type: CreateFarmDto,
    examples: {
      example: {
        value: {
          name: 'Ocean View Shrimp Farm',
          description: 'Large coastal shrimp farm with 10 ponds',
          location: 'Coastal Road, Phuket',
          latitude: 7.8804,
          longitude: 98.3923,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Farm successfully created',
    type: FarmDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createFarmDto: CreateFarmDto, @Request() req) {
    return this.farmService.create(createFarmDto, req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all farms (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns all farms with pagination',
    type: PaginatedFarmsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.farmService.findAll(page, limit);
  }

  @Get('my-farms')
  @ApiOperation({ summary: 'Get farms belonging to the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns farms belonging to the current user with pagination',
    type: PaginatedFarmsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMine(
    @Request() req,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.farmService.findAllByUser(req.user.userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get farm by ID' })
  @ApiParam({
    name: 'id',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the farm with specified ID',
    type: FarmDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not found - farm does not exist' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
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
  @ApiOperation({ summary: 'Update farm' })
  @ApiParam({
    name: 'id',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateFarmDto,
    examples: {
      example: {
        value: {
          name: 'Updated Farm Name',
          description: 'Updated farm description',
          location: 'New location',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Farm successfully updated',
    type: FarmDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not found - farm does not exist' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
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
  @ApiOperation({ summary: 'Delete farm' })
  @ApiParam({
    name: 'id',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Farm successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Not found - farm does not exist' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const isAdmin = await this.userHasAdminRole(req.user.userId);

    if (isAdmin) {
      const farm = await this.farmService.findOne(id);
      return this.farmService.remove(id, farm.ownerId);
    }

    return this.farmService.remove(id, req.user.userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to farm' })
  @ApiParam({
    name: 'id',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: FarmMemberDto,
    examples: {
      example: {
        value: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Member successfully added to farm',
    type: FarmDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - farm or user does not exist',
  })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() memberDto: FarmMemberDto,
    @Request() req,
  ) {
    return this.farmService.addMember(id, memberDto.userId, req.user.userId);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from farm' })
  @ApiParam({
    name: 'id',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to remove',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Member successfully removed from farm',
    type: FarmDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - farm or user does not exist',
  })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
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
