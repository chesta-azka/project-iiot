import { Module, forwardRef } from '@nestjs/common';
import { RealTimeEngineService } from './engine/engine.service';
import { ShiftService } from './shift/shift.service';
import { PollingSchedulerService } from '../simulator/polling-scheduler/polling-scheduler.service';
import { SimulatorModule } from '../simulator/simulator.module';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaModule } from '../../prisma/prisma.module'; // <--- Arahin ke module baru tadi
import { MachineApiModule } from 'src/machine-api/machine-api.module';

// core-engine.module.ts
@Module({
  imports: [
    PrismaModule,
    DatabaseModule,
    forwardRef(() => SimulatorModule), // <--- WAJIB PAKE INI
    forwardRef(() => MachineApiModule),
  ],
  providers: [RealTimeEngineService, ShiftService, PollingSchedulerService],
  exports: [RealTimeEngineService, ShiftService],
})
export class CoreEngineModule {}
