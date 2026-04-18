import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineHistoryController } from './machine-history.controller';
import { MachineHistoryService } from './machine-history.service';
import { InfluxAnalyticsService } from 'src/database/influx/influx-analytics.service';
import { InfluxService } from 'src/database/influx/influx.service';
import { BreakdownEventEntity } from 'src/database/entities/breakdown-event/breakdown-event.entity';
import { CoreEngineModule } from 'src/core-engine/core-engine.module';

@Module({
  imports: [
    // DAFTARKAN ENTITY AGAR REPOSITORY BISA DIPAKAI
    TypeOrmModule.forFeature([BreakdownEventEntity]),
    CoreEngineModule,
  ],
  controllers: [
    // DAFTARKAN CONTROLLER
    MachineHistoryController,
  ],
  providers: [
    // DAFTARKAN SEMUA SERVICE YANG DI-INJECT KE CONSTRUCTOR
    MachineHistoryService,
    InfluxAnalyticsService,
    InfluxService, // InfluxAnalyticsService butuh InfluxService, jadi ini harus ada juga
  ],
})
export class MachineHistoryModule {}
