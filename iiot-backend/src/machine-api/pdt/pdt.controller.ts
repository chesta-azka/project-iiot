import { Controller, Post, Body, Get, UseGuards, Request, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PdtService } from './pdt.service';
import { CreatePdtDto } from '../dto/create-pdt.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities/user/user.entity';

@ApiTags('Planned Down Time (PDT)')
@ApiBearerAuth()
//@UseGuards(JwtAuthGuard, RolesGuard) // Guard di-comment sementara seperti controller lainnya
@Controller('pdt')
export class PdtController {
  constructor(private readonly pdtService: PdtService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.PPIC, UserRole.MANAGER) // Hanya PPIC & Manager
  @ApiOperation({ summary: 'Submit Planned Down Time (Mekanisme Lock-on-Submit)' })
  @ApiResponse({ status: 201, description: 'PDT berhasil dibuat dan di-lock (Read-Only)' })
  async createPdt(@Body() createPdtDto: CreatePdtDto, @Request() req: any) {
    const username = req.user?.username || 'PPIC_User';
    
    const result = await this.pdtService.createPlannedDowntime(createPdtDto, username);
    return {
      success: true,
      message: 'PDT record successfully created and locked.',
      data: result,
    };
  }

  @Get()
  @Roles(UserRole.PPIC, UserRole.MANAGER, UserRole.SUPERVISOR)
  @ApiOperation({ summary: 'Mendapatkan daftar Planned Down Time (Read Only List)' })
  async getPdtList() {
    const records = await this.pdtService.getAllPdt();
    return {
      success: true,
      data: records,
    };
  }
}
