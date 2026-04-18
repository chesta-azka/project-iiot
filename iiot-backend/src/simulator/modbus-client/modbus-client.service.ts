import {
  Injectable,
  OnModuleInit,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Modbus from 'jsmodbus';
import * as net from 'net';
import { interval, Subscription, Subject, filter, exhaustMap } from 'rxjs';
import { PrismaService } from 'prisma/prisma.service';

/**
 * Interface data mesin hasil parsing
 */
export interface MachineData {
  id: string;
  name: string;
  runStop: number;
  counter: number;
  alarmCode: number;
  primarySensor: number;
  timestamp: Date;
}

@Injectable()
export class ModbusClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModbusClientService.name);
  private client!: Modbus.ModbusTCPClient;
  private socket!: net.Socket;
  private pollingSubscription!: Subscription;

  // 1. Subject untuk broadcast data ke service lain secara internal
  private readonly dataSubject = new Subject<MachineData[]>();
  public readonly machineData$ = this.dataSubject.asObservable();

  // Konfigurasi Mapping
  private readonly REGISTERS_PER_MACHINE = 10;
  private readonly TOTAL_MACHINES = 7;

  private readonly machineIDs = [
    'AQ-BLW-01',
    'AQ-FIL-01',
    'AQ-CAP-01',
    'AQ-LBL-01',
    'AQ-PLT-01',
    'AQ-WRP-01',
    'AQ-CON-01',
  ];


  constructor(private configService: ConfigService) { }

  onModuleInit() {
    this.setupClient();
  }

  /**
   * INISIALISASI KONEKSI TCP & MODBUS CLIENT
   */
  private setupClient() {
    this.socket = new net.Socket();
    this.client = new Modbus.client.TCP(this.socket);

    const options = {
      host: this.configService.get<string>('PLC_IP') || '127.0.0.1',
      port: parseInt(this.configService.get<string>('PLC_PORT') || '502'),
    };

    // Event handler: Saat terkoneksi
    this.socket.on('connect', () => {
      this.logger.log(
        `✅ Connected to Modbus Server at ${options.host}:${options.port}`,
      );
      this.startPolling();
    });

    // Event handler: Saat terjadi error
    this.socket.on('error', (err) => {
      this.logger.error(`❌ Modbus Socket Error: ${err.message}`);
      this.stopPolling();
    });

    // Event handler: Saat koneksi terputus
    this.socket.on('close', () => {
      this.logger.warn('⚠️ Connection closed. Retrying in 5s...');
      this.stopPolling();
      setTimeout(() => this.reconnect(options), 5000);
    });

    this.logger.log(`Connecting to Modbus Gateway at ${options.host}...`);
    this.socket.connect(options);
  }

  private reconnect(options: net.SocketConnectOpts) {
    if (!this.socket.connecting && this.socket.readyState !== 'open') {
      this.socket.connect(options);
    }
  }

  /**
   * LOGIKA POLLING OTOMATIS
   * Menggunakan exhaustMap agar jika PLC lambat, request berikutnya tidak menumpuk.
   */
  private startPolling() {
    this.stopPolling(); // Bersihkan subscription lama jika ada

    this.pollingSubscription = interval(2000)
      .pipe(
        // Hanya jalan jika socket benar-benar terbuka
        filter(() => this.socket.readyState === 'open'),
        // exhaustMap: Abaikan interval baru jika proses fetch sebelumnya belum selesai
        exhaustMap(async () => {
          try {
            const data = await this.fetchAllMachinesData();
            if (data) {
              this.dataSubject.next(data); // Broadcast data ke subscriber
              // this.logger.debug(`Data polled for ${data.length} machines`);
            }
          } catch (err) {
            this.logger.error(`Polling execution failed: ${err.message}`);
          }
        }),
      )
      .subscribe();

    this.logger.log('🚀 Automated Data Polling Started (Every 2s)');
  }

  private stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  private generateMachineData() {
    return this.machineIDs.map(id => {
      // itung atau random dulu PR-nya di sini

      const performanceRate = Math.floor(Math.random() * (100 - 75 + 1) + 75);

      return {
        machineId: id,
        status: Math.random() > 0.2 ? 'RUNNING' : 'STOPPED',
        pr: performanceRate, // <--- Tambah PR di sini
        lastUpdate: new Date().toISOString()
      };
    });
  }

  /**
   * READ DATA MASSAL (Holding Registers)
   */
  async fetchAllMachinesData(): Promise<MachineData[] | null> {
    try {
      // 1. Safety Check: Pastikan koneksi ready
      if (!this.socket || this.socket.readyState !== 'open') {
        this.logger.warn('⚠️ Modbus socket is not open, skipping fetch.');
        return null;
      }

      const results: MachineData[] = [];

      // Daftar ID yang harus sinkron dengan Database & Simulator
  
      // Gunakan offset 50 register (sesuai jatah 100 byte per mesin di Simulator)
      const OFFSET = 50;

      for (let i = 0; i < this.TOTAL_MACHINES; i++) {
        const startAddress = i * OFFSET;
        const mId = this.machineIDs[i];

        try {
          // 2. Tarik 10 register (cukup untuk menampung status sampai load)
          const response = await this.client.readHoldingRegisters(
            startAddress,
            10,
          );
          const regs = response.response.body.valuesAsArray;

          // 3. Kalkulasi Data 32-bit (Big Endian)
          const fullCounter = regs[1] * 65536 + regs[2]; // Register 1 & 2
          const fullPower = regs[6] * 65536 + regs[7]; // Register 6 & 7

          // 4. Mapping ke Interface MachineData
          results.push({
            id: mId,
            name: mId.replace('AQ-', 'Machine '), // Generate nama otomatis (e.g., Machine BLW-01)
            index: i,
            status: regs[0], // Reg 0
            counter: fullCounter, // Reg 1-2
            alarmCode: regs[3], // Reg 3
            primarySensor: regs[4] / 100, // Reg 4 (Temp/Sensor Utama)

            // Data tambahan untuk analytics
            temp: regs[4] / 100,
            vibration: regs[5] / 100, // Reg 5
            power: fullPower, // Reg 6-7
            load: regs[8], // Reg 8
            timestamp: new Date(),
          } as any);
        } catch (err) {
          // Jika satu mesin gagal, catat ID-nya dan lanjut ke mesin berikutnya
          this.logger.error(
            `❌ Gagal ambil data ${mId} di Addr ${startAddress}: ${err.message}`,
          );
          continue;
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`❌ Global Modbus Fetch Error: ${error.message}`);
      return null;
    }
  }

  /**
   * KIRIM PERINTAH KE PLC
   */
  async writeToPLC(register: number, value: number): Promise<boolean> {
    try {
      if (this.socket.readyState !== 'open') {
        throw new Error('Socket not connected');
      }

      await this.client.writeSingleRegister(register, value);
      this.logger.log(`📡 Command Sent: Register ${register} = ${value}`);
      return true;
    } catch (err) {
      this.logger.error(`❌ Failed to write to PLC: ${err.message}`);
      return false;
    }
  }

  /**
   * CLEANUP SAAT MODULE DIMATIKAN
   */
  onModuleDestroy() {
    this.stopPolling();
    if (this.socket) {
      this.socket.destroy();
    }
    this.logger.log('Modbus Service Destroyed.');
  }
}
