import { ShiftService } from './../../core-engine/shift/shift.service';
import { RealTimeEngineService } from './../../core-engine/engine/engine.service';
import { Injectable, Logger, Query } from '@nestjs/common';
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
      ) { }

      /**
       * Mengambil riwayat breakdown terbaru
       * @param limit Jumlah data yang ingin diambil
       */
      async findAll(limit: number, page: number, machineId?: string) {
            try {
                  const skip = (page - 1) * limit;

                  const query = this.breakdownRepo.createQueryBuilder('event')
                        .orderBy('event.createdAt', 'DESC')
                        .take(limit)
                        .skip(skip);
                  
                  if (machineId) {
                        query.where('event.machineId = :machineId', { machineId });
                  }

                  const [rawEvents, total] = await query.getManyAndCount();

                  // Tambahkan filter ini agar data dengan startTime yang sama tidak double
                  const items = rawEvents.filter((item, index, self) =>
                        index === self.findIndex((t) => (
                              new Date(t.createdAt).getTime() === new Date(item.createdAt).getTime() &&
                              t.machineId === item.machineId
                        ))
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
            // Query ke Postgres untuk mencari alasan stop yang paling sering muncul
            // Kita ambil 5 besar (Top 5)
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
       */
      async getLineSummary() {
            const startTime = Date.now();
            try {
                  // Dapatkan waktu awal shift (gunakan function helper yg tadi)
                  const shiftStart = this.getShiftStartTime();
                  const realTimeMachines = this.engineService.getAllTrackersWithId();

                  // OPTIMASI: Hanya ambil data yang terjadi SEJAK awal shift
                  // Database jauh lebih ringan kerjanya!
                  const rawEvents = await this.breakdownRepo.find({
                        where: {
                              createdAt: MoreThanOrEqual(shiftStart)
                        }
                  });

                  // Function untuk pengelompokan data
                  const events = rawEvents.filter((item, index, self) =>
                        index === self.findIndex((t) => (
                              new Date(t.createdAt).getTime() === new Date(item.createdAt).getTime() &&
                              t.machineId === item.machineId
                        ))
                  );

                  // Kelompokan data per mesin untuk kebutuhan dashboard Line
                  const historyMap   = events.reduce((acc: any, curr) => {
                        const id = curr.machineId;


                        if (!acc[id]) {
                              acc[id] = {
                                    totalEvents: 0,
                                    totalDowntime: 0
                              };
                        }
                        acc[id].totalEvents += 1;
                        acc[id].totalDowntime += Number(curr.duration || 0);

                        return acc;
                  }, {});

                  const combinedData = realTimeMachines.map(m => {
                  const history = historyMap[m.machineId] || { totalEvents: 0, totalDowntime: 0 };

                        return {
                              machineId: m.machineId,
                              machineName: m.machineName,
                              // Data dari ENGINE (Real-time)
                              status: m.status,
                              currentCounter: m.lastBottleCount,
                              currentDownTime: m.updtSeconds,
                              // Data dari DATABASE (History hari ini/all time)
                              totalBreakdownEvents: history.totalEvents,
                              totalDowntimeMinutes: Math.round(history.totalDowntime / 60),
                              healthStatus: history.totalEvents > 10 ? 'POOR' : history.totalEvents > 5 ? 'FAIR' : 'EXCELLENT'

                        };
                  });

                  const totalDowntimeGlobal = combinedData.reduce((sum, m) => sum + m.totalDowntimeMinutes, 0)
                  
                  return {
                        status: "Success",
                        line_id: "LINE_2",
                        totalDowntimeGlobal: totalDowntimeGlobal,
                        shift_info: {
                              start_from: shiftStart.toISOString(),
                              is_live: true,
                        },
                        data: combinedData,
                        metadata: {
                              execution_time_ms: Date.now() - startTime, // Informasi kecepatan si server
                              record_count: rawEvents.length // Angka ini menunjukan jumlah breakdowndi shift ini
                        }
                  };
            } catch (error) {
                  this.logger.error(`Failed to calculate line summary: ${error.message}`);
                  return { data: [] }; // Return minimal object agar controller tidak crash
            }
      }

      private getShiftStartTime(): Date {
            const now = new Date();
            const shiftStart = new Date(now);
            const hour = now.getHours();

            if (hour >= 7 && hour < 15) {
                  // Shift 1: Mulai jam 07.00 pagi hari ini
                  shiftStart.setHours(7, 0, 0, 0);

            } else if (hour >= 15 && hour < 23) {
                  // Shift 2: Mulai jam 15.00 sore hari ini
                  shiftStart.setHours(15, 0, 0, 0);

            } else {
                  // Shift 3: Mulai jam 23.00 malam
                  if (hour < 7) {
                        // Jika jam 01.00 pagi, berarti shift mulai jam 23.00 malam KEMARIN
                        shiftStart.setDate(shiftStart.getDate() - 1);
                  }
                  shiftStart.setHours(23, 0, 0, 0);
            }
            return shiftStart;
      }
}