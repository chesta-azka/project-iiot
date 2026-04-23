import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportDir = path.join(process.cwd(), 'storage', 'reports');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Memastikan folder storage siap pakai saat aplikasi running
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
      this.logger.log(`📁 Folder laporan berhasil dibuat di: ${this.reportDir}`);
    }
  }

  // ======================================================
  // 1. CRON JOB: AUTOMATED DAILY REPORT (Excel)
  // ======================================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutomatedDailyReport() {
    this.logger.log('🚀 [CRON] Menjalankan pembuatan laporan harian otomatis...');
    try {
      const path = await this.generateReportLogic('excel', true);
      this.logger.log(`✅ [CRON] Laporan harian berhasil disimpan: ${path}`);
    } catch (err) {
      this.logger.error('❌ [CRON] Gagal membuat laporan otomatis', err.stack);
    }
  }

  // ======================================================
  // 2. CRON JOB: FAILURE PREDICTION (Analisis Tiap Jam)
  // ======================================================
  @Cron(CronExpression.EVERY_HOUR)
  async runFailurePrediction() {
    this.logger.log('🔍 [ANALYSIS] Memulai scan anomali mesin...');
    try {
      const oneHourAgo = new Date(Date.now() - 3600000);
      
      // Ambil data mesin yang sering mati/alarm dalam 1 jam terakhir
      const anomalies = await this.prisma.machineLog.groupBy({
        by: ['machineId'],
        where: {
          status: 0, // 0 = Alarm / Stop
          createdAt: { gte: oneHourAgo },
        },
        _count: { status: true },
      });

      for (const data of anomalies) {
        const count = data._count.status;
        if (count > 5) {
          const machine = await this.prisma.machine.findUnique({ where: { id: data.machineId } });
          this.logger.warn(
            `⚠️ ALERT: Mesin "${machine?.name || data.machineId}" terdeteksi tidak stabil! (${count} stop dalam 1 jam).`,
          );
          // TODO: Bisa diintegrasikan dengan Bot Telegram di sini
        }
      }
    } catch (err) {
      this.logger.error('❌ Gagal menjalankan failure prediction', err.stack);
    }
  }

  // ======================================================
  // 3. CRON JOB: PREVENTIVE MAINTENANCE SCHEDULE
  // ======================================================
  @Cron('0 0 7 * * *')
  async handleMaintenanceSchedule() {
    this.logger.log('📅 [SCHEDULE] Memeriksa jadwal maintenance hari ini...');
    try {
      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const endOfToday = new Date(now.setHours(23, 59, 59, 999));

      const schedules = await this.prisma.maintenanceSchedule.findMany({
        where: {
          scheduledAt: { gte: startOfToday, lte: endOfToday },
          isProcessed: false,
        },
        include: { machine: true },
      });

      if (schedules.length === 0) {
        this.logger.log('ℹ️ Tidak ada jadwal maintenance untuk hari ini.');
        return;
      }

      for (const task of schedules) {
        this.logger.warn(
          `🛠️ PENGINGAT MAINTENANCE: Mesin ${task.machine?.name} - Deskripsi: ${task.description}`,
        );
        
        // Tandai sudah diproses agar tidak muncul di scan berikutnya
        await this.prisma.maintenanceSchedule.update({
          where: { id: task.id },
          data: { isProcessed: true },
        });
      }
    } catch (err) {
      this.logger.error('❌ Gagal memproses jadwal maintenance', err.stack);
    }
  }

  // ======================================================
  // 4. CORE LOGIC: GENERATE REPORT (Bisa Manual Via API)
  // ======================================================
  async generateReportLogic(format: 'excel' | 'pdf', saveToFile: boolean) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const logs = await this.prisma.machineLog.findMany({
      where: { createdAt: { gte: yesterday } },
      include: { machine: true },
      orderBy: { createdAt: 'asc' },
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `Report-${timestamp}-${Math.floor(Math.random() * 1000)}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    const fullPath = path.join(this.reportDir, fileName);

    if (format === 'excel') {
      return await this.buildExcel(logs, saveToFile ? fullPath : null);
    } else {
      return await this.buildPdf(logs, saveToFile ? fullPath : null);
    }
  }

  // ======================================================
  // 5. HELPER: EXCEL BUILDER
  // ======================================================
  private async buildExcel(logs: any[], filePath: string | null) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laporan Produksi IIoT');

    // Styling Header
    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Waktu Sinyal', key: 'time', width: 25 },
      { header: 'Nama Mesin', key: 'name', width: 20 },
      { header: 'Counter Produksi', key: 'count', width: 15 },
      { header: 'Suhu (°C)', key: 'temp', width: 12 },
      { header: 'Status Operasional', key: 'status', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Inject Data
    logs.forEach((log, index) => {
      sheet.addRow({
        no: index + 1,
        time: log.createdAt.toLocaleString('id-ID'),
        name: log.machine?.name || 'Unknown',
        count: log.counterValue,
        temp: log.temperature,
        status: log.status === 1 ? 'RUNNING' : 'STOP/ALARM',
      });
    });

    // Colorize status
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const statusCell = row.getCell(6);
        if (statusCell.value === 'STOP/ALARM') {
          statusCell.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else {
          statusCell.font = { color: { argb: 'FF008000' } };
        }
      }
    });

    if (filePath) {
      await workbook.xlsx.writeFile(filePath);
      return filePath;
    }
    return await workbook.xlsx.writeBuffer();
  }

  // ======================================================
  // 6. HELPER: PDF BUILDER
  // ======================================================
  private async buildPdf(logs: any[], filePath: string | null): Promise<Buffer | string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      let buffers: Buffer[] = [];

      if (filePath) {
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
      } else {
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      }

      // PDF Styling
      doc.fillColor('#2c3e50').fontSize(20).text('AQUA IIOT PRODUCTION REPORT', { align: 'center' });
      doc.fontSize(10).text(`Periode: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();
      doc.moveTo(50, 100).lineTo(550, 100).stroke();
      doc.moveDown();

      // Table Header Manual
      const tableTop = 130;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('No', 50, tableTop);
      doc.text('Timestamp', 80, tableTop);
      doc.text('Mesin', 230, tableTop);
      doc.text('Counter', 350, tableTop);
      doc.text('Temp', 430, tableTop);
      doc.text('Status', 500, tableTop);
      doc.font('Helvetica');

      let currentY = tableTop + 20;

      // Table Rows
      logs.forEach((log, i) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }

        doc.fontSize(8);
        doc.text((i + 1).toString(), 50, currentY);
        doc.text(log.createdAt.toISOString(), 80, currentY);
        doc.text(log.machine?.name || 'N/A', 230, currentY);
        doc.text(log.counterValue.toString(), 350, currentY);
        doc.text(`${log.temperature}°C`, 430, currentY);
        doc.text(log.status === 1 ? 'RUN' : 'STOP', 500, currentY);

        currentY += 15;
        doc.moveTo(50, currentY - 2).lineTo(550, currentY - 2).strokeColor('#ecf0f1').lineWidth(0.5).stroke().strokeColor('#000');
      });

      doc.end();
    });
  }

  // ======================================================
  // 7. ADDITIONAL UTILITY: GET REPORTS LIST
  // ======================================================
  async getExistingReports() {
    try {
      const files = fs.readdirSync(this.reportDir);
      return files.map(file => ({
        fileName: file,
        size: fs.statSync(path.join(this.reportDir, file)).size,
        createdAt: fs.statSync(path.join(this.reportDir, file)).birthtime
      })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (err) {
      this.logger.error('Gagal mengambil daftar file laporan', err.stack);
      return [];
    }
  }
}