import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineTelemetryGateway } from './machine-telemetry/machine-telemetry.gateway';
import { MachineHistoryController } from './machine-history/machine-history.controller';
import { MachineAnalyticsController } from './machine-analytics/machine-analytics.controller';
import { CoreEngineModule } from 'src/core-engine/core-engine.module';
import { BreakdownEventEntity } from 'src/database/entities/breakdown-event/breakdown-event.entity';
import { InfluxAnalyticsService } from 'src/database/influx/influx-analytics.service';
import { InfluxService } from 'src/database/influx/influx.service';
import { MachineHistoryService } from './machine-history/machine-history.service';
import { AuthModule } from 'src/auth/auth.module';

@Global()
  @Module({
    imports: [
      TypeOrmModule.forFeature([BreakdownEventEntity]),
      AuthModule,
      forwardRef(() => CoreEngineModule),
      CoreEngineModule,
    ],
    controllers: [
      MachineHistoryController,
      MachineAnalyticsController,
    ],
    providers: [
      MachineTelemetryGateway,
      MachineHistoryService,
      InfluxAnalyticsService,
      InfluxService
  ],
  exports: [MachineTelemetryGateway, MachineHistoryService],
})
export class MachineApiModule {}
