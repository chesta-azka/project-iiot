import { Injectable } from '@nestjs/common';

@Injectable()
export class ShiftService {
  // Definisi jam kerja pabrik kamu
  private shifts = [
    { name: 'Shift 1', start: '07:00', end: '15:00' },
    { name: 'Shift 2', start: '15:00', end: '23:00' },
    { name: 'Shift 3', start: '23:00', end: '07:00' },
  ];

  getCurrentShift() {
    const now = new Date();
    const currentTime =
      now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');

    // Logic sederhana mencari shift berdasarkan jam sekarang
    const activeShift = this.shifts.find((s) => {
      if (s.start < s.end) {
        return currentTime >= s.start && currentTime < s.end;
      } else {
        // Untuk Shift 3 yang melewati tengah malam (23:00 - 07:00)
        return currentTime >= s.start || currentTime < s.end;
      }
    });

    return activeShift || this.shifts[0];
  }

  getShiftStartTime(): Date {
    const shift = this.getCurrentShift();
    const [hours, minutes] = shift.start.split(':').map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);

    // Jika sekarang jam 01:00 pagi dan shift start jam 23:00,
    // berarti start-nya adalah malam kemarin
    if (start > new Date()) {
      start.setDate(start.getDate() - 1);
    }
    return start;
  }
}
