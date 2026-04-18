import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InfluxService } from '../../database/influx/influx.service';
import { MachineTelemetryGateway } from 'src/machine-api/machine-telemetry/machine-telemetry.gateway';
import { MachineRegisters } from 'src/simulator/modbus-simulator/modbus-simulator.service';
import { ShiftService } from '../shift/shift.service';
import { PrismaService } from '../../../prisma/prisma.service';
// IMPORT SERVICE MODBUS (Sesuaikan path jika beda folder)
import { ModbusClientService, MachineData } from '../../simulator/modbus-client/modbus-client.service';

interface MachineStateTracker {
  isRunning: boolean;
  updtStartTime: Date | null;
  currentUpdtDurationMs: number;
  totalUptimeMs: number;
  upstCount: number;
  latestAlarmCode: number;
  lastBottleCount: number;
  machineName: string;
  isSaving?: boolean;
  currentOperator?: string;
  pr?: number; // Tambahkan field pr di tracker
}

@Injectable()
export class RealTimeEngineService implements OnModuleInit {
  private readonly logger = new Logger(RealTimeEngineService.name);
  private lastProcessTimestamp = new Map<string, number>();
  private machinesTracker = new Map<string, MachineStateTracker>();
  private machines: any[] = []; // Menampung hasil subscribe terbaru

  constructor(
    private readonly influxService: InfluxService,
    @Inject(forwardRef(() => MachineTelemetryGateway))
    private readonly telemetryGateway: MachineTelemetryGateway,
    private readonly shiftService: ShiftService,
    private readonly prisma: PrismaService,
    // Dependency Injection Modbus Service
    private readonly modbusService: ModbusClientService,
  ) { }

  onModuleInit() {
    this.logger.log(`[Engine] Multi-Machine RealTime Engine Initialized.`);

    // LOGIC DARI LU: Subscribe data Modbus
    this.modbusService.machineData$.subscribe((data: any[]) => {
      this.machines = data.map(m => ({
        ...m,
        pr: m.pr, // <--- Baris keramat biar PR-nya gak ilang
      }));

      // Automatis update tracker setiap ada data baru masuk dari modbus
      data.forEach(m => {
        const tracker = this.getOrCreateTracker(m.id, m.name);
        tracker.pr = m.pr; // Simpan PR ke tracker
      });
    });
  }

  private getOrCreateTracker(
    machineId: string,
    machineName?: string,
  ): MachineStateTracker {
    if (!this.machinesTracker.has(machineId)) {
      this.machinesTracker.set(machineId, {
        isRunning: false,
        updtStartTime: null,
        currentUpdtDurationMs: 0,
        totalUptimeMs: 0,
        upstCount: 0,
        latestAlarmCode: 0,
        lastBottleCount: 0,
        isSaving: false,
        machineName: machineName || `Machine ${machineId}`,
        pr: 0,
      });
      this.lastProcessTimestamp.set(machineId, Date.now());
    }
    return this.machinesTracker.get(machineId) as MachineStateTracker;
  }

  async processNewData(
    machineId: string,
    machineName: string,
    rawData: MachineRegisters,
    operatorName: string,
  ): Promise<void> {
    try {
      const tracker = this.getOrCreateTracker(machineId, machineName);
      tracker.currentOperator = operatorName;

      const isCurrentlyRunning = rawData.RUN_STOP_BIT === 1;
      const previousState = tracker.isRunning;
      const currentShift = this.shiftService.getCurrentShift(); // returns ShiftDefinition

      const now = Date.now();
      const lastTs = this.lastProcessTimestamp.get(machineId) || now;
      const actualElapsed = now - lastTs;
      this.lastProcessTimestamp.set(machineId, now);

      tracker.latestAlarmCode = rawData.ALARM_CODE;

      if (!isCurrentlyRunning) {
        if (previousState === true) {
          this.handleStopEvent(machineId, tracker);
          const machine = await this.prisma.machine.findUnique({
            where: { machineId: machineId },
          });
          if (machine) {
            await this.prisma.downtime.create({
              data: {
                machineId: machine.id,
                startTime: new Date(),
              },
            });
          }
        }
        tracker.currentUpdtDurationMs += actualElapsed;
      } else {
        tracker.totalUptimeMs += actualElapsed;

        if (previousState === false) {
          await this.handleRestartEvent(
            machineId,
            tracker,
            currentShift.name,
            operatorName,
          );

          const machine = await this.prisma.machine.findUnique({
            where: { machineId },
          });
          if (machine) {
            const activeLog = await this.prisma.downtime.findFirst({
              where: { machineId: machine.id, endTime: null },
              orderBy: { startTime: 'desc' },
            });

            if (activeLog) {
              const endTime = new Date();
              const duration = Math.floor(
                (endTime.getTime() - activeLog.startTime.getTime()) / 1000,
              );
              await this.prisma.downtime.update({
                where: { id: activeLog.id },
                data: { endTime, duration },
              });
            }
          }
        }
      }

      if (previousState !== isCurrentlyRunning) {
        await this.prisma.machine.updateMany({
          where: { machineId: machineId },
          data: { status: isCurrentlyRunning ? 1 : 0 },
        });
      }

      this.broadcastTelemetry(machineId, tracker, rawData, currentShift.name);
      this.saveToInflux(machineId, rawData, currentShift.name);

      tracker.isRunning = isCurrentlyRunning;
      tracker.lastBottleCount = rawData.BOTTLE_COUNTER;
    } catch (err) {
      this.logger.error(
        `[Engine Error] Critical error on ${machineId}: ${err.message}`,
      );
    }
  }

  private handleStopEvent(
    machineId: string,
    tracker: MachineStateTracker,
  ): void {
    tracker.upstCount += 1;
    tracker.updtStartTime = new Date();
    this.logger.warn(`[DOWN] ${machineId} - Alarm: ${tracker.latestAlarmCode}`);
  }

  private async handleRestartEvent(
    machineId: string,
    tracker: MachineStateTracker,
    shiftName: string,
    operatorName: string,
  ): Promise<void> {
    const durationMs = tracker.currentUpdtDurationMs;

    if (durationMs >= 2000) {
      this.logger.log(
        `[UP] ${machineId} restarted after ${(durationMs / 1000).toFixed(1)}s`,
      );
    }

    tracker.currentUpdtDurationMs = 0;
    tracker.updtStartTime = null;
    tracker.isSaving = false;
  }

  private broadcastTelemetry(
    machineId: string,
    tracker: MachineStateTracker,
    rawData: MachineRegisters,
    shiftName: string,
  ): void {
    // Gunakan PR dari tracker (hasil modbus subscribe) jika tersedia, 
    // jika tidak baru hitung manual.
    const finalPR = tracker.pr || 0;

    this.telemetryGateway.sendToFrontend({
      machineId: machineId,
      machineName: tracker.machineName,
      operator: tracker.currentOperator,
      status: tracker.isRunning ? 'RUNNING' : 'STOPPED',
      counter: rawData.BOTTLE_COUNTER,
      performanceRate: finalPR,
      alarm: rawData.ALARM_CODE,
      updtSeconds: (tracker.currentUpdtDurationMs / 1000).toFixed(1),
      shift: shiftName,
      upstCount: tracker.upstCount,
    });
  }

  private saveToInflux(
    machineId: string,
    rawData: MachineRegisters,
    shiftName: string,
  ): void {
    this.influxService.writePoint(
      machineId,
      rawData.RUN_STOP_BIT,
      rawData.BOTTLE_COUNTER,
      rawData.ALARM_CODE,
      shiftName,
    );
  }

  getAllTrackersWithId() {
    return Array.from(this.machinesTracker.entries()).map(([id, tracker]) => {
      return {
        machineId: id,
        ...tracker,
        status: tracker.isRunning ? 'RUNNING' : 'STOPPED',
        performanceRate: tracker.pr || 0,
        updtSeconds: (tracker.currentUpdtDurationMs / 1000).toFixed(1),
      };
    });
  }
}