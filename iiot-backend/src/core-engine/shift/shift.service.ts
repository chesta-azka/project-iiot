import { Injectable } from '@nestjs/common';

export interface ShiftDefinition {
  number: number;
  name: string;
  startHour: number; // jam mulai (format 24h)
  endHour: number;   // jam selesai (format 24h)
  hours: HourWindow[];
}

export interface HourWindow {
  jamKe: number;
  startHour: number;
  endHour: number;
  timeRange: string; // contoh "14:00-15:00"
}

@Injectable()
export class ShiftService {
  // Sesuai PPT: Shift 1=06-14, Shift 2=14-22, Shift 3=22-06
  readonly SHIFTS: ShiftDefinition[] = [
    {
      number: 1,
      name: 'Shift 1',
      startHour: 6,
      endHour: 14,
      hours: this.buildHourWindows(6, 8),
    },
    {
      number: 2,
      name: 'Shift 2',
      startHour: 14,
      endHour: 22,
      hours: this.buildHourWindows(14, 8),
    },
    {
      number: 3,
      name: 'Shift 3',
      startHour: 22,
      endHour: 6,
      hours: this.buildHourWindows(22, 8),
    },
  ];

  private buildHourWindows(startHour: number, count: number): HourWindow[] {
    const windows: HourWindow[] = [];
    for (let i = 0; i < count; i++) {
      const sh = (startHour + i) % 24;
      const eh = (startHour + i + 1) % 24;
      windows.push({
        jamKe: i + 1,
        startHour: sh,
        endHour: eh,
        timeRange: `${String(sh).padStart(2, '0')}:00-${String(eh).padStart(2, '0')}:00`,
      });
    }
    return windows;
  }

  getCurrentShift(): ShiftDefinition {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return this.SHIFTS[0];
    if (hour >= 14 && hour < 22) return this.SHIFTS[1];
    return this.SHIFTS[2]; // 22:00–06:00
  }

  getShiftByNumber(shiftNumber: number): ShiftDefinition | undefined {
    return this.SHIFTS.find((s) => s.number === shiftNumber);
  }

  /** Kembalikan Date awal shift saat ini */
  getShiftStartTime(): Date {
    const shift = this.getCurrentShift();
    const now = new Date();
    const start = new Date(now);
    start.setHours(shift.startHour, 0, 0, 0);

    // Shift 3 (22:00–06:00): jika sekarang 00:xx–05:xx, start-nya kemarin jam 22
    if (shift.number === 3 && now.getHours() < 6) {
      start.setDate(start.getDate() - 1);
    }
    return start;
  }

  /** Kembalikan Date awal shift sesuai nomor shift (untuk query history) */
  getShiftStartTimeByNumber(shiftNumber: number, refDate: Date = new Date()): Date {
    const shift = this.getShiftByNumber(shiftNumber);
    if (!shift) throw new Error(`Shift ${shiftNumber} tidak ditemukan`);

    const start = new Date(refDate);
    start.setHours(shift.startHour, 0, 0, 0);

    // Shift 3 malam, kalau refDate jam < 6 berarti start kemarin jam 22
    if (shift.number === 3 && refDate.getHours() < 6) {
      start.setDate(start.getDate() - 1);
    }
    return start;
  }

  /** Kembalikan Date akhir shift */
  getShiftEndTimeByNumber(shiftNumber: number, refDate: Date = new Date()): Date {
    const start = this.getShiftStartTimeByNumber(shiftNumber, refDate);
    const end = new Date(start);
    end.setHours(end.getHours() + 8);
    return end;
  }
}

