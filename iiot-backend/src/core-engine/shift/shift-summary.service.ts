import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShiftService, ShiftDefinition, HourWindow } from './shift.service';
import { RealTimeEngineService } from '../engine/engine.service';

// ─── Response shapes ────────────────────────────────────────────────────────

export interface HourMetrics {
  jamKe: number;
  timeRange: string;
  updtMin: number;   // Unplanned Downtime menit
  upstFreq: number;  // Frekuensi stop tak terencana
  pdtMin: number;    // Planned Downtime menit
  pr: number;        // Performance Rate (%)
}

export interface ShiftSummaryResult {
  shift: string;
  shiftNumber: number;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  totalShiftMinutes: number;
  hours: HourMetrics[];
  shiftTotals: {
    totalUpdtMin: number;
    totalPdtMin: number;
    totalUpstFreq: number;
    updtPercent: number;
    pdtPercent: number;
    pr: number;
  };
}

export interface DailySummaryResult {
  date: string;
  shifts: {
    shift: string;
    shiftNumber: number;
    pr: number;
    pdtMin: number;
    pdtPercent: number;
    updtMin: number;
    updtPercent: number;
    upstFreq: number;
    hours: HourMetrics[];
  }[];
  daily: {
    pr: number;
    pdtMin: number;
    pdtPercent: number;
    updtMin: number;
    updtPercent: number;
    upstFreq: number;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ShiftSummaryService {
  private readonly logger = new Logger(ShiftSummaryService.name);
  private readonly SHIFT_MINUTES = 480; // 8 jam × 60 menit
  private readonly HOUR_MINUTES = 60;
  private hasAutoSeededToday = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftService: ShiftService,
    private readonly engineService: RealTimeEngineService,
  ) {}

  // ─── PUBLIC API ────────────────────────────────────────────────────────────

  /** Shift yang sedang aktif (real-time) */
  async getCurrentShiftSummary(machineId?: string): Promise<ShiftSummaryResult> {
    await this.checkAndAutoSeedToday();
    const currentShift = this.shiftService.getCurrentShift();
    return this.buildShiftSummary(currentShift, machineId);
  }

  /** Shift tertentu berdasarkan nomor (1/2/3) */
  async getShiftSummaryByNumber(shiftNumber: number, machineId?: string): Promise<ShiftSummaryResult> {
    await this.checkAndAutoSeedToday();
    const shift = this.shiftService.getShiftByNumber(shiftNumber);
    if (!shift) throw new Error(`Shift ${shiftNumber} tidak ditemukan`);
    return this.buildShiftSummary(shift, machineId);
  }

  /** Agregasi harian dari 3 shift */
  async getDailySummary(machineId?: string): Promise<DailySummaryResult> {
    await this.checkAndAutoSeedToday();
    const today = new Date().toISOString().split('T')[0];

    const shiftResults = await Promise.all([
      this.buildShiftSummary(this.shiftService.SHIFTS[0], machineId),
      this.buildShiftSummary(this.shiftService.SHIFTS[1], machineId),
      this.buildShiftSummary(this.shiftService.SHIFTS[2], machineId),
    ]);

    const shifts = shiftResults.map((r) => ({
      shift: r.shift,
      shiftNumber: r.shiftNumber,
      pr: r.shiftTotals.pr,
      pdtMin: r.shiftTotals.totalPdtMin,
      pdtPercent: r.shiftTotals.pdtPercent,
      updtMin: r.shiftTotals.totalUpdtMin,
      updtPercent: r.shiftTotals.updtPercent,
      upstFreq: r.shiftTotals.totalUpstFreq,
      hours: r.hours,
    }));

    // Total daily = gabungan 3 shift (1440 menit sehari)
    const totalDailyMinutes = this.SHIFT_MINUTES * 3;
    const totalPdtMin = shifts.reduce((s, sh) => s + sh.pdtMin, 0);
    const totalUpdtMin = shifts.reduce((s, sh) => s + sh.updtMin, 0);
    const totalUpstFreq = shifts.reduce((s, sh) => s + sh.upstFreq, 0);
    const pdtPercent = this.round((totalPdtMin / totalDailyMinutes) * 100);
    const updtPercent = this.round((totalUpdtMin / totalDailyMinutes) * 100);
    const dailyPr = this.round(Math.max(0, 100 - pdtPercent - updtPercent));

    return {
      date: today,
      shifts,
      daily: {
        pr: dailyPr,
        pdtMin: totalPdtMin,
        pdtPercent,
        updtMin: totalUpdtMin,
        updtPercent,
        upstFreq: totalUpstFreq,
      },
    };
  }

  // ─── CORE BUILDER ─────────────────────────────────────────────────────────

  private async buildShiftSummary(shift: ShiftDefinition, machineId?: string): Promise<ShiftSummaryResult> {
    const now = new Date();
    const shiftStart = this.shiftService.getShiftStartTimeByNumber(shift.number, now);
    const shiftEnd = this.shiftService.getShiftEndTimeByNumber(shift.number, now);

    // Ambil semua downtime record dalam rentang shift ini dari Prisma
    const downtimeRecords = await this.getDowntimeInRange(shiftStart, shiftEnd, machineId);

    // Hitung metrik per jam
    const hours: HourMetrics[] = shift.hours.map((win) => {
      const { winStart, winEnd } = this.resolveWindowDates(win, shiftStart);
      return this.calcHourMetrics(win, winStart, winEnd, downtimeRecords);
    });

    // Aggregasi shift level
    const totalUpdtMin = hours.reduce((s, h) => s + h.updtMin, 0);
    const totalPdtMin = hours.reduce((s, h) => s + h.pdtMin, 0);
    const totalUpstFreq = hours.reduce((s, h) => s + h.upstFreq, 0);
    const updtPercent = this.round((totalUpdtMin / this.SHIFT_MINUTES) * 100);
    const pdtPercent = this.round((totalPdtMin / this.SHIFT_MINUTES) * 100);
    const pr = this.round(Math.max(0, 100 - pdtPercent - updtPercent));

    return {
      shift: shift.name,
      shiftNumber: shift.number,
      date: now.toISOString().split('T')[0],
      shiftStart: this.formatHour(shift.startHour),
      shiftEnd: this.formatHour(shift.endHour),
      totalShiftMinutes: this.SHIFT_MINUTES,
      hours,
      shiftTotals: {
        totalUpdtMin,
        totalPdtMin,
        totalUpstFreq,
        updtPercent,
        pdtPercent,
        pr,
      },
    };
  }

  // ─── PER-JAM KALKULASI ────────────────────────────────────────────────────

  private calcHourMetrics(
    win: HourWindow,
    winStart: Date,
    winEnd: Date,
    allDowntimes: DowntimeRecord[],
  ): HourMetrics {
    // Filter downtime yang overlap dengan window jam ini
    const inWindow = allDowntimes.filter((d) => {
      const ds = d.startTime.getTime();
      const de = (d.endTime ?? new Date()).getTime();
      const ws = winStart.getTime();
      const we = winEnd.getTime();
      return ds < we && de > ws; // overlap check
    });

    // Hitung total menit UPDT (unplanned) dalam window ini
    let updtMin = 0;
    let upstFreq = 0;
    let pdtMin = 0;

    for (const d of inWindow) {
      const overlapStart = Math.max(d.startTime.getTime(), winStart.getTime());
      const overlapEnd = Math.min(
        (d.endTime ?? new Date()).getTime(),
        winEnd.getTime(),
      );
      const overlapMinutes = Math.max(0, (overlapEnd - overlapStart) / 60000);

      if (d.isPlanned) {
        pdtMin += overlapMinutes;
      } else {
        updtMin += overlapMinutes;
        upstFreq += 1;
      }
    }

    // --- MOCK DATA BUAT DEMO JIKA KOSONG ---
    // Agar grafik tidak 0 dan stabil saat direfresh (menggunakan seeded pseudo-random)
    if (inWindow.length === 0 && winStart.getTime() < Date.now()) {
      const seedName = `${winStart.toISOString()}-${winEnd.toISOString()}`;
      const rand1 = this.getSeededRandom(seedName + 'A');
      
      // 70% peluang ada downtime dummy biar datanya dinamis
      if (rand1 > 0.3) {
        updtMin = Math.floor(this.getSeededRandom(seedName + 'B') * 12); // max 12 menit
        pdtMin = Math.floor(this.getSeededRandom(seedName + 'C') * 5);   // max 5 menit
        upstFreq = updtMin > 0 ? Math.floor(this.getSeededRandom(seedName + 'D') * 3) + 1 : 0;
      }
    }

    updtMin = this.round(Math.min(updtMin, this.HOUR_MINUTES));
    pdtMin = this.round(Math.min(pdtMin, this.HOUR_MINUTES));

    const usedMinutes = updtMin + pdtMin;
    const pr = this.round(
      Math.max(0, ((this.HOUR_MINUTES - usedMinutes) / this.HOUR_MINUTES) * 100),
    );

    return { jamKe: win.jamKe, timeRange: win.timeRange, updtMin, upstFreq, pdtMin, pr };
  }

  // ─── DATA ACCESS ──────────────────────────────────────────────────────────

  private async getDowntimeInRange(start: Date, end: Date, machineId?: string): Promise<DowntimeRecord[]> {
    try {
      const whereClause: any = {
        startTime: { gte: start },
        OR: [{ endTime: null }, { endTime: { lte: end } }],
      };

      if (machineId) {
        whereClause.machine = { machineId: machineId };
      }

      const rows = await this.prisma.downtime.findMany({
        where: whereClause,
        orderBy: { startTime: 'asc' },
      });

      return rows.map((r) => ({
        id: r.id,
        startTime: new Date(r.startTime),
        endTime: r.endTime ? new Date(r.endTime) : null,
        durationSec: r.duration ?? null,
        isPlanned: (r as any).isPlanned ?? false, // field baru (opsional)
      }));
    } catch (err) {
      this.logger.error(`Gagal ambil downtime: ${err.message}`);
      return [];
    }
  }

  // ─── AUTO MOCK DATA GENERATOR ──────────────────────────────────────────────

  private async checkAndAutoSeedToday(): Promise<void> {
    if (this.hasAutoSeededToday) return;

    const today = new Date();
    today.setHours(6, 0, 0, 0); // batas awal shift 1
    if (today.getTime() > Date.now()) today.setDate(today.getDate() - 1);

    // Cek apakah ada record Downtime hari ini untuk mesin mana pun
    const existing = await this.prisma.downtime.findFirst({
        where: { startTime: { gte: today } }
    });

    if (!existing) {
        this.logger.warn('[AutoSeed] Data downtime hari ini kosong. Menginjeksi data dummy secara otomatis...');
        await this.generateDynamicDowntimes(today);
    }
    this.hasAutoSeededToday = true;
  }

  private async generateDynamicDowntimes(today: Date) {
    const dbMachines = await this.prisma.machine.findMany();
    const newDowntimes: any[] = [];

    for (const machine of dbMachines) {
      for (let i = 0; i < 24; i++) {
        const currentHour = new Date(today);
        currentHour.setHours(currentHour.getHours() + i);

        // Jangan isi untuk jam di masa depan
        if (currentHour.getTime() > Date.now()) break;

        // 60% probabilitas downtime di jam ini
        if (Math.random() > 0.4) {
          const isPlanned = Math.random() > 0.8;
          const durationMenit = Math.floor(Math.random() * 4) + 1; // 1 to 4 minutes
          const durationSec = durationMenit * 60;

          const startTime = new Date(currentHour);
          startTime.setMinutes(Math.floor(Math.random() * 50));

          const endTime = new Date(startTime);
          endTime.setSeconds(endTime.getSeconds() + durationSec);

          newDowntimes.push({
            machineId: machine.id,
            startTime,
            endTime,
            duration: durationSec,
            isPlanned,
            operatorNote: `Auto-Seed Dinamis (${isPlanned ? 'P' : 'UP'}DT)`,
            isApproved: true,
          });
        }
      }
    }

    if (newDowntimes.length > 0) {
      await this.prisma.downtime.createMany({ data: newDowntimes });
      this.logger.log(`[AutoSeed] Berhasil injeksi otomatis ${newDowntimes.length} downtime ke database!`);
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  /**
   * Resolve window jam ke Date object absolut berdasarkan shiftStart.
   * Kasus overnight (Shift 3): jam 22,23 → hari ini, jam 00–05 → besok.
   */
  private resolveWindowDates(
    win: HourWindow,
    shiftStart: Date,
  ): { winStart: Date; winEnd: Date } {
    const winStart = new Date(shiftStart);
    winStart.setHours(win.startHour, 0, 0, 0);

    // Jika jam window lebih kecil dari jam start shift → window ini masuk hari berikutnya
    if (win.startHour < shiftStart.getHours()) {
      winStart.setDate(winStart.getDate() + 1);
    }

    const winEnd = new Date(winStart);
    winEnd.setHours(winEnd.getHours() + 1);

    return { winStart, winEnd };
  }

  private formatHour(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  private round(val: number, decimals = 2): number {
    return Math.round(val * 10 ** decimals) / 10 ** decimals;
  }

  /**
   * Deterministic Pseudo-Random Generator based on a string seed.
   * Supaya datanya terkesan "dinamis" tapi gak berubah-ubah tiap direfresh.
   */
  private getSeededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) / 2147483647;
  }
}

// ─── Internal type ────────────────────────────────────────────────────────────

interface DowntimeRecord {
  id: number;
  startTime: Date;
  endTime: Date | null;
  durationSec: number | null;
  isPlanned: boolean;
}
