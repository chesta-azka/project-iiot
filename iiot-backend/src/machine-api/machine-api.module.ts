import { forwardRef, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineTelemetryGateway } from './machine-telemetry/machine-telemetry.gateway';
import { MachineHistoryController } from './machine-history/machine-history.controller';
import { MachineAnalyticsController } from './machine-analytics/machine-analytics.controller';
<<<<<<< HEAD
import { ShiftSummaryController } from './shift-summary/shift-summary.controller';
=======
import { PdtController } from './pdt/pdt.controller';
>>>>>>> afgan
import { CoreEngineModule } from 'src/core-engine/core-engine.module';
import { BreakdownEventEntity } from 'src/database/entities/breakdown-event/breakdown-event.entity';
import { InfluxAnalyticsService } from 'src/database/influx/influx-analytics.service';
import { MachineHistoryService } from './machine-history/machine-history.service';
import { PdtService } from './pdt/pdt.service';
import { AuthModule } from 'src/auth/auth.module';

import { PageDashboardController } from './page-dashboard.controller';
import { PageLineController } from './page-line.controller';
import { PageMachineStatusController } from './page-machine-status.controller';
import { PageScreenDeliveryController } from './page-screen-delivery.controller';
import { FrontendBroadcastService } from './frontend-broadcast.service';

@Global()
<<<<<<< HEAD
@Module({
  imports: [
    TypeOrmModule.forFeature([BreakdownEventEntity]),
    AuthModule,
    forwardRef(() => CoreEngineModule),
  ],
  controllers: [
    MachineHistoryController,
    MachineAnalyticsController,
    ShiftSummaryController,
    PageDashboardController,
    PageLineController,
    PageMachineStatusController,
    PageScreenDeliveryController,
  ],
  providers: [
    MachineTelemetryGateway,
    MachineHistoryService,
    InfluxAnalyticsService,
    FrontendBroadcastService,
=======
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
      PdtController,
    ],
    providers: [
      MachineTelemetryGateway,
      MachineHistoryService,
      InfluxAnalyticsService,
      PdtService,
>>>>>>> afgan
  ],
  exports: [MachineTelemetryGateway, MachineHistoryService, PdtService],
})
export class MachineApiModule {}
