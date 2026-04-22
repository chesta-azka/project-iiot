import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreatePdtDto } from '../dto/create-pdt.dto';

@Injectable()
export class PdtService {
  private readonly logger = new Logger(PdtService.name);

  constructor(private prisma: PrismaService) {}

  async createPlannedDowntime(dto: CreatePdtDto, username: string) {
    this.logger.log(`Creating PDT for machine ${dto.machineId} by ${username}`);
    
    // Status Lock: Segera setelah data tersimpan, field input untuk record tersebut
    // akan diubah menjadi Read-Only di sisi UI. Oleh karena itu isLocked di-set true.
    return this.prisma.plannedDowntime.create({
      data: {
        machineId: dto.machineId,
        planDate: new Date(dto.planDate),
        duration: dto.duration,
        reason: dto.reason,
        isLocked: true, 
        submittedBy: username,
      },
    });
  }

  async getAllPdt() {
    return this.prisma.plannedDowntime.findMany({
      include: {
        machine: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
