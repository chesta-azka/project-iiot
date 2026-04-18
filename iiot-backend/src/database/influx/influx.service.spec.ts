import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InfluxService } from './influx.service';

describe('InfluxService', () => {
  let service: InfluxService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfluxService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<InfluxService>(InfluxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
