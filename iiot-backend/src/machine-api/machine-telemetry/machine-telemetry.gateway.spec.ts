import { Test, TestingModule } from '@nestjs/testing';
import { MachineTelemetryGateway } from './machine-telemetry.gateway';

describe('MachineTelemetryGateway', () => {
  let gateway: MachineTelemetryGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MachineTelemetryGateway],
    }).compile();

    gateway = module.get<MachineTelemetryGateway>(MachineTelemetryGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
