import { Module, forwardRef } from '@nestjs/common';
import { RealTimeEngineService } from './engine/engine.service';
import { ShiftService } from './shift/shift.service';
import { ShiftSummaryService } from './shift/shift-summary.service';
import { PollingSchedulerService } from '../simulator/polling-scheduler/polling-scheduler.service';
import { SimulatorModule } from '../simulator/simulator.module';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MachineApiModule } from 'src/machine-api/machine-api.module';

// core-engine.module.ts
@Module({
  imports: [
    PrismaModule,
    DatabaseModule,
    forwardRef(() => SimulatorModule),
    forwardRef(() => MachineApiModule),
  ],
  providers: [RealTimeEngineService, ShiftService, ShiftSummaryService, PollingSchedulerService],
  exports: [RealTimeEngineService, ShiftService, ShiftSummaryService],
})
export class CoreEngineModule {}

