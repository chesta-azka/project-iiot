import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Modbus from 'jsmodbus';
import * as net from 'net';
import { interval, Subscription, Subject, filter, exhaustMap } from 'rxjs';

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
      private client: Modbus.ModbusTCPClient;
      private socket: net.Socket;
      private pollingSubscription: Subscription;

      // 1. Subject untuk broadcast data ke service lain secara internal
      private readonly dataSubject = new Subject<MachineData[]>();
      public readonly machineData$ = this.dataSubject.asObservable();

      // Konfigurasi Mapping
      private readonly REGISTERS_PER_MACHINE = 10;
      private readonly TOTAL_MACHINES = 16;

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
                  this.logger.log(`✅ Connected to Modbus Server at ${options.host}:${options.port}`);
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
                        })
                  )
                  .subscribe();

            this.logger.log('🚀 Automated Data Polling Started (Every 2s)');
      }

      private stopPolling() {
            if (this.pollingSubscription) {
                  this.pollingSubscription.unsubscribe();
            }
      }

      /**
       * READ DATA MASSAL (Holding Registers)
       */
      async fetchAllMachinesData(): Promise<MachineData[] | null> {
            try {
                  // 1. Cek koneksi dulu sebelum tempur
                  if (!this.socket || this.socket.readyState !== 'open') {
                        this.logger.warn('⚠️ Modbus socket is not open, skipping fetch.');
                        return null;
                  }

                  const results: MachineData[] = [];
                  const machineNames = [
                        'AQ-BLW-01', 'AQ-BLW-02', 'AQ-FIL-01', 'AQ-FIL-02',
                        'AQ-CAP-01', 'AQ-CAP-02', 'AQ-LBL-01', 'AQ-LBL-02',
                        'AQ-INK-01', 'AQ-INK-02', 'AQ-PCK-01', 'AQ-PCK-02',
                        'AQ-PLT-01', 'AQ-WRP-01', 'AQ-WRP-02', 'AQ-CON-01'
                  ];

                  // 2. Loop per mesin - Strategi cicilan agar paket data kecil (< 255 byte)
                  for (let i = 0; i < this.TOTAL_MACHINES; i++) {
                        // Address awal mesin ini (Contoh: Mesin 0 di reg 0, Mesin 1 di reg 50, dst)
                        const startAddress = i * this.REGISTERS_PER_MACHINE;

                        try {
                              // Tarik data hanya sejumlah REGISTERS_PER_MACHINE (misal 50)
                              // Ini akan menghasilkan payload ~100 byte (Aman dari limit Modbus)
                              const response = await this.client.readHoldingRegisters(
                                    startAddress,
                                    this.REGISTERS_PER_MACHINE
                              );

                              const rawData = response.response.body.valuesAsArray;

                              // 3. Mapping data sesuai logic Simulator (mapDataToRegisters)
                              // Ingat: rawData di sini sudah relatif dari index 0 karena kita bacanya per blok mesin

                              // Gabung 2 register (32-bit) untuk Counter
                              const highCounter = rawData[1]; // Byte 2 & 3 di simulator
                              const lowCounter = rawData[2]; // Byte 4 & 5 di simulator
                              const fullCounter = (highCounter * 65536) + lowCounter;

                              // Gabung 2 register (32-bit) untuk Power
                              const highPower = rawData[6];
                              const lowPower = rawData[7];
                              const fullPower = (highPower * 65536) + lowPower;

                              results.push({
                                    id: `MACHINE-${i + 1}`,
                                    index: i, // Penting buat identifikasi di scheduler
                                    name: machineNames[i] || `Unit AQUA Line ${i + 1}`,

                                    // Logic: Simulator kirim angka mentah, kita pecah di sini
                                    status: rawData[0],         // Reg 0
                                    counter: fullCounter,       // Reg 1 & 2
                                    alarm: rawData[3],          // Reg 3 (alarmCode)

                                    // Simulator scaling x100, jadi di sini kita bagi 100
                                    temp: rawData[4] / 100,     // Reg 4
                                    vibration: rawData[5] / 100, // Reg 5

                                    power: fullPower,           // Reg 6 & 7
                                    load: rawData[8],           // Reg 8

                                    timestamp: new Date()
                              } as any);

                        } catch (err) {
                              // Jika satu mesin gagal, jangan stop semua, skip aja ke mesin berikutnya
                              this.logger.error(`❌ Failed to fetch Machine ${i} at Address ${startAddress}: ${err.message}`);
                              continue;
                        }
                  }

                  return results;

            } catch (error) {
                  this.logger.error(`❌ Global Fetch Error: ${error.message}`);
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