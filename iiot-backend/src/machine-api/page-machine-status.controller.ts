import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RealTimeEngineService } from 'src/core-engine/engine/engine.service';
import { ShiftSummaryService } from 'src/core-engine/shift/shift-summary.service';

@ApiTags('Page - Machine Status')
@ApiBearerAuth()
@Controller('page-machine-status')
export class PageMachineStatusController {
  private readonly logger = new Logger(PageMachineStatusController.name);

  constructor(
    private readonly engineService: RealTimeEngineService,
    private readonly shiftSummaryService: ShiftSummaryService,
  ) {}

  @Get(':lineId/machines')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Mendapatkan daftar state mesin per line (Sesuai halaman Selengkapnya)',
  })
  @ApiParam({
    name: 'lineId',
    example: '1',
    description: 'ID Line Produksi',
  })
  @ApiResponse({ status: 200, description: 'Daftar mesin berhasil diambil.' })
  async getMachineStatuses(@Param('lineId') lineId: string) {
    this.logger.log(`Fetching Page Machine Statuses for ${lineId}`);
    const liveMachines = this.engineService.getAllTrackersWithId();

    const machineStatuses = await Promise.all(
      liveMachines.map(async (m) => {
        let statusCountText =
          m.upstCount > 0 ? `${m.upstCount} Stops` : 'Running';
        const shiftData = await this.shiftSummaryService.getCurrentShiftSummary(
          m.machineId,
        );
        const performa = shiftData?.shiftTotals?.pr || m.pr || 0;

        let uiStatus = m.status === 'RUNNING' ? 'RUN' : 'STOP';
        if (m.status !== 'RUNNING' && m.latestAlarmCode) uiStatus = 'WARNING';

        return {
          machineId: m.machineId,
          machineName: m.machineName,
          status: uiStatus,
          statusCount: statusCountText, // Data pop-up
          performance: performa, // Data pop-up
        };
      }),
    );

    return {
      success: true,
      data: {
        lineId,
        machines: machineStatuses,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
