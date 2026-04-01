import { Test, TestingModule } from '@nestjs/testing';
import { PollingSchedulerService } from './polling-scheduler.service';

describe('PollingSchedulerService', () => {
  let service: PollingSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PollingSchedulerService],
    }).compile();

    service = module.get<PollingSchedulerService>(PollingSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
