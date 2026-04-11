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
                  useFactory: (configService: ConfigService) => ({
                        type: 'postgres',
                        host: configService.get<string>('DB_HOST', 'localhost'),
                        port: Number(configService.get<string>('DB_PORT', '5433')),
                        username: configService.get<string>('DB_USERNAME', 'user_iiot'),
                        password: configService.get<string>('DB_PASSWORD', 'securepassword'),
                        database: configService.get<string>('DB_NAME', 'iiot_events_db'),
                        entities: [
                              UserEntity,
                              BreakdownEventEntity,
                        ],
                        synchronize: true,
                        dropSchema: false,
                        logging: false,
                  }),
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