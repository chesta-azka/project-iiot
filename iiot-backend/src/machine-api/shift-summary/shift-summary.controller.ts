import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ShiftSummaryService } from '../../core-engine/shift/shift-summary.service';

@ApiTags('Shift Summary')
@ApiBearerAuth()
@Controller('shift-summary')
export class ShiftSummaryController {
  private readonly logger = new Logger(ShiftSummaryController.name);

  constructor(private readonly shiftSummaryService: ShiftSummaryService) { }

  // ─── GET /shift-summary/current ────────────────────────────────────────────

  @Get('current')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'machineId', required: false, description: 'Filter spesifik ID mesin (contoh: AQ-BLW-01)' })
  @ApiOperation({
    summary: 'Shift aktif saat ini — UPDT(MIN), UPST(FREQ), PDT(MIN), PR per jam',
    description:
      'Mengembalikan ringkasan metrik setiap jam kerja (JAM KE 1–8) untuk shift yang sedang berjalan. ' +
      'PR = 100% − PDT% − UPDT%, dihitung dari data Downtime real-time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shift summary saat ini berhasil diambil',
    schema: {
      example: {
        shift: 'Shift 2',
        shiftNumber: 2,
        date: '2026-04-17',
        shiftStart: '14:00',
        shiftEnd: '22:00',
        totalShiftMinutes: 480,
        hours: [
          { jamKe: 1, timeRange: '14:00-15:00', updtMin: 8, upstFreq: 2, pdtMin: 0, pr: 86.67 },
          { jamKe: 2, timeRange: '15:00-16:00', updtMin: 10, upstFreq: 1, pdtMin: 0, pr: 83.33 },
        ],
        shiftTotals: {
          totalUpdtMin: 73,
          totalPdtMin: 0,
          totalUpstFreq: 8,
          updtPercent: 15.21,
          pdtPercent: 0,
          pr: 84.79,
        },
      },
    },
  })
  async getCurrentShift(@Query('machineId') machineId?: string) {
    this.logger.log(`[ShiftSummary] GET /current${machineId ? ` (Machine: ${machineId})` : ''}`);
    const data = await this.shiftSummaryService.getCurrentShiftSummary(machineId);
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  // ─── GET /shift-summary/shift/:shiftNumber ─────────────────────────────────

  @Get('shift/:shiftNumber')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'machineId', required: false, description: 'Filter spesifik ID mesin (contoh: AQ-BLW-01)' })
  @ApiOperation({
    summary: 'Ringkasan shift tertentu (1 / 2 / 3)',
    description:
      'Ambil UPDT, UPST, PDT, dan PR per jam untuk shift yang dipilih. ' +
      'Shift 1 = 06:00–14:00 | Shift 2 = 14:00–22:00 | Shift 3 = 22:00–06:00.',
  })
  @ApiParam({
    name: 'shiftNumber',
    type: Number,
    description: 'Nomor shift: 1, 2, atau 3',
    example: 2,
  })
  @ApiResponse({ status: 200, description: 'Data shift berhasil diambil' })
  @ApiResponse({ status: 400, description: 'Nomor shift tidak valid (harus 1–3)' })
  async getShiftByNumber(
    @Param('shiftNumber', ParseIntPipe) shiftNumber: number,
    @Query('machineId') machineId?: string,
  ) {
    if (![1, 2, 3].includes(shiftNumber)) {
      throw new BadRequestException('Nomor shift harus 1, 2, atau 3');
    }
    this.logger.log(`[ShiftSummary] GET /shift/${shiftNumber}${machineId ? ` (Machine: ${machineId})` : ''}`);
    const data = await this.shiftSummaryService.getShiftSummaryByNumber(shiftNumber, machineId);
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  // ─── GET /shift-summary/daily ──────────────────────────────────────────────

  @Get('daily')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'machineId', required: false, description: 'Filter spesifik ID mesin (contoh: AQ-BLW-01)' })
  @ApiOperation({
    summary: 'Agregasi harian — gabungan 3 shift (Shift 1 + 2 + 3)',
    description:
      'Mengembalikan performa harian dengan breakdown per shift dan total daily. ' +
      'Cocok untuk tabel Daily Summary di PPT. ' +
      'PR Daily = 100% − PDT_daily% − UPDT_daily%.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily summary berhasil dikompilasi',
    schema: {
      example: {
        date: '2026-04-17',
        shifts: [
          { shift: 'Shift 1', shiftNumber: 1, pr: 75.42, pdtMin: 45, pdtPercent: 9.38, updtMin: 73, updtPercent: 15.21, upstFreq: 8, hours: [] },
          { shift: 'Shift 2', shiftNumber: 2, pr: 84.79, pdtMin: 0, pdtPercent: 0, updtMin: 73, updtPercent: 15.21, upstFreq: 8, hours: [] },
          { shift: 'Shift 3', shiftNumber: 3, pr: 84.79, pdtMin: 0, pdtPercent: 0, updtMin: 73, updtPercent: 15.21, upstFreq: 8, hours: [] },
        ],
        daily: {
          pr: 81.67,
          pdtMin: 45,
          pdtPercent: 3.13,
          updtMin: 219,
          updtPercent: 15.21,
          upstFreq: 24,
        },
      },
    },
  })
  async getDailySummary(@Query('machineId') machineId?: string) {
    this.logger.log(`[ShiftSummary] GET /daily${machineId ? ` (Machine: ${machineId})` : ''}`);
    const data = await this.shiftSummaryService.getDailySummary(machineId);
    return { success: true, timestamp: new Date().toISOString(), data };
  }
}
