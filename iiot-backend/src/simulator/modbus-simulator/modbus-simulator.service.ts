import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as Modbus from 'jsmodbus';
import { Server } from 'net';
import { RealTimeEngineService } from 'src/core-engine/engine/engine.service';
import { Subject, interval, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * 1. EXPORT INTERFACE UNTUK ENGINE
 */
export interface MachineRegisters {
  RUN_STOP_BIT: number;
  ALARM_CODE: number;
  BOTTLE_COUNTER: number;
  status: number; // 0: OFF, 1: RUN, 2: ALARM, 3: MAINT
  counter: number; // Total Production
  alarm: number; // Error Code
  temp: number; // Temperature Celsius
  vibration: number; // G-Force mm/s
  power: number; // Wattage
  load: number; // 0-100%
}

/**
 * 2. CLASS LOGIKA MESIN KOMPLEKS
 */
class IndustrialMachine {
  public id: string;
  public name: string;
  public status?: number = 0; // Starts OFF
  public counter: number = 0;
  public alarmCode: number = 0;
  public temp: number = 25.0;
  public vibration: number = 0.1;
  public power: number = 0;
  public load: number = 0;

  private readonly targetTemp: number;
  private readonly baseSpeed: number;
  private readonly failChance: number;

  constructor(
    id: string,
    name: string,
    speed: number,
    fail: number,
    baseTemp: number,
  ) {
    this.id = id;
    this.name = name;
    this.baseSpeed = speed;
    this.failChance = fail;
    this.targetTemp = baseTemp;

    // Auto-start mesin setelah delay random
    timer(Math.random() * 5000).subscribe(() => this.bootUp());
  }

  private bootUp() {
    this.status = 1; // Set to RUNNING
    this.load = 70 + Math.random() * 20;
  }

  /**
   * Detak Jantung Mesin (Logic Loop)
   */
  public updatePhysics() {
    if (this.status !== 1) {
      this.coolDown();
      this.power = Math.max(0, this.power - 10);
      this.vibration = Math.max(0.1, this.vibration - 0.5);
      return;
    }

    // 1. Produksi (Counter)
    const prodChance = (1000 / this.baseSpeed) * 0.5;
    if (Math.random() < prodChance) {
      this.counter += Math.floor(Math.random() * 3) + 1;
    }

    // 2. Termodinamika (Suhu naik sesuai load)
    const heatGain = (this.load / 100) * 0.5;
    this.temp += heatGain - 0.1;

    // Safety: Overheat check
    if (this.temp > 85) {
      this.triggerAlarm(707); // Code 707: Thermal Overload
    }

    // 3. Vibrasi & Power
    this.vibration = this.load / 50 + Math.random() * 2;
    this.power = this.load * 15 + Math.random() * 50;

    // 4. Random Failure Logic
    if (Math.random() < this.failChance) {
      this.triggerAlarm(600 + Math.floor(Math.random() * 50));
    }
  }

  private coolDown() {
    if (this.temp > 27) this.temp -= 0.3;
  }

  public triggerAlarm(code: number) {
    this.status = 2;
    this.alarmCode = code;
    this.load = 0;
  }

  public reset() {
    this.status = 1;
    this.alarmCode = 0;
    this.load = 80;
  }
}

@Injectable()
export class ModbusSimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AquaSimulator-V4-Pro');
  private readonly destroy$ = new Subject<void>();
  private machines: IndustrialMachine[] = [];

  private modbusServer: Server;
  private modbusInstance: any;
  private readonly PORT = 502;

  constructor(private readonly engine: RealTimeEngineService) {
    this.initializeFactory();
  }

  /**
   * 3. INITIALIZE 16 MACHINES
   */
  private initializeFactory() {
    const config = [
      {
        id: 'AQ-BLW-01',
        name: 'Blower Alpha',
        speed: 800,
        fail: 0.0001,
        t: 45,
      },
      {
        id: 'AQ-FIL-01',
        name: 'Filler High-Speed',
        speed: 500,
        fail: 0.0002,
        t: 38,
      },
      {
        id: 'AQ-CAP-01',
        name: 'Capper Rotary',
        speed: 600,
        fail: 0.0003,
        t: 40,
      },
      {
        id: 'AQ-LBL-01',
        name: 'Labeler Front',
        speed: 1000,
        fail: 0.0005,
        t: 50,
      },
      {
        id: 'AQ-PLT-01',
        name: 'Palletizer Robot',
        speed: 8000,
        fail: 0.002,
        t: 60,
      },
      { id: 'AQ-WRP-01', name: 'Wrapper 1', speed: 10000, fail: 0.0008, t: 42 },
      {
        id: 'AQ-CON-01',
        name: 'Main Conveyor',
        speed: 200,
        fail: 0.00001,
        t: 28,
      },
    ];

    this.machines = config.map(
      (c) => new IndustrialMachine(c.id, c.name, c.speed, c.fail, c.t),
    );
  }

  onModuleInit() {
    this.logger.log('🚀 Industrial Simulator V4 Pro - Starting...');
    this.startModbusServer();
    this.runSimulationLoops();
    this.startMaintenanceAI();
  }

  /**
   * 4. SIMULATION LOOPS (Physics & Engine Reporting)
   */
  private runSimulationLoops() {
    // --- Loop 1: Physics & Internal State (Cepat - 100ms) ---
    // Mengupdate suhu, vibrasi, counter, dan status kerusakan secara real-time.
    interval(100)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.machines.forEach((m) => m.updatePhysics());
      });

    // --- Loop 2: Engine Reporting (Setiap 1 Detik) ---
    // Mengirim snapshot data ke RealTime Engine secara paralel.
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        try {
          // 1. Map semua mesin menjadi array of Promises (tugas paralel)
          const reportTasks = this.machines.map(async (m) => {
            const data: MachineRegisters = {
              RUN_STOP_BIT: m.status ?? 0,
              BOTTLE_COUNTER: m.counter ?? 0,
              ALARM_CODE: m.alarmCode ?? 0,
              status: m.status ?? 0,
              counter: m.counter ?? 0,
              alarm: m.alarmCode ?? 0,
              temp: m.temp ?? 0,
              vibration: m.vibration ?? 0,
              power: m.power ?? 0,
              load: m.load ?? 0,
            };

            // Panggil engine secara async
            return this.engine.processNewData(m.id, m.name, data, 'Simulator');
          });

          // 2. Eksekusi semua pengiriman data secara serentak (Parallel)
          // Jauh lebih cepat daripada pakai loop 'for...of await'
          await Promise.all(reportTasks);
        } catch (err) {
          this.logger.error(
            `[Simulation Loop] Gagal memproses batch data: ${err.message}`,
          );
        }
      });
  }

  /**
   * 5. MAINTENANCE AI (Simulasi perbaikan otomatis)
   */
  private startMaintenanceAI() {
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.machines.forEach((m) => {
          if (m.status === 2) {
            // Jika Alarm
            // 20% chance diperbaiki setiap 5 detik
            if (Math.random() < 0.2) {
              this.logger.log(`🔧 Auto-Repairing ${m.id}...`);
              m.reset();
            }
          }
        });
      });
  }

  /**
   * 6. MODBUS TCP SERVER IMPLEMENTATION
   */
  private startModbusServer() {
    try {
      this.modbusServer = new Server();

      // SOLUSI CRASH: Alokasikan buffer holding register secara manual.
      // 4000 bytes = 2000 Registers. Sangat cukup untuk 16 mesin @ 50 regs.
      const holdingBuffer = Buffer.alloc(4000);

      this.modbusInstance = new Modbus.server.TCP(this.modbusServer, {
        holding: holdingBuffer,
      });

      // Event handler: Sebelum Client baca, kita isi dulu datanya ke Buffer
      this.modbusInstance.on('preReadHoldingRegisters', () => {
        this.mapDataToRegisters();
      });

      // Error handling internal modbus instance
      this.modbusInstance.on('error', (err) => {
        this.logger.error(`[Modbus Instance Error] ${err.message}`);
      });

      this.modbusServer.listen(this.PORT, () => {
        this.logger.log(`📡 Modbus TCP Server active on port ${this.PORT}`);
        this.logger.log(
          `📦 Allocated Holding Buffer: ${holdingBuffer.length} bytes`,
        );
      });

      this.modbusServer.on('error', (err) => {
        this.logger.error(`[TCP Server Error] ${err.message}`);
      });
    } catch (e) {
      this.logger.error(`[Critical] Failed to start Simulator: ${e.message}`);
    }
  }

  /**
   * 7. ADVANCED MEMORY MAPPING (Industrial Standard)
   * Setiap mesin dialokasikan 50 Register (Offset 100)
   */
  private mapDataToRegisters() {
    /**
     * @description Sinkronisasi data internal mesin ke Modbus Holding Register.
     * Fitur: Random Failure per mesin, Auto Recovery, Dynamic Sensor Scaling.
     * Kapasitas: 100 bytes (50 registers) per mesin.
     */
    const buf = this.modbusInstance.holding;
    const now = Date.now();

    this.machines.forEach((m: any, index) => {
      // Base offset 100 byte per mesin (16 mesin = 1600 bytes)
      const base = index * 100;

      try {
        // --- 1. INITIALIZATION STATE (Ensuring Unique Takdir per Mesin) ---
        if (m.nextAllowedError === undefined) m.nextAllowedError = 0;
        if (m.isRecovering === undefined) m.isRecovering = false;
        if (m.vibration === undefined) m.vibration = 0.1;
        if (m.power === undefined) m.power = 1500;
        if (m.load === undefined) m.load = 70;

        // --- 2. ADVANCED RANDOM FAILURE LOGIC ---
        // Syarat Error: Running, Tidak sedang recovery, Cooldown lewat, Peluang kena.
        const canFail =
          m.status === 1 && !m.isRecovering && now > m.nextAllowedError;

        // Probabilitas 0.05% per cycle per mesin agar tidak mati barengan
        const failProbability = 0.0005;
        const triggerError = Math.random() < failProbability;

        if (canFail && triggerError) {
          m.status = 0; // Set status ke STOPPED (Register 0)
          m.alarmCode = Math.floor(Math.random() * 9) + 1; // Code 1-9 (Register 3)
          m.isRecovering = true;

          this.logger.warn(
            `🚨 [FAILURE] ${m.name || 'Unit-' + (index + 1)} Breakdown! Error Code: ${m.alarmCode}`,
          );

          // Jeda perbaikan dipercepat: 5 detik sampai 15 detik
          const recoveryDuration = Math.floor(Math.random() * 10000) + 5000;

          setTimeout(() => {
            m.status = 1; // Kembali RUNNING
            m.alarmCode = 0;
            m.isRecovering = false;

            // Cooldown: 30 detik - 90 detik agar dinamisnya lebih stabil
            const nextCooldown = Math.floor(Math.random() * 60000) + 30000;
            m.nextAllowedError = Date.now() + nextCooldown;

            this.logger.log(
              `✅ [RECOVER] ${m.name || 'Unit-' + (index + 1)} perbaikan selesai. Cooldown aktif.`,
            );
          }, recoveryDuration);
        }

        // --- 3. DYNAMIC SENSOR SIMULATION (Hanya update jika status RUNNING) ---
        if (m.status === 1) {
          // Increment Counter: Nambah 1-3 botol per cycle
          m.counter = (m.counter ?? 0) + Math.floor(Math.random() * 3) + 1;

          // Simulasi Suhu: Fluktuasi di range 35.0°C - 42.0°C
          const tempChange = (Math.random() - 0.5) * 0.5;
          m.temp = Math.min(42, Math.max(35, (m.temp ?? 37) + tempChange));

          // Simulasi Vibrasi: Fluktuasi halus
          m.vibration = 0.1 + Math.random() * 0.4;

          // Simulasi Power & Load: 1400W - 1600W
          m.power = 1450 + Math.random() * 150;
          m.load = 65 + Math.random() * 15;
        } else {
          // Jika MATI: Suhu turun perlahan, sensor lain nol
          m.temp = Math.max(30, (m.temp ?? 30) - 0.05);
          m.vibration = 0;
          m.power = 0;
          m.load = 0;
        }

        // --- 4. MODBUS BUFFER WRITING (BIG ENDIAN) ---

        // [Reg 0]: Operational Status (UINT16)
        buf.writeUInt16BE(m.status ?? 0, base + 0);

        // [Reg 1-2]: Total Production Counter (UINT32 / DINT)
        // Dipecah menjadi High Word dan Low Word
        const currentCounter = Math.floor(m.counter ?? 0);
        buf.writeUInt16BE(Math.floor(currentCounter / 65536), base + 2); // Register 1
        buf.writeUInt16BE(currentCounter % 65536, base + 4); // Register 2

        // [Reg 3]: Active Alarm Code (UINT16)
        buf.writeUInt16BE(m.alarmCode ?? 0, base + 6);

        // [Reg 4]: Temperature Sensor (INT16, Scaled 100x)
        // Contoh: 37.55 -> 3755
        buf.writeUInt16BE(Math.floor((m.temp ?? 0) * 100), base + 8);

        // [Reg 5]: Vibration Sensor (UINT16, Scaled 100x)
        buf.writeUInt16BE(Math.floor((m.vibration ?? 0) * 100), base + 10);

        // [Reg 6-7]: Power Consumption (UINT32, Watts)
        const currentPower = Math.floor(m.power ?? 0);
        buf.writeUInt16BE(Math.floor(currentPower / 65536), base + 12); // Register 6
        buf.writeUInt16BE(currentPower % 65536, base + 14); // Register 7

        // [Reg 8]: Motor Load (UINT16, Percentage)
        buf.writeUInt16BE(Math.floor(m.load ?? 0), base + 16);

        // [Reg 9]: Heartbeat / Random Noise (UINT16)
        // Berguna bagi Client untuk mendeteksi data "frozen" atau tidak
        buf.writeUInt16BE(Math.floor(Math.random() * 65535), base + 18);

        // [Reg 10-49]: Reserved for Future Use (Diisi Nol)
        for (let r = 20; r < 100; r += 2) {
          buf.writeUInt16BE(0, base + r);
        }
      } catch (err) {
        this.logger.error(
          `[CRITICAL] Data Mapping Fail - Machine Index ${index}: ${err.message}`,
        );
      }
    });
  }

  /**
   * 8. EXTERNAL API FOR DASHBOARD OVERRIDE
   */
  public forceStop(id: string) {
    const m = this.machines.find((x) => x.id === id);
    if (m) m.triggerAlarm(999); // Manual Stop
  }

  public forceEmergencyAll() {
    this.logger.warn('⚠️ EMERGENCY STOP BROADCAST!');
    this.machines.forEach((m) => m.triggerAlarm(911));
  }

  onModuleDestroy() {
    this.logger.log('🛑 Shutting down Industrial Simulator...');
    this.destroy$.next();
    this.destroy$.complete();
    if (this.modbusServer) {
      this.modbusServer.close();
    }
  }
}
