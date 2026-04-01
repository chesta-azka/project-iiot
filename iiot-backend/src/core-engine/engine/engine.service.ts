import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BreakdownEventEntity } from 'src/database/entities/breakdown-event/breakdown-event.entity';
import { InfluxService } from '../../database/influx/influx.service';
import { MachineTelemetryGateway } from 'src/machine-api/machine-telemetry/machine-telemetry.gateway';
import { MachineRegisters } from 'src/simulator/modbus-simulator/modbus-simulator.service';
import { MachineData } from '../../simulator/modbus-client/modbus-client.service';
import { ShiftService } from '../shift/shift.service';
import { machine } from 'os';

interface MachineStateTracker {
      isRunning: boolean;
      updtStartTime: Date | null;
      currentUpdtDurationMs: number;
      upstCount: number;
      latestAlarmCode: number;
      lastBottleCount: number;
      machineName: string; // Tambahan agar nama mesin dinamis
      isSaving?: boolean;
}

@Injectable()
export class RealTimeEngineService implements OnModuleInit {
      private readonly logger = new Logger(RealTimeEngineService.name);
      // Kita simpan timestamp terakhir untuk hitung durasi presisi
      private lastProcessTimestamp = new Map<string, number>();

      private machinesTracker = new Map<string, MachineStateTracker>();

      constructor(
            @InjectRepository(BreakdownEventEntity)
            private readonly breakdownRepository: Repository<BreakdownEventEntity>,
            private readonly influxService: InfluxService,
            private readonly telemetryGateway: MachineTelemetryGateway,
            private readonly shiftService: ShiftService,
      ) { }

      onModuleInit() {
            this.logger.log(`[Engine] Multi-Machine RealTime Engine Initialized.`);
      }

      private getOrCreateTracker(machineId: string, machineName?: string): MachineStateTracker {
            if (!this.machinesTracker.has(machineId)) {
                  this.machinesTracker.set(machineId, {
                        isRunning: true, // Idealnya ini ambil dari status terakhir di DB/Modbus
                        updtStartTime: null,
                        currentUpdtDurationMs: 0,
                        upstCount: 0,
                        latestAlarmCode: 0,
                        lastBottleCount: 0,
                        isSaving: false,
                        machineName: machineName || `Machine ${machineId}`,
                  });
                  this.lastProcessTimestamp.set(machineId, Date.now());
            }
            return this.machinesTracker.get(machineId) as MachineStateTracker;
      }

      async processNewData(machineId: string, machineName: string, rawData: MachineRegisters): Promise<void> {
            try {
                  const tracker = this.getOrCreateTracker(machineId, machineName);
                  const isCurrentlyRunning = rawData.RUN_STOP_BIT === 1;
                  const previousState = tracker.isRunning;
                  const currentShift = this.shiftService.getCurrentShift();

                  // HITUNG DURASI ASLI (Presisi tinggi)
                  const now = Date.now();
                  const lastTs = this.lastProcessTimestamp.get(machineId) || now;
                  const actualElapsed = now - lastTs;
                  this.lastProcessTimestamp.set(machineId, now);

                  tracker.latestAlarmCode = rawData.ALARM_CODE;

                  // 2. Logic Tracking
                  if (!isCurrentlyRunning) {
                        // --- MESIN STOPPED ---
                        if (previousState === true) {
                              this.handleStopEvent(machineId, tracker);
                        }
                        // Tambahkan durasi berdasarkan waktu nyata yang lewat
                        tracker.currentUpdtDurationMs += actualElapsed;
                  } else {
                        // --- MESIN RUNNING ---
                        if (previousState === false) {
                              // Pakai await agar tracker.isSaving terkendali
                              await this.handleRestartEvent(machineId, tracker, currentShift.name);
                        }
                  }

                  // 3. Sinkronisasi & Broadcast
                  this.broadcastTelemetry(machineId, tracker, rawData, currentShift.name);
                  this.saveToInflux(machineId, rawData, currentShift.name);

                  // 4. Update state terakhir
                  tracker.isRunning = isCurrentlyRunning;
                  tracker.lastBottleCount = rawData.BOTTLE_COUNTER;

            } catch (err) {
                  this.logger.error(`[Engine Error] Critical error on ${machineId}: ${err.message}`);
            }
      }

      private handleStopEvent(machineId: string, tracker: MachineStateTracker): void {
            tracker.upstCount += 1;
            tracker.updtStartTime = new Date();
            this.logger.warn(`[DOWN] ${machineId} - Alarm: ${tracker.latestAlarmCode}`);
      }

      private async handleRestartEvent(machineId: string, tracker: MachineStateTracker, shiftName: string): Promise<void> {
            if (tracker.isSaving) return;

            const durationMs = tracker.currentUpdtDurationMs;

            // Validasi: Simpan ke Postgres hanya jika downtime > 2 detik (mencegah noise data)
            if (durationMs >= 2000) {
                  tracker.isSaving = true;
                  try {
                        this.logger.log(`[UP] ${machineId} restarted after ${(durationMs / 1000).toFixed(1)}s`);
                        await this.saveBreakdownToPostgres(machineId, tracker, durationMs, shiftName);
                  } catch (e) {
                        this.logger.error(`Failed to save breakdown: ${e.message}`);
                  } finally {
                        // RESET SEMUA DI SINI
                        tracker.isSaving = false;
                        tracker.currentUpdtDurationMs = 0;
                        tracker.updtStartTime = null;
                  }
            } else {
                  // Jika mati sebentar banget, lupakan saja (Bouncing data)
                  tracker.currentUpdtDurationMs = 0;
                  tracker.updtStartTime = null;
            }
      }

      private broadcastTelemetry(machineId: string, tracker: MachineStateTracker, rawData: MachineRegisters, shiftName: string): void {
            this.telemetryGateway.sendToFrontend({
                  machineId: machineId,
                  machineName: tracker.machineName,
                  status: tracker.isRunning ? 'RUNNING' : 'STOPPED',
                  counter: rawData.BOTTLE_COUNTER,
                  alarm: rawData.ALARM_CODE,
                  updtSeconds: (tracker.currentUpdtDurationMs / 1000).toFixed(1),
                  shift: shiftName,
                  upstCount: tracker.upstCount
            });
      }

      private saveToInflux(machineId: string, rawData: MachineRegisters, shiftName: string): void {
            this.influxService.writePoint(
                  machineId,
                  rawData.RUN_STOP_BIT,
                  rawData.BOTTLE_COUNTER,
                  rawData.ALARM_CODE,
                  shiftName
            );
      }

      private async saveBreakdownToPostgres(machineId: string, tracker: MachineStateTracker, durationMs: number, shiftName: string): Promise<void> {
            try {
                  const errorMsg = tracker.latestAlarmCode !== 0
                        ? `Alarm Code: ${tracker.latestAlarmCode}`
                        : 'Manual Stop';

                  const newEvent = this.breakdownRepository.create({
                        machineId: machineId,
                        machineName: tracker.machineName,
                        errorMessage: `${errorMsg} (Shift: ${shiftName})`,
                        duration: Math.ceil(durationMs / 60000),
                  });

                  const saved = await this.breakdownRepository.save(newEvent);
                  this.logger.log(`[DB SUCCESS] ${machineId} Saved. ID: ${saved.id}`);

            } catch (error) {
                  this.logger.error(`[DB ERROR] ${machineId} failed: ${error.message}`);
            }
      }


      // ------ FUNGSI INI UNTUK SUMMARY DASHBOARD ------

      /**
       * Mengambil semua status mesin saat ini dalam bentuk Array.
       * Berguna untuk MachineHistoryService saat membuat ringkasan Line.
       */
      getAllTrackersWithId() {
            return Array.from(this.machinesTracker.entries()).map(([id, tracker]) => ({
                  machineId: id,
                  ...tracker,
                  // Tambahkan status teks agar si FE kaga perlu ngitung manual lagi yeeee....
                  status: tracker.isRunning ? 'RUNNING' : 'STOPPED',
                  updtSeconds: (tracker.currentUpdtDurationMs / 1000).toFixed(1),
            }));
      }

}