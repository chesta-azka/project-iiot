import { ShiftService } from './../../core-engine/shift/shift.service';
import { RealTimeEngineService } from './../../core-engine/engine/engine.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { BreakdownEventEntity } from 'src/database/entities/breakdown-event/breakdown-event.entity';

@Injectable()
export class MachineHistoryService {
  private readonly logger = new Logger(MachineHistoryService.name);

  constructor(
    @InjectRepository(BreakdownEventEntity)
    private readonly breakdownRepo: Repository<BreakdownEventEntity>,
    private readonly engineService: RealTimeEngineService,
    private readonly shiftService: ShiftService,
  ) {}

  /**
   * Mengambil riwayat breakdown terbaru
   * @param limit Jumlah data yang ingin diambil
   */
  async findAll(limit: number, page: number, machineId?: string) {
    try {
      const skip = (page - 1) * limit;

      const query = this.breakdownRepo
        .createQueryBuilder('event')
        .orderBy('event.createdAt', 'DESC')
        .take(limit)
        .skip(skip);

      if (machineId) {
        query.where('event.machineId = :machineId', { machineId });
      }

      const [rawEvents, total] = await query.getManyAndCount();

      // Filter agar data dengan startTime yang sama tidak double
      const items = rawEvents.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              new Date(t.createdAt).getTime() ===
                new Date(item.createdAt).getTime() &&
              t.machineId === item.machineId,
          ),
      );

      return {
        data: items,
        meta: {
          totalItems: total,
          itemCount: items.length,
          itemsPerPage: limit,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
        },
      };
    } catch (error) {
      this.logger.error(`Gagal mengambil history: ${error.message}`);
      return { data: [], meta: {} };
    }
  }

  async getTopBreakdownReasons() {
    try {
      const result = await this.breakdownRepo
        .createQueryBuilder('breakdown')
        .select('breakdown.errorMessage', 'errorMessage')
        .addSelect('COUNT(breakdown.errorMessage)', 'count')
        .where('breakdown.errorMessage IS NOT NULL')
        .groupBy('breakdown.errorMessage')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany();
      return result;
    } catch (error) {
      this.logger.error(`Gagal ambil top errors: ${error.message}`);
      return [];
    }
  }

  /**
   * Menghitung ringkasan performa mesin untuk dashboard
   * Menggunakan ShiftService untuk jadwal shift yang konsisten (06/14/22)
   */
  async getLineSummary() {
    const startTime = Date.now();
    try {
      // Gunakan ShiftService — jadwal 06/14/22 sesuai PPT
      const shiftStart = this.shiftService.getShiftStartTime();
      const currentShift = this.shiftService.getCurrentShift();
      const realTimeMachines = this.engineService.getAllTrackersWithId();

      // Ambil data sejak awal shift aktif
      const rawEvents = await this.breakdownRepo.find({
        where: {
          createdAt: MoreThanOrEqual(shiftStart),
        },
      });

      // De-duplicate events per mesin + timestamp
      const events = rawEvents.filter(
        (item, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              new Date(t.createdAt).getTime() ===
                new Date(item.createdAt).getTime() &&
              t.machineId === item.machineId,
          ),
      );

      // Kelompokan per mesin
      const historyMap = events.reduce((acc: any, curr) => {
        const id = curr.machineId;
        if (!acc[id]) {
          acc[id] = { totalEvents: 0, totalDowntime: 0 };
        }
        acc[id].totalEvents += 1;
        acc[id].totalDowntime += Number(curr.duration || 0);
        return acc;
      }, {});

      const combinedData = realTimeMachines.map((m) => {
        const history = historyMap[m.machineId] || {
          totalEvents: 0,
          totalDowntime: 0,
        };
        return {
          machineId: m.machineId,
          machineName: m.machineName,
          status: m.status,
          currentCounter: m.lastBottleCount,
          currentDownTime: m.updtSeconds,
          totalBreakdownEvents: history.totalEvents,
          totalDowntimeMinutes: Math.round(history.totalDowntime / 60),
          healthStatus:
            history.totalEvents > 10
              ? 'POOR'
              : history.totalEvents > 5
                ? 'FAIR'
                : 'EXCELLENT',
        };
      });

      const totalDowntimeGlobal = combinedData.reduce(
        (sum, m) => sum + m.totalDowntimeMinutes,
        0,
      );

      return {
        status: 'Success',
        line_id: 'LINE_2',
        totalDowntimeGlobal,
        shift_info: {
          name: currentShift.name,
          number: currentShift.number,
          start_from: shiftStart.toISOString(),
          is_live: true,
        },
        data: combinedData,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          record_count: rawEvents.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to calculate line summary: ${error.message}`);
      return { data: [] };
    }
  }
}
