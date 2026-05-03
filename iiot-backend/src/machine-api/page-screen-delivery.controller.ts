import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RealTimeEngineService } from 'src/core-engine/engine/engine.service';

@ApiTags('Page - Screen Delivery')
@ApiBearerAuth()
@Controller('page-screen-delivery')
export class PageScreenDeliveryController {
  private readonly logger = new Logger(PageScreenDeliveryController.name);

  constructor(private readonly engineService: RealTimeEngineService) {}

  @Get(':lineId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mendapatkan formasi / metrics untuk layar Screen Delivery',
  })
  @ApiParam({
    name: 'lineId',
    example: '1',
    description: 'ID Line Produksi',
  })
  @ApiResponse({
    status: 200,
    description: 'Screen delivery metrics berhasil diambil.',
  })
  getScreenDelivery(@Param('lineId') lineId: string) {
    this.logger.log(`Fetching Page Screen Delivery for ${lineId}`);
    const liveMachines = this.engineService.getAllTrackersWithId();

    const target = 1000 * liveMachines.length;
    const actual = liveMachines.reduce(
      (acc, m) => acc + (m.lastBottleCount || 0),
      0,
    );

    return {
      success: true,
      data: {
        lineId,
        target,
        actual,
        gap: target - actual,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
