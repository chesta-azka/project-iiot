import { Controller, Get, Query, Res, HttpStatus, HttpException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * 1. TRIGGER MANUAL SAVE KE SERVER
   * URL: GET /reports/manual-save?format=excel atau ?format=pdf
   */
  @Get('manual-save')
  async manualSave(@Query('format') format: 'excel' | 'pdf' = 'excel') {
    try {
      const filePath = await this.reportsService.generateReportLogic(format, true);
      return {
        statusCode: HttpStatus.OK,
        message: `Laporan ${format.toUpperCase()} berhasil disimpan di server.`,
        path: filePath,
      };
    } catch (error) {
      throw new HttpException('Gagal menyimpan laporan di server', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 2. DOWNLOAD LANGSUNG KE BROWSER
   * URL: GET /reports/download?format=excel atau ?format=pdf
   */
  @Get('download')
  async download(@Query('format') format: 'excel' | 'pdf' = 'excel', @Res() res: Response) {
    try {
      // Kita set saveToFile = false supaya dapet Buffer
      const buffer = await this.reportsService.generateReportLogic(format, false);

      const timestamp = new Date().getTime();
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const contentType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="Report_${timestamp}.${ext}"`,
        'Content-Length': (buffer as Buffer).length,
      });

      return res.end(buffer);
    } catch (error) {
      // Karena kita pake @Res, NestJS ga bisa auto-handle error, jadi kita handle manual
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Gagal mendownload laporan',
        error: error.message,
      });
    }
  }

  /**
   * 3. LIST SEMUA LAPORAN DI SERVER (BONUS)
   * URL: GET /reports/list
   */
  @Get('list')
  async listFiles() {
    const reportDir = path.join(process.cwd(), 'storage', 'reports');
    
    if (!fs.existsSync(reportDir)) {
      return { files: [] };
    }

    const files = fs.readdirSync(reportDir).map(file => {
      const stats = fs.statSync(path.join(reportDir, file));
      return {
        fileName: file,
        size: `${(stats.size / 1024).toFixed(2)} KB`,
        createdAt: stats.birthtime,
      };
    });

    return { 
      total: files.length,
      files: files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) 
    };
  }
}