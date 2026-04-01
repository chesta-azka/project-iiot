import { Module, forwardRef } from '@nestjs/common';
import { ModbusSimulatorService } from './modbus-simulator/modbus-simulator.service';
import { ModbusClientService } from './modbus-client/modbus-client.service';
import { PollingSchedulerService } from './polling-scheduler/polling-scheduler.service';
import { CoreEngineModule } from 'src/core-engine/core-engine.module';
import { MachineApiModule } from 'src/machine-api/machine-api.module';

@Module({
  imports: [
    forwardRef(() => CoreEngineModule), // Agar bisa melakukan RealTimeEngineService
    MachineApiModule, // Agar bisa akses MachineTelemetryGateway
  ], 
  providers: [
    ModbusSimulatorService,
    ModbusClientService,
    PollingSchedulerService,
  ],
  // Export ModbusSimulatorService jika modul lain perlu mengaksesnya
  exports: [
    ModbusSimulatorService,
    ModbusClientService,
  ],
})
export class SimulatorModule {}
