import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BreakdownEventEntity } from './entities/breakdown-event/breakdown-event.entity';
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
                        host: configService.get<string>('DB_HOST', 'localhost'),
                        port: Number(configService.get<string>('DB_PORT', '5432')),
                        username: configService.get<string>('DB_USERNAME', 'postgres'),
                        password: configService.get<string>('DB_PASSWORD', 'postgres'),
                        database: configService.get<string>('DB_NAME', 'iiot_events_db'),
                        entities: [
                              UserEntity,
                              BreakdownEventEntity,
                        ],
                        synchronize: true,
                        dropSchema: false,
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
