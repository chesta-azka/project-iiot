import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';

@Injectable()
export class InfluxService implements OnModuleInit {
      private readonly logger = new Logger(InfluxService.name);
      private influxDB?: InfluxDB;
      private writeApi?: WriteApi;
      private enabled = false;

      getBucket(): string {
            return this.configService.get<string>('INFLUX_BUCKET', 'iiot_raw_data');
      }

      getQueryApi() {
            if (!this.enabled || !this.influxDB) {
                  return null;
            }

            return this.influxDB.getQueryApi(this.configService.get<string>('INFLUX_ORG', 'ChestaCorp'));
      }

      constructor(private configService: ConfigService) { }
      
      onModuleInit() {
            const enabled = this.configService.get<string>('INFLUX_ENABLED', 'false');
            this.enabled = enabled === 'true';

            if (!this.enabled) {
                  this.logger.warn('InfluxDB integration disabled via INFLUX_ENABLED=false');
                  return;
            }

            // Ambil dari environment variable (docker-compose / .env)
            const url = this.configService.get<string>('INFLUX_URL') || 'http://influxdb:8086';
            const token = this.configService.get<string>('INFLUX_TOKEN');
            const org = this.configService.get<string>('INFLUX_ORG') || 'ChestaCorp';
            const bucket = this.configService.get<string>('INFLUX_BUCKET') || 'iiot_raw_data';

            this.logger.log(`Connecting to InfluxDB at ${url} (Org: ${org}, Bucket: ${bucket})`);

            this.influxDB = new InfluxDB({ url, token });
            this.writeApi = this.influxDB.getWriteApi(org, bucket);
      }

      /**
       * Menyimpan data polling sensor ke InfluxDB
       */

      async writePoint(machineId: string, status: number, counter: number, alarm: number, shiftName: string) {
            if (!this.enabled || !this.writeApi) {
                  return;
            }

            try {
                  const point = new Point('machine_telemetry')
                        .tag('machineId', machineId)
                        .tag('shift', shiftName)
                        .intField('status', status)
                        .intField('counter', counter)
                        .intField('alarm', alarm)
                        .timestamp(new Date());

                  this.writeApi.writePoint(point);

                  // Tambahkan ini supaya data langsung dikirim ke database
                  await this.writeApi.flush();

                  this.logger.verbose(`Data sent to InfluxDB for ${machineId}`);
            } catch (error) {
                  this.logger.error('Failed to write to InfluxDB', error.message);
            }
      }

      // PENTING: Tutup koneksi saat aplikasi mati
      async onMOoduleDestroy() {
            if (this.writeApi) {
                  await this.writeApi.close();
            }
      }
}
