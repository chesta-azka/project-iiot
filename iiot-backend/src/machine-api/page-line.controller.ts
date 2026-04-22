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
import { InfluxAnalyticsService } from 'src/database/influx/influx-analytics.service';

@ApiTags('Page - Line View')
@ApiBearerAuth()
@Controller('page-line')
export class PageLineController {
  private readonly logger = new Logger(PageLineController.name);

  constructor(
    private readonly engineService: RealTimeEngineService,
    private readonly influxService: InfluxAnalyticsService,
  ) {}

  @Get(':lineId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mendapatkan status agregat Line (RUN/STOP) untuk master button',
  })
  @ApiParam({
    name: 'lineId',
    example: '1',
    description: 'ID Line Produksi',
  })
  @ApiResponse({ status: 200, description: 'Line status berhasil diambil.' })
  getLineStatus(@Param('lineId') lineId: string) {
    this.logger.log(`Fetching Page Line Status for ${lineId}`);
    const liveMachines = this.engineService.getAllTrackersWithId();

    // Asumsi: jika ada mesin yang RUNNING, maka line dibilang RUN, dsb
    const runningCount = liveMachines.filter(
      (m) => m.status === 'RUNNING',
    ).length;
    const uiStatus =
      runningCount > 0 || liveMachines.length === 0 ? 'RUN' : 'STOP';

    return {
      success: true,
      data: {
        lineId,
        status: uiStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':lineId/chart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Mendapatkan data inisial chart yang dinamis agar sesuai pergerakannya',
  })
  @ApiParam({
    name: 'lineId',
    example: '1',
    description: 'ID Line Produksi',
  })
  @ApiResponse({ status: 200, description: 'Chart data berhasil diambil.' })
  async getLineChart(@Param('lineId') lineId: string) {
    this.logger.log(`Fetching Page Line Chart for ${lineId}`);
    // Karena saat ini Influx mengambil per mesin, bisa kita aggregasi atau kembalikan trend keseluruhan
    // Di sini kita bisa panggil influxService, atau cukup return info chart

    // Sebagai mock untuk line level chart history (karena influx spesifik ke machine)
    const trend = await this.influxService
      .getProductionTrend('AQ-BLW-01', '-1h', '5m')
      .catch(() => []);

    return {
      success: true,
      data: {
        lineId,
        chartData: trend,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
