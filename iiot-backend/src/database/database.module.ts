import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BreakdownEventEntity } from './entities/breakdown-event/breakdown-event.entity';
import { Type } from 'class-transformer';
import { InfluxService } from './influx/influx.service';
import { UserEntity } from './entities/user/user.entity';

@Global()
@Module({
      imports: [
            // Konfigurasi TypeORM (PostgreSQL)
            TypeOrmModule.forRootAsync({
                  imports: [ConfigModule],
                  inject: [ConfigService],
                  useFactory: (configService: ConfigService) => ({
                        type: 'postgres',
                        host: 'localhost',
                        port: 5432,
                        username: 'user_iiot',      
                        password: 'securepassword',
                        database: 'iiot_events_db',
                        // Array entities akan diisi di langkah berikut nya
                        entities: [
                              UserEntity,
                              BreakdownEventEntity,
                        ],
                        // PENTING: Untuk development, agar schema di buat otomatis
                        synchronize: true,
                        dropSchema: true,
                  }),
            }),
            // Daftarkan Entity agar Modul lain bisa menggunakan nya
            TypeOrmModule.forFeature([BreakdownEventEntity, UserEntity]),
      ],
      providers: [InfluxService],
      // Export Module agar bisa di akases Core Engine nanti
      exports: [TypeOrmModule.forFeature([BreakdownEventEntity, UserEntity]), InfluxService],
})
export class DatabaseModule {}
