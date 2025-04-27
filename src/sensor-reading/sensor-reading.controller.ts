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
  Query,
  Request,
  NotFoundException,
  ForbiddenException,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { SensorReadingService } from './sensor-reading.service';
import {
  CreateSensorReadingDto,
  UpdateSensorReadingDto,
} from './dto/create-sensor-reading.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
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
class SensorReadingDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  sensorId: string;

  @ApiProperty({ example: 7.2 })
  value: number;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  timestamp: Date;
}

class PaginatedReadingsDto {
  @ApiProperty({ type: [SensorReadingDto] })
  data: SensorReadingDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}

@ApiTags('readings')
@Controller('readings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SensorReadingController {
  constructor(private readonly sensorReadingService: SensorReadingService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all sensor readings (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiResponse({
    status: 200,
    description: 'Returns all sensor readings with pagination',
    type: PaginatedReadingsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
  ) {
    return this.sensorReadingService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get sensor reading by ID (admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Sensor Reading ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the sensor reading with specified ID',
    type: SensorReadingDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({
    status: 404,
    description: 'Not found - reading does not exist',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sensorReadingService.findOne(id);
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete old readings (admin only)' })
  @ApiQuery({
    name: 'olderThan',
    required: true,
    type: String,
    example: '2025-01-01T00:00:00.000Z',
    description: 'Date threshold - readings older than this will be deleted',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the number of deleted readings',
    schema: {
      properties: {
        deletedCount: {
          type: 'number',
          example: 1250,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin role' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date format',
  })
  async deleteOldReadings(@Query('olderThan') olderThan: string) {
    try {
      const date = new Date(olderThan);

      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }

      // This would be a new method in the SensorReadingService
      const deletedCount =
        await this.sensorReadingService.deleteOlderThan(date);

      return { deletedCount };
    } catch (error) {
      throw new Error(`Failed to delete old readings: ${error.message}`);
    }
  }
}
