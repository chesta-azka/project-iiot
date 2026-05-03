import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  HttpException,
  StreamableFile,
  Logger,
  ParseEnumPipe,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('IIOT Reports') // Label buat Swagger
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) { }

  /**
   * 1. DOWNLOAD LANGSUNG (ANTI-CORRUPT VERSION)
   * Dilengkapi pengecekan data agar tidak mengirim file kosong yang bikin corrupt
   */
  @Get('download')
  @ApiOperation({ summary: 'Download laporan langsung ke browser' })
  @ApiQuery({ name: 'format', enum: ['excel', 'pdf'] })
  @ApiQuery({ name: 'range', enum: ['hour', 'day', 'week', 'month'], required: false })
  async download(
    @Query('format') format: 'excel' | 'pdf' = 'excel',
    @Query('range') range: 'hour' | 'day' | 'week' | 'month' = 'day',
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      this.logger.log(`[DOWNLOAD] Memulai generate laporan ${format} periode ${range}...`);

      // Generate Buffer dari Service
      const buffer = await this.reportsService.generateReportLogic(format, false, range);

      // SAFETY CHECK: Kalau buffer null/kosong, jangan kirim file!
      if (!buffer || (buffer as any).length === 0) {
        this.logger.warn(`[DOWNLOAD] Data kosong untuk periode ${range}, membatalkan pengiriman file.`);
        throw new Error('DATA_EMPTY');
      }

      const actualBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';

      const mimeTypes = {
        pdf: 'application/pdf',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      // Set Header yang kuat biar browser gak bingung
      res.set({
        'Content-Type': format === 'pdf' ? mimeTypes.pdf : mimeTypes.excel,
        'Content-Disposition': `attachment; filename="AQUA_Report_${range}_${timestamp}.${ext}"`,
        'Content-Length': actualBuffer.length,
        'Cache-Control': 'no-cache', // Biar user dapet data terbaru terus
      });

      this.logger.log(`[DOWNLOAD] File ${format} berhasil dikirim (${actualBuffer.length} bytes).`);
      return new StreamableFile(actualBuffer);

    } catch (error) {
      if (error.message === 'DATA_EMPTY') {
        throw new HttpException(
          { status: 'error', message: 'Tidak ada data aktivitas mesin dalam periode tersebut.' },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.error(`[DOWNLOAD ERROR] ${error.message}`);
      throw new HttpException(
        { status: 'error', message: 'Gagal mendownload laporan', detail: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 2. MANUAL SAVE (FOR ARCHIVING)
   */
  @Get('manual-save')
  @ApiOperation({ summary: 'Generate dan simpan file di storage server' })
  async manualSave(
    @Query('format') format: 'excel' | 'pdf' = 'excel',
    @Query('range') range: 'hour' | 'day' | 'week' | 'month' = 'day',
  ) {
    try {
      const filePath = await this.reportsService.generateReportLogic(format, true, range);
      return {
        status: 'success',
        message: `Laporan ${format.toUpperCase()} periode ${range} tersimpan di server.`,
        data: { path: filePath, generatedAt: new Date() },
      };
    } catch (error) {
      throw new HttpException('Gagal memproses arsip laporan', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 3. SMART LIST (HISTORY)
   */
  @Get('list')
  @ApiOperation({ summary: 'Melihat riwayat file yang tersimpan di storage server' })
  async listFiles() {
    try {
      const reportDir = path.join(process.cwd(), 'storage', 'reports');

      if (!fs.existsSync(reportDir)) {
        return { status: 'empty', total: 0, files: [] };
      }

      const files = fs.readdirSync(reportDir)
        .filter(file => !file.startsWith('.')) // Abaikan hidden files
        .map((file) => {
          const stats = fs.statSync(path.join(reportDir, file));
          return {
            fileName: file,
            sizeRaw: stats.size,
            sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
            createdAt: stats.birthtime,
          };
        });

      return {
        status: 'success',
        total: files.length,
        files: files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      };
    } catch (error) {
      throw new HttpException('Gagal membaca history storage', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}