import { Controller, Get, Query, UseGuards, Logger, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user/user.entity';
import { MachineHistoryService } from './machine-history.service';
import { InfluxAnalyticsService } from '../../database/influx/influx-analytics.service';
import { HistoryQueryDto } from '../dto/history-query.dto';

@ApiTags('Machine History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('machine-history')
export class MachineHistoryController {
      // Gunakan konteks class yang benar untuk Logger
      private readonly logger = new Logger(MachineHistoryController.name);

      constructor(
            private readonly machineHistoryService: MachineHistoryService,
            private readonly influxAnalyticsService: InfluxAnalyticsService,
      ) { }


      @Get('history')
      @Roles(UserRole.SUPERVISOR, UserRole.MANAGER)
      @ApiOperation({ summary: 'Ambil daftar breakdown dengan pagination (Khusus Supervisor/Admin)' })
      @ApiResponse({ status: 200, description: 'Daftar history berhasil diambil' })
      // Kita menggunakan DTO secara penuh untuk kebersihan kode
      async getHistory(@Query() query: HistoryQueryDto) {
            const { limit, page, machineId } = query;
            this.logger.log(`Fetching breakdown history - Page: ${page}, Limit: ${limit}`);

            return this.machineHistoryService.findAll(
                  Number(limit) ?? 10,
                  Number(page) ?? 1,
                  machineId
            );
      }
}