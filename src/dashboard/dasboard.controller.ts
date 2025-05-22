import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardSummary, SensorChartData, RealtimeDataPoint } from './types/dashboard.types';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get('farm/:farmId/summary')
  @ApiOperation({ summary: 'Get dashboard summary for a farm' })
  @ApiParam({
    name: 'farmId',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns dashboard summary including latest timestamp, sensor averages, and active sensor count',
  })
  async getDashboardSummary(@Param('farmId') farmId: string): Promise<DashboardSummary> {
    return this.dashboardService.getDashboardSummary(farmId);
  }

  @Get('farm/:farmId/sensor-data')
  @ApiOperation({ summary: 'Get sensor data for charts' })
  @ApiParam({
    name: 'farmId',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    description: 'Time range in hours (default: 24)',
    example: '24',
  })
  @ApiQuery({
    name: 'sensorType',
    required: false,
    description: 'Filter by sensor type',
    example: 'pH',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns time series data for sensor charts',
  })
  async getSensorData(
    @Param('farmId') farmId: string,
    @Query('timeRange') timeRange: string = '24',
    @Query('sensorType') sensorType?: string,
  ): Promise<SensorChartData[]> {
    const hours = parseInt(timeRange) || 24;
    return this.dashboardService.getSensorData(farmId, hours, sensorType);
  }

  @Get('farm/:farmId/sensor/:sensorType/realtime-data')
  @ApiOperation({ summary: 'Get real-time sensor data for charts' })
  @ApiParam({
    name: 'farmId',
    description: 'Farm ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'sensorType',
    description: 'Sensor type (e.g., pH, DO, Temperature)',
    example: 'pH',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date-time (ISO format)',
    example: '2023-10-27T10:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date-time (ISO format)',
    example: '2023-10-27T11:00:00.000Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns time series data for sensor charts',
  })
  async getSensorRealtimeData(
    @Param('farmId') farmId: string,
    @Param('sensorType') sensorType: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<RealtimeDataPoint[]> {
    return this.dashboardService.getSensorRealtimeData(
      farmId,
      sensorType,
      new Date(startDate),
      new Date(endDate),
    );
  }
}