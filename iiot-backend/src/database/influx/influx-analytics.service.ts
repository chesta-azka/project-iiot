import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InfluxService } from './influx.service';

// Interface untuk hasil data point agar rapi
export interface ProductionDataPoint {
      time: string | Date;
      value: number;
}

@Injectable()
export class InfluxAnalyticsService {
      private readonly logger = new Logger(InfluxAnalyticsService.name);

      constructor(private readonly influxBase: InfluxService) { }

      /**
       * Mengambil trend produksi dengan parameter dinamis
       * @param machineId ID Mesin
       * @param range Rentang waktu (contoh: '-1h', '-24h', '-7d')
       * @param window Interval grouping (contoh: '5m', '1h')
       */
      async getProductionTrend(
            machineId: string,
            range: string = '-24h',
            window: string = '1h'
      ): Promise<ProductionDataPoint[]> {

            // Query Flux yang lebih dinamis dan rapi
            const fluxQuery = `
      from(bucket: "${this.influxBase.getBucket()}")
      |> range(start: ${range})
      |> filter(fn: (r) => r["_measurement"] == "machine_telemetry")
      |> filter(fn: (r) => r["machineId"] == "${machineId}")
      |> filter(fn: (r) => r["_field"] == "counter")
      |> aggregateWindow(every: ${window}, fn: last, createEmpty: false)
      |> sort(columns: ["_time"], desc: false)
      |> spread()
`;


            try {
                  const queryApi = this.influxBase.getQueryApi();
                  const results: ProductionDataPoint[] = [];

                  return new Promise((resolve, reject) => {
                        queryApi.queryRows(fluxQuery, {
                              next: (row, tableMeta) => {
                                    const o = tableMeta.toObject(row);
                                    results.push({
                                          time: o._time,
                                          value: Number(o._value) || 0,
                                    });
                              },
                              error: (error) => {
                                    this.logger.error(`Flux Query Execution Error: ${error.message}`);
                                    reject(new InternalServerErrorException('Gagal mengambil data dari InfluxDB'));
                              },
                              complete: () => {
                                    resolve(results);
                              },
                        });
                  });
            } catch (error) {
                  this.logger.error(`System Error: ${error.message}`);
                  return [];
            }
      }
}