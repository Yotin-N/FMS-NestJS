import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    Request,
    ForbiddenException,
} from '@nestjs/common';
import { SensorThresholdService } from './sensor-threshold.service';
import { CreateSensorThresholdDto } from './dto/sensor-threshold.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FarmService } from '../farm/farm.service';
import { UserRole } from '../user/entities/user.entity';

@Controller('sensor-thresholds')
@UseGuards(JwtAuthGuard)
export class SensorThresholdController {
    constructor(
        private readonly thresholdService: SensorThresholdService,
        private readonly farmService: FarmService,
    ) { }

    @Get('farm/:farmId')
    async getFarmThresholds(@Param('farmId') farmId: string, @Request() req) {
        // Check farm access
        const isAdmin = await this.userHasAdminRole(req.user.userId);
        const isMember = await this.farmService.isUserMember(farmId, req.user.userId);

        if (!isAdmin && !isMember) {
            throw new ForbiddenException('No access to this farm');
        }

        return this.thresholdService.getThresholdsByFarm(farmId);
    }

    @Post('farm/:farmId/sensor/:sensorType')
    async upsertSensorThresholds(
        @Param('farmId') farmId: string,
        @Param('sensorType') sensorType: string,
        @Body() thresholds: CreateSensorThresholdDto[],
        @Request() req
    ) {
        // Check farm access
        const isAdmin = await this.userHasAdminRole(req.user.userId);
        const isMember = await this.farmService.isUserMember(farmId, req.user.userId);

        if (!isAdmin && !isMember) {
            throw new ForbiddenException('No access to this farm');
        }

        return this.thresholdService.upsertThresholds(farmId, sensorType, thresholds);
    }

    @Get('defaults/:sensorType')
    async getDefaultThresholds(@Param('sensorType') sensorType: string) {
        return this.thresholdService.getDefaultThresholds(sensorType);
    }

    private async userHasAdminRole(userId: string): Promise<boolean> {
        try {
            const user = await this.farmService['userService'].findById(userId);
            return user && user.role === UserRole.ADMIN;
        } catch (error) {
            return false;
        }
    }
}