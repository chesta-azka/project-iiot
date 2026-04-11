import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './entities/user/user.entity';
import { BreakdownEventEntity } from './entities/breakdown-event/breakdown-event.entity';
import { InfluxService } from './influx/influx.service';

/**
 * PROJECT IIOT - DATABASE MODULE (POV: GUA)
 * Note buat diri sendiri: 
 * Jangan ganti-ganti host manual lagi, udah gua bikin auto-detect!
 */
@Global()
@Module({
      imports: [
            // 1. Setting TypeORM Async biar bisa baca .env
            TypeOrmModule.forRootAsync({
                  imports: [ConfigModule],
                  inject: [ConfigService],
                  useFactory: (configService: ConfigService) => {

                        // Logika POV: Cek apakah lagi running di Docker atau Lokal Windows
                        // Kalau DATABASE_URL isinya 'postgres', berarti lagi di dalem Docker Network
                        const isRunningInDocker = configService.get<string>('DATABASE_URL')?.includes('postgres:5432');

                        return {
                              type: 'postgres',

                              // POV: Kalau gua running 'npm run start:dev' di VS Code, pake localhost.
                              // Kalau jalan di Docker Compose, pake nama service 'postgres'.
                              host: isRunningInDocker ? 'postgres' : 'localhost',

                              // Port mapping: Lokal pake 5433 (biar gak bentrok sama Postgres Windows),
                              // Internal Docker tetep pake 5432.
                              port: isRunningInDocker ? 5432 : 5433,

                              username: configService.get<string>('DB_USERNAME') || 'user_iiot',
                              password: configService.get<string>('DB_PASSWORD') || 'securepassword',
                              database: configService.get<string>('DB_NAME') || 'iiot_events_db',

                              // List tabel-tabel yang gua butuhin buat IIOT
                              entities: [
                                    UserEntity,
                                    BreakdownEventEntity,
                              ],

                              // POV: Biar gak ribet bikin tabel manual, gua nyalain synchronize.
                              // Tapi dropSchema gua matiin (false) biar data mesin gak ilang pas save kodingan!
                              synchronize: true,
                              dropSchema: false,

                              // Kasih log SQL kalau lagi development biar gampang debug
                              logging: configService.get('NODE_ENV') === 'development',

                              // Settingan biar koneksi gak gampang putus kalo Docker lagi berat
                              keepConnectionAlive: true,
                              retryAttempts: 10,
                              retryDelay: 3000,
                        };
                  },
            }),

            // 2. Register Entity buat dipake di Service/Controller lain
            TypeOrmModule.forFeature([
                  UserEntity,
                  BreakdownEventEntity
            ]),
      ],

      // InfluxDB masuk sini juga biar satu pintu urusan data
      providers: [
            InfluxService
      ],

      // Export semuanya biar modul kayak 'MachineModule' tinggal pake
      exports: [
            TypeOrmModule,
            InfluxService
      ],
})
export class DatabaseModule {
      constructor() {
            // Log biar gua tau database udah ready pas startup
            console.log('==============================================');
            console.log('🚀 DATABASE MODULE: KONEKSI AMAN, GASSKEUN! ');
            console.log('==============================================');
      }
}