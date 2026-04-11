import { Controller, Get, Query, UseGuards, Logger, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user/user.entity';

// Import Services
import { RealTimeEngineService } from '../../core-engine/engine/engine.service';
import { MachineHistoryService } from '../machine-history/machine-history.service';
import { InfluxAnalyticsService } from '../../database/influx/influx-analytics.service';

@ApiTags('Machine Analytics')
@ApiBearerAuth()
//@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('machine-analytics')
export class MachineAnalyticsController {
        private readonly logger = new Logger(MachineAnalyticsController.name);

        constructor(
                private readonly engineService: RealTimeEngineService,
                private readonly historyService: MachineHistoryService,
                private readonly influxAnalyticsService: InfluxAnalyticsService,
        ) { }

        /**
         * DASHBOARD SUMMARY
         * Menggabungkan data LIVE dari Engine dan data HISTORICAL dari Postgres
         */
        @Get('dashboard-summary')
        @HttpCode(HttpStatus.OK)
        @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER)
        @ApiOperation({ summary: 'Ringkasan performa seluruh line produksi (Live + Stats)' })
        @ApiResponse({ status: 200, description: 'Summary data berhasil dikompilasi' })
        async getDashboardSummary() {
                this.logger.log('Generating production line summary...');

                // Ambil data Real-Time dari Memory (Engine)
                const liveMachines = this.engineService.getAllTrackersWithId();

                // Ambil data Statistik dari Postgres (Top Errors & Downtime)
                const topErrors = await this.historyService.getTopBreakdownReasons() || [];
                const todayStats = await this.historyService.getLineSummary() as any;

                return {
                        success: true,
                        timestamp: new Date().toISOString(),
                        lineStatus: {
                                total: liveMachines.length,
                                running: liveMachines.filter((m) => m.status === 'RUNNING').length,
                                stopped: liveMachines.filter((m) => m.status === 'STOPPED').length,
                        },
                        machines: liveMachines,
                        analytics: {
                                topBreakdownReasons: topErrors,
                                mostFrequentError: topErrors[0]?.errorMessage || 'No issues detected',
                                totalDowntimeMinutes: todayStats.data?.reduce((acc: number, m: any) => acc + (m.totalDowntimeMinutes || 0), 0) || 0,
                        },
                };
        }

        /**
         * PRODUCTION TREND
         * Mengambil data time-series dari InfluxDB untuk grafik (Chart.js/ApexCharts)
         */
        @Get('trend')
        @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER)
        @ApiOperation({ summary: 'Mendapatkan trend produksi/telemetri dari InfluxDB' })
        @ApiQuery({ name: 'machineId', required: true, example: 'FILLER-01' })
        @ApiQuery({ name: 'range', required: false, example: '-1h', description: 'Range waktu (e.g. -1h, -24h, -7d)' })
        async getTrend(
                @Query('machineId') machineId: string,
                @Query('range') range: string = '-1h',
                @Query('window') window: string = '1m',
        ) {
                this.logger.log(`Fetching trend analytics for: ${machineId}`);
                return await this.influxAnalyticsService.getProductionTrend(machineId, range, window);
        }

        /**
         * MTBF (Mean Time Between Failures)
         * Menghitung nilai keandalan mesin dalam 24 jam terakhir
         */
        @Get('mtbf')
        @Roles(UserRole.OPERATOR, UserRole.SUPERVISOR, UserRole.MANAGER)
        @ApiOperation({ summary: 'Mendapatkan metrik MTBF untuk 24 jam terakhir' })
        @ApiQuery({ name: 'machineId', required: false, example: 'FILLER-01' })
        @ApiResponse({ status: 200, description: 'Data MTBF berhasil dihitung' })
        async getMTBF(
                @Query('machineId') machineId?: string,
        ) {
                this.logger.log(`Calculating MTBF for: ${machineId || 'ALL_MACHINES'}`);
                const data = await this.historyService.getMTBFMetrics(machineId);
                return {
                        success: true,
                        data
                };
        }
}