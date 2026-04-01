import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { ModbusClientService, MachineData } from '../modbus-client/modbus-client.service';
import { RealTimeEngineService } from '../../core-engine/engine/engine.service';

@Injectable()     
export class PollingSchedulerService implements OnModuleInit, OnModuleDestroy {
      private readonly logger = new Logger(PollingSchedulerService.name);
      private dataSubscription: Subscription;

      // Daftar mesin yang akan diproses oleh Engine
      private readonly machines = [
            { id: 'FILLER-01', name: 'Mesin Filler Utama 01', index: 0 },
            { id: 'FILLER-02', name: 'Mesin Filler Utama 02', index: 1 },
            { id: 'CAPPER-01', name: 'Mesin Capping 01', index: 2 },
            { id: 'CAPPER-02', name: 'Mesin Capping 02', index: 3 },
            { id: 'LABELLER-01', name: 'Mesin Labeller Utama', index: 4 },
            { id: 'INKS-01', name: 'Mesin Inkjet Coder', index: 5 },
            { id: 'SLEEVE-01', name: 'Mesin Sleeve Labeller', index: 6 },
            { id: 'SHRINK-01', name: 'Mesin Shrink Tunnel 01', index: 7 },
            { id: 'SHRINK-02', name: 'Mesin Shrink Tunnel 02', index: 8 },
            { id: 'PACKER-01', name: 'Mesin Case Packer 01', index: 9 },
            { id: 'PACKER-02', name: 'Mesin Case Packer 02', index: 10 },
            { id: 'SEALER-01', name: 'Mesin Carton Sealer', index: 11 },
            { id: 'STRAP-01', name: 'Mesin Strapping', index: 12 },
            { id: 'PALLET-01', name: 'Mesin Palletizer', index: 13 },
            { id: 'WRAP-01', name: 'Mesin Stretch Wrapper', index: 14 },
      ];

      constructor(
            private readonly modbusClient: ModbusClientService,
            private readonly realTimeEngineService: RealTimeEngineService,
      ) { }

      onModuleInit() {
            this.logger.log('--- Initializing Polling Scheduler ---');
            this.listenToModbusStream();
      }

      /**
       * Menggunakan Stream dari ModbusClientService.
       * Tidak perlu setInterval lagi di sini karena ModbusClientService sudah melakukan polling.
       */
      private listenToModbusStream() {
            this.dataSubscription = this.modbusClient.machineData$
                  .pipe(
                        // ✅ FIX: Pakai concatMap supaya data diproses BERURUTAN. 
                        // Data detik ke-2 nunggu detik ke-1 kelar diproses Engine.
                        concatMap(allData => from(this.processAllMachines(allData)))
                  )
                  .subscribe({
                        error: (err) => this.logger.error(`❌ Stream Error: ${err.message}`)
                  });
      }


      /**
       * Logika Pemrosesan Per Mesin (Batch Processing)
       * Di-upgrade menggunakan Promise.all untuk eksekusi paralel yang lebih cepat.
       */
      private async processAllMachines(allMachinesRaw: MachineData[]) {
            // ✅ FIX 1: Guard clause buat cegah error undefined di awal
            if (!allMachinesRaw || allMachinesRaw.length === 0) return;

            try {
                  const processingPromises = this.machines.map(async (machine) => {
                        const rawData = allMachinesRaw[machine.index] as any;
                        if (!rawData) return;

                        const formattedData = {
                              RUN_STOP_BIT: rawData.status ?? 0,
                              ALARM_CODE: rawData.alarm ?? 0,
                              BOTTLE_COUNTER: rawData.counter ?? 0,
                              status: rawData.status ?? 0,
                              alarm: rawData.alarm ?? 0,
                              counter: rawData.counter ?? 0,
                              temp: rawData.temp ?? 0,
                              vibration: rawData.vibration ?? 0,
                              power: rawData.power ?? 0,
                              load: rawData.load ?? 0
                        };

                        return this.realTimeEngineService.processNewData(
                              machine.id,
                              machine.name,
                              formattedData as any
                        );
                  });

                  // ✅ FIX 2: Pakai allSettled. 
                  // Kalau Mesin FILLER-01 error, Mesin CAPPER-01 tetep jalan terus!
                  await Promise.allSettled(processingPromises);

            } catch (error) {
                  this.logger.error(`[Scheduler] Critical Failure: ${error.message}`);
            }
      }

      onModuleDestroy() {
            // Bersihkan subscription agar tidak memory leak
            if (this.dataSubscription) {
                  this.dataSubscription.unsubscribe();
            }
            this.logger.log('Polling Scheduler Service Destroyed.');
      }
}