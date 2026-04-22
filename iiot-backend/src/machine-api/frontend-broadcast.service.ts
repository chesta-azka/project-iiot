import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { MachineTelemetryGateway } from './machine-telemetry/machine-telemetry.gateway';
import { RealTimeEngineService } from 'src/core-engine/engine/engine.service';
import { ShiftSummaryService } from 'src/core-engine/shift/shift-summary.service';
import { MachineHistoryService } from './machine-history/machine-history.service';

@Injectable()
export class FrontendBroadcastService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FrontendBroadcastService.name);
  private interval: NodeJS.Timeout;

  constructor(
    @Inject(forwardRef(() => MachineTelemetryGateway))
    private readonly gateway: MachineTelemetryGateway,
    @Inject(forwardRef(() => RealTimeEngineService))
    private readonly engineService: RealTimeEngineService,
    @Inject(forwardRef(() => ShiftSummaryService))
    private readonly shiftSummaryService: ShiftSummaryService,
    private readonly historyService: MachineHistoryService,
  ) {}

  onModuleInit() {
    this.logger.log('Berhasil inisiasi FrontendBroadcastService.');
    // Berjalan setiap 3 detik
    this.interval = setInterval(async () => {
      await this.broadcastAll();
    }, 250);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async broadcastAll() {
    if (!this.gateway.server) return; // Websocket server belum siap

    try {
      const liveMachines = this.engineService.getAllTrackersWithId();

      // 1. Dashboard Update
      const runningCount = liveMachines.filter(
        (m) => m.status === 'RUNNING',
      ).length;
      const stoppedCount = liveMachines.filter(
        (m) => m.status === 'STOPPED',
      ).length;
      const notifications =
        (await this.historyService.getTopBreakdownReasons()) || [];

      this.gateway.server.emit('dashboard_update', {
        timestamp: new Date().toISOString(),
        total: liveMachines.length,
        running: runningCount,
        stopped: stoppedCount,
        notifications: notifications,
      });

      // 2. Line Status Update (Mocking 1 Line - '1')
      const lineStatus =
        runningCount > 0 || liveMachines.length === 0 ? 'RUN' : 'STOP';
      this.gateway.server.emit('line_status_update', {
        lineId: '1',
        status: lineStatus,
        timestamp: new Date().toISOString(),
      });

      // 3. Machine Statuses Update (Selengkapnya, with hover PR and Counts)
      const machineStatuses = await Promise.all(
        liveMachines.map(async (m) => {
          let statusCountText =
            m.upstCount > 0 ? `${m.upstCount} Stops` : 'Running';
          // Kita bisa fetch daily pr dari shift summary service
          const shiftData =
            await this.shiftSummaryService.getCurrentShiftSummary(m.machineId);
          const performa = shiftData?.shiftTotals?.pr || m.pr || 0;

          // Tentuin indikator (Misal kalau di bawah 50% atau ada alarm kita kasih Warning)
          let uiStatus = m.status === 'RUNNING' ? 'RUN' : 'STOP';
          if (m.status !== 'RUNNING' && m.latestAlarmCode) uiStatus = 'WARNING';

          return {
            machineId: m.machineId,
            machineName: m.machineName,
            status: uiStatus,
            statusCount: statusCountText,
            performance: performa,
          };
        }),
      );

      this.gateway.server.emit('machine_statuses_update', {
        lineId: '1',
        machines: machineStatuses,
        timestamp: new Date().toISOString(),
      });

      // 4. Screen Delivery Update
      // Asumsikan target = 1000 * jumlah mesin, aktual = total bottle counter
      const target = 1000 * liveMachines.length;
      const actual = liveMachines.reduce(
        (acc, m) => acc + (m.lastBottleCount || 0),
        0,
      );

      this.gateway.server.emit('screen_delivery_update', {
        lineId: '1',
        target,
        actual,
        gap: target - actual,
        timestamp: new Date().toISOString(),
      });

      // 5. Shift Summary (Broadcast untuk per mesin & overall jika ada FE yang dengar)
      // Agak berat kalau dilakukan loop per mesin per 3 detik kalau database lambat
      // Jadi dikirim overal 'current' shift summary saja.
      const overallShift =
        await this.shiftSummaryService.getCurrentShiftSummary();
      this.gateway.server.emit('shift_summary_update', {
        timestamp: new Date().toISOString(),
        overall: overallShift,
      });
    } catch (e) {
      this.logger.error(`Error in broadcast interval: ${e.message}`);
    }
  }
}
