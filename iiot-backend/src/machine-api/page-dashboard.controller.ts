import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RealTimeEngineService } from 'src/core-engine/engine/engine.service';
import { MachineHistoryService } from './machine-history/machine-history.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user/user.entity';

@ApiTags('Page - Dashboard')
@ApiBearerAuth()
//@UseGuards(JwtAuthGuard, RolesGuard) // Buka ini nanti jika ingin di secure
@Controller('page-dashboard')
export class PageDashboardController {
  private readonly logger = new Logger(PageDashboardController.name);

  constructor(
    private readonly engineService: RealTimeEngineService,
    private readonly historyService: MachineHistoryService,
  ) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  //@Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Mendapatkan data awal Dashboard (Total, Active, Stopped, Notifications)',
  })
  @ApiResponse({ status: 200, description: 'Summary data berhasil diambil.' })
  async getDashboardSummary() {
    this.logger.log('Fetching Page Dashboard Summary');
    const liveMachines = this.engineService.getAllTrackersWithId();

    const runningCount = liveMachines.filter(
      (m) => m.status === 'RUNNING',
    ).length;
    const stoppedCount = liveMachines.filter(
      (m) => m.status === 'STOPPED',
    ).length;
    const notifications =
      (await this.historyService.getTopBreakdownReasons()) || [];

    return {
      success: true,
      data: {
        totalMachines: liveMachines.length,
        runningMachines: runningCount,
        stoppedMachines: stoppedCount,
        notifications: notifications,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
