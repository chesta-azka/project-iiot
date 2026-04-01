import { Module, forwardRef } from '@nestjs/common';
import { RealTimeEngineService } from './engine/engine.service';
// --- Import TypeORM dan Entity ---
import { TypeOrmModule } from '@nestjs/typeorm';
import { BreakdownEventEntity } from 'src/database/entities/breakdown-event/breakdown-event.entity';
// ---------------------------------
import { MachineApiModule } from 'src/machine-api/machine-api.module';
import { ShiftService } from './shift/shift.service';
import { PollingSchedulerService } from '../simulator/polling-scheduler/polling-scheduler.service';
import { SimulatorModule} from '../simulator/simulator.module';
import { DatabaseModule } from 'src/database/database.module';


@Module({
  imports: [
    // Daftarkan Entity yang akan digunakan oleh CoreEngineService
    TypeOrmModule.forFeature([BreakdownEventEntity]),
    forwardRef(() => SimulatorModule),
    DatabaseModule,
  ],
  providers: [
    RealTimeEngineService,
    ShiftService,
    PollingSchedulerService,
  ],
  // Penting: Export service ini agar bisa diinjeksi oleh PollingSchedulerService
  exports: [RealTimeEngineService, ShiftService],
})
export class CoreEngineModule {}
