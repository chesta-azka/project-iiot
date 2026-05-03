import { Machine } from '@prisma/client';
import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 🚀 REPORTS & ANALYTICS ENGINE - V3 ULTRA
 * Mencakup: 
 * 1. Deep Anomaly Detection (Hourly)
 * 2. Predictive Maintenance AI-ish (Weekly Trend Analysis)
 * 3. Professional Reporting (Excel & PDF with Styling)
 * 4. Automatic Storage Housekeeping (Cleanup old files)
 * 5. Multi-Page PDF Handling & Dynamic Styling
 */

@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportDir = path.join(process.cwd(), 'storage', 'reports');

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit() {
    this.ensureStorageReady();
  }

  /**
   * Helper: Pastiin folder storage ada, kalau gak ada dibuatin.
   */
  private ensureStorageReady() {
    if (!fs.existsSync(this.reportDir)) {
      try {
        fs.mkdirSync(this.reportDir, { recursive: true });
        this.logger.log(`✅ Storage reports siap di: ${this.reportDir}`);
      } catch (err) {
        this.logger.error('❌ Gagal membuat folder storage', err.stack);
      }
    }
  }

  // ======================================================
  // 1. LOGIKA ANALISIS & PREDIKSI (THE INTELLIGENCE)
  // ======================================================

  /**
   * Scan Tiap Jam: Deteksi Anomali Real-time.
   * Mesin yang mati/alarm lebih dari 5x dalam satu jam dianggap kritis.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyAnomalyDetection() {
    this.logger.log('🔍 [ANALYSIS] Memulai scan anomali mesin per jam...');
    const oneHourAgo = new Date(Date.now() - 3600000);

    const anomalies = await this.prisma.machineLog.groupBy({
      by: ['machineId'],
      where: {
        status: 0, // Alarm/Stop
        createdAt: { gte: oneHourAgo },
      },
      _count: { status: true },
    });

    for (const data of anomalies) {
      if (data._count.status > 5) {
        // FIX: Pake machineId sesuai schema lu
        const machine = await this.prisma.machine.findUnique({
          where: { machineId: data.machineId }
        });

        this.logger.warn(
          `🚨 CRITICAL ALERT: Mesin "${machine?.name || 'Unknown'}" tidak stabil! ` +
          `${data._count.status} kali STOP dalam 1 jam terakhir.`
        );
      }
    }
  }

  /**
   * Scan Harian: Prediksi Kerusakan Berdasarkan Tren (Trend Analysis).
   * Membandingkan data minggu ini vs minggu lalu.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async predictNextWeekFailures() {
    this.logger.log('🔮 [PREDICTION] Menghitung probabilitas breakdown minggu depan...');

    const machines: Machine[] = await this.prisma.machine.findMany();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    for (const machine of machines) {
      // 1. Hitung alarm minggu ini
      const recentAlarms = await this.prisma.machineLog.count({
        where: { machineId: machine.machineId, status: 0, createdAt: { gte: sevenDaysAgo } }
      });

      // 2. Hitung alarm minggu lalu
      const pastAlarms = await this.prisma.machineLog.count({
        where: {
          machineId: machine.machineId,
          status: 0,
          createdAt: { gte: fourteenDaysAgo, lte: sevenDaysAgo }
        }
      });

      // Logika Prediksi: Jika alarm naik > 50% atau rata-rata alarm harian tinggi
      if (recentAlarms > pastAlarms * 1.5 && recentAlarms > 10) {
        const trendIncrease = pastAlarms === 0 ? 100 : ((recentAlarms - pastAlarms) / pastAlarms) * 100;

        this.logger.error(
          `⚠️ PREDIKSI BREAKDOWN: Mesin ${machine.name} berisiko tinggi. ` +
          `Tren alarm naik ${trendIncrease.toFixed(1)}% dari periode sebelumnya.`
        );

        // Automasi: Buat jadwal maintenance otomatis
        await this.autoCreateMaintenanceTask(
          machine.machineId,
          `Auto-Maintenance: Tren anomali naik signifikan (${pastAlarms} -> ${recentAlarms} alarm).`
        );
      }
    }
  }

  private async autoCreateMaintenanceTask(machineId: string, desc: string) {
    try {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 3); // Set 3 hari ke depan

      await this.prisma.maintenanceSchedule.create({
        data: {
          machineId,
          description: `[SYSTEM_PREDICT] ${desc}`,
          scheduledAt: scheduledDate,
          isProcessed: false
        }
      });
      this.logger.log(`🛠️ Task maintenance otomatis dibuat untuk Machine: ${machineId}`);
    } catch (err) {
      this.logger.error(`❌ Gagal membuat auto-maintenance task: ${err.message}`);
    }
  }

  // ======================================================
  // 2. CORE LOGIC REPORTING (EXCEL & PDF ENGINE)
  // ======================================================

  /**
   * Fungsi utama untuk generate file laporan.
   */
  async generateReportLogic(format: 'excel' | 'pdf', saveToFile: boolean, range: string = 'day') {
    const startDate = this.calculateStartDate(range);

    // Ambil data dengan Join ke tabel Machine
    const logs = await this.prisma.machineLog.findMany({
      where: { createdAt: { gte: startDate } },
      include: { machine: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!logs || logs.length === 0) {
      this.logger.warn(`Laporan tidak dibuat karena data kosong untuk range: ${range}`);
      return null;
    }

    const timestamp = new Date().getTime();
    const fileName = `Report_IIOT_${range.toUpperCase()}_${timestamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    const fullPath = path.join(this.reportDir, fileName);

    try {
      if (format === 'excel') {
        return await this.buildExcel(logs, range, saveToFile ? fullPath : null);
      } else {
        return await this.buildPdf(logs, range, saveToFile ? fullPath : null);
      }
    } catch (err) {
      this.logger.error(`🔥 Gagal generate ${format}: ${err.message}`);
      throw new InternalServerErrorException('Gagal memproses file laporan.');
    }
  }

  private calculateStartDate(range: string): Date {
    const date = new Date();
    switch (range) {
      case 'hour': date.setHours(date.getHours() - 1); break;
      case 'day': date.setHours(0, 0, 0, 0); break; // Start dari jam 12 malem tadi
      case 'week': date.setDate(date.getDate() - 7); break;
      case 'month': date.setMonth(date.getMonth() - 1); break;
      default: date.setDate(date.getDate() - 1);
    }
    return date;
  }

  // ======================================================
  // 3. BUILDER: EXCEL (PROFESSIONAL GRADE)
  // ======================================================
  private async buildExcel(logs: any[], range: string, filePath: string | null) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Industrial Log Data');

    // Styling Header Utama
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `AQUA IIOT - LAPORAN PRODUKSI (${range.toUpperCase()})`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Define Columns
    sheet.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Waktu Kejadian', key: 'ts', width: 25 },
      { header: 'Nama Mesin', key: 'machine', width: 25 },
      { header: 'Total Counter', key: 'val', width: 15 },
      { header: 'Suhu (°C)', key: 'temp', width: 12 },
      { header: 'Status Operasional', key: 'stat', width: 20 },
      { header: 'Efisiensi', key: 'eff', width: 15 },
    ];

    // Styling Table Header
    sheet.getRow(2).font = { bold: true };
    sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };

    // Add Data Rows
    logs.forEach((log, index) => {
      const row = sheet.addRow({
        no: index + 1,
        ts: log.createdAt.toLocaleString('id-ID'),
        machine: log.machine?.name || 'N/A',
        val: log.counterValue,
        temp: log.temperature,
        stat: log.status === 1 ? 'RUNNING' : 'STOPPED/ALARM',
        eff: log.status === 1 ? '100%' : '0%'
      });

      // Conditional Formatting: Row merah jika mesin STOP
      if (log.status === 0) {
        row.eachCell((cell) => {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };
        });
      }
    });

    if (filePath) {
      await workbook.xlsx.writeFile(filePath);
      return filePath;
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ======================================================
  // 4. BUILDER: PDF (INDUSTRIAL CLEAN LAYOUT)
  // ======================================================
  private async buildPdf(logs: any[], range: string, filePath: string | null): Promise<Buffer | string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      if (filePath) {
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        stream.on('finish', () => resolve(filePath));
        doc.on('error', reject);
      } else {
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
      }

      // --- Header PDF ---
      doc.rect(0, 0, 600, 80).fill('#1F4E78');
      doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
        .text('AQUA PRODUCTION LOG', 40, 30);
      doc.fontSize(10).font('Helvetica')
        .text(`Periode: ${range.toUpperCase()} | Total Data: ${logs.length}`, 40, 55);

      doc.moveDown(4);
      doc.fillColor('black');

      // --- Table Header ---
      let y = 110;
      const tableHeaders = () => {
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('No', 40, y);
        doc.text('Waktu', 70, y);
        doc.text('Mesin', 220, y);
        doc.text('Counter', 380, y);
        doc.text('Temp', 450, y);
        doc.text('Status', 510, y);
        doc.moveTo(40, y + 15).lineTo(560, y + 15).stroke();
        doc.font('Helvetica').fontSize(9);
      };

      tableHeaders();
      y += 25;

      // --- Rows ---
      logs.forEach((log, i) => {
        // Auto-page break jika mau keluar halaman
        if (y > 750) {
          doc.addPage();
          y = 50;
          tableHeaders();
          y += 25;
        }

        doc.text((i + 1).toString(), 40, y);
        doc.text(log.createdAt.toLocaleString('id-ID', { hour12: false }), 70, y);
        doc.text(log.machine?.name?.substring(0, 20) || '-', 220, y);
        doc.text(log.counterValue.toString(), 380, y);
        doc.text(`${log.temperature}C`, 450, y);

        // Status Color
        const statusStr = log.status === 1 ? 'RUN' : 'STOP';
        doc.fillColor(log.status === 1 ? '#008000' : '#FF0000')
          .text(statusStr, 510, y)
          .fillColor('black');

        y += 18;
      });

      // Footer
      doc.fontSize(8).fillColor('grey')
        .text(`Generated by IIOT System at ${new Date().toLocaleString()}`, 40, 780, { align: 'center' });

      doc.end();
    });
  }

  // ======================================================
  // 5. HOUSEKEEPING & UTILS
  // ======================================================

  /**
   * Menghapus file laporan lama (> 30 hari) secara otomatis.
   * Dijalankan setiap hari Minggu jam 12 malam.
   */
  @Cron(CronExpression.EVERY_WEEKEND)
  async cleanupOldReports() {
    this.logger.log('🧹 [HOUSEKEEPING] Memulai pembersihan file laporan lama...');
    const files = fs.readdirSync(this.reportDir);
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(this.reportDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > THIRTY_DAYS) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    this.logger.log(`✅ Housekeeping selesai. ${deletedCount} file dihapus.`);
  }

  async getExistingReports() {
    try {
      const files = fs.readdirSync(this.reportDir);
      return files.map(f => {
        const stats = fs.statSync(path.join(this.reportDir, f));
        return {
          name: f,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          createdAt: stats.birthtime
        };
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (e) {
      return [];
    }
  }

  getFilePath(name: string) {
    const fullPath = path.join(this.reportDir, name);
    if (!fs.existsSync(fullPath)) throw new BadRequestException('File tidak ditemukan.');
    return fullPath;
  }

  /**
   * Auto Report generator setiap tengah malam.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoReportCron() {
    this.logger.log('🤖 [AUTO] Menjalankan Daily Report Generator...');
    await this.generateReportLogic('excel', true, 'day');
    await this.generateReportLogic('pdf', true, 'day');
  }
}