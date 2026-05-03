import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService implements OnModuleInit {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportDir = path.join(process.cwd(), 'storage', 'reports');

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit() {
    // Memastikan folder storage siap pakai saat aplikasi running
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
      this.logger.log(
        `📁 Folder laporan berhasil dibuat di: ${this.reportDir}`,
      );
    }
  }

  // ======================================================
  // 1. CRON JOB: AUTOMATED DAILY REPORT (Excel)
  // ======================================================
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutomatedDailyReport() {
    this.logger.log(
      '🚀 [CRON] Menjalankan pembuatan laporan harian otomatis...',
    );
    try {
      const filePath = (await this.generateReportLogic(
        'excel',
        true,
      )) as string;
      this.logger.log(
        `✅ [CRON] Laporan harian berhasil disimpan: ${filePath}`,
      );
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
          const machine = await this.prisma.machine.findUnique({
            where: { id: data.machineId },
          });
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
  async generateReportLogic(
    format: 'excel' | 'pdf',
    saveToFile: boolean,
    range: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    const startDate = new Date();

    // Logic dinamis berdasarkan range
    if (range === 'hour') startDate.setHours(startDate.getHours() - 1);
    else if (range === 'day') startDate.setHours(0, 0, 0, 0);
    else if (range === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (range === 'month') startDate.setMonth(startDate.getMonth() - 1);

    const logs = await this.prisma.machineLog.findMany({
      where: { createdAt: { gte: startDate } },
      include: { machine: true },
      orderBy: { createdAt: 'asc' },
    });

    // Jika data kosong, langsung return null (biar ditangkep safety check di Controller)
    if (logs.length === 0) return null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `AQUA_Report_${range}_${timestamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
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

    // 1. Tambahkan Header Utama (Branding)
    sheet.mergeCells('A1:F1');
    const mainTitle = sheet.getCell('A1');
    mainTitle.value = 'AQUA IIOT - INDUSTRIAL PRODUCTION REPORT';
    mainTitle.font = { name: 'Arial Black', size: 16, color: { argb: 'FFFFFFFF' } };
    mainTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    mainTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' } // Biru Gelap Professional
    };
    sheet.getRow(1).height = 40;

    // 2. Definisi Kolom & Header Tabel
    sheet.columns = [
      { header: 'NO', key: 'no', width: 8 },
      { header: 'WAKTU SINYAL', key: 'time', width: 30 },
      { header: 'NAMA MESIN', key: 'name', width: 25 },
      { header: 'COUNTER PRODUKSI', key: 'count', width: 20 },
      { header: 'SUHU (°C)', key: 'temp', width: 15 },
      { header: 'STATUS OPERASIONAL', key: 'status', width: 25 },
    ];

    // Styling Header Tabel (Baris ke-2)
    const headerRow = sheet.getRow(2);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E75B6' } // Biru Terang
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 3. Inject Data
    logs.forEach((log, index) => {
      const row = sheet.addRow({
        no: index + 1,
        time: log.createdAt.toLocaleString('id-ID'),
        name: log.machine?.name || 'Unknown',
        count: log.counterValue,
        temp: `${log.temperature}°C`,
        status: log.status === 1 ? '✅ RUNNING' : '🚨 STOP/ALARM',
      });

      // Styling Baris Data (Zebra Cross & Alignment)
      row.alignment = { vertical: 'middle', horizontal: 'center' };

      // Warna selang-seling (abu-abu muda banget)
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        });
      }

      // Border untuk setiap cell data
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        };
      });

      // 4. Colorize Status Cell Spesifik
      const statusCell = row.getCell(6);
      if (log.status === 1) {
        statusCell.font = { color: { argb: 'FF008000' }, bold: true }; // Hijau
      } else {
        statusCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Merah
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE6E6' } // Background merah muda tipis kalo error
        };
      }
    });

    // 5. Simpan atau Kirim Buffer
    if (filePath) {
      await workbook.xlsx.writeFile(filePath);
      return filePath;
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ======================================================
  // 6. HELPER: PDF BUILDER
  // ======================================================
  private buildPdf(
    logs: any[],
    filePath: string | null,
  ): Promise<Buffer | string> {
    return new Promise((resolve, reject) => {
      // Gunakan margin yang konsisten
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      // ── Setup Output ──────────────────────────────────────────────────────
      if (filePath) {
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        doc.on('error', reject);
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
      } else {
        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
      }

      // ── Helper: Header Tabel (Biar bisa dipanggil tiap ganti halaman) ──────
      const drawTableHeader = (y: number) => {
        doc.rect(40, y - 5, 515, 20).fill('#2c3e50'); // Background header
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);

        doc.text('No', 45, y);
        doc.text('Waktu (WIB)', 75, y);
        doc.text('Nama Mesin', 215, y);
        doc.text('Counter', 360, y, { width: 60, align: 'center' });
        doc.text('Suhu', 440, y, { width: 40, align: 'center' });
        doc.text('Status', 500, y, { width: 50, align: 'center' });

        return y + 20; // Kembalikan posisi Y setelah header
      };

      // ── PDF Content ──────────────────────────────────────────────────────
      // Title Branding
      doc.fillColor('#2c3e50').fontSize(18).font('Helvetica-Bold')
        .text('AQUA IIOT PRODUCTION REPORT', { align: 'left' });

      doc.fontSize(9).font('Helvetica').fillColor('#7f8c8d')
        .text(`Generated on: ${new Date().toLocaleString('id-ID')}`, { align: 'left' });
      doc.moveDown(2);

      let currentY = doc.y;
      currentY = drawTableHeader(currentY);

      // ── Table Rows ──────────────────────────────────────────────────────
      logs.forEach((log, i) => {
        // Check if we need a new page (halaman baru)
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          currentY = drawTableHeader(currentY);
        }

        // Zebra striping (warna selang-seling tipis)
        if (i % 2 === 0) {
          doc.rect(40, currentY - 2, 515, 15).fill('#f9f9f9');
        }

        doc.fillColor('#2c3e50').font('Helvetica').fontSize(8);

        // Data Columns
        doc.text((i + 1).toString(), 45, currentY);
        doc.text(new Date(log.createdAt).toLocaleString('id-ID'), 75, currentY);
        doc.text(log.machine?.name?.substring(0, 25) || 'N/A', 215, currentY);
        doc.text(log.counterValue.toString(), 360, currentY, { width: 60, align: 'center' });
        doc.text(`${log.temperature}°C`, 440, currentY, { width: 40, align: 'center' });

        // Status dengan warna & posisi aman
        const statusText = log.status === 1 ? 'RUNNING' : 'STOPPED';
        const statusColor = log.status === 1 ? '#27ae60' : '#e74c3c';

        doc.fillColor(statusColor).font('Helvetica-Bold')
          .text(statusText, 500, currentY, { width: 50, align: 'center' });

        // Border bawah tipis
        currentY += 15;
        doc.moveTo(40, currentY - 2).lineTo(555, currentY - 2)
          .strokeColor('#eeeeee').lineWidth(0.5).stroke();
      });

      // Footer Page Number
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#bdc3c7').fontSize(7)
          .text(`Halaman ${i + 1} dari ${range.count}`, 40, 800, { align: 'center' });
      }

      doc.end();
    });
  }

  // ======================================================
  // 7. ADDITIONAL UTILITY: GET REPORTS LIST
  // ======================================================
  async getExistingReports() {
    try {
      const files = fs.readdirSync(this.reportDir);
      return files
        .map((file) => ({
          fileName: file,
          size: fs.statSync(path.join(this.reportDir, file)).size,
          createdAt: fs.statSync(path.join(this.reportDir, file)).birthtime,
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (err) {
      this.logger.error('Gagal mengambil daftar file laporan', err.stack);
      return [];
    }
  }
}
