import { Test, TestingModule } from '@nestjs/testing';
import { ModbusSimulatorService } from './modbus-simulator.service';

describe('ModbusSimulatorService', () => {
  let service: ModbusSimulatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModbusSimulatorService],
    }).compile();

    service = module.get<ModbusSimulatorService>(ModbusSimulatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
