import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreatePdtDto } from '../dto/create-pdt.dto';
import { UpdatePdtDto } from '../dto/update-pdt.dto';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class PdtService {
  private readonly logger = new Logger(PdtService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

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

  async unlockAndUpdatePdt(id: number, dto: UpdatePdtDto, username: string) {
    this.logger.log(`Attempting to unlock/update PDT ${id} by ${username}`);

    // 1. Validasi Password Si Pengguna via AuthService
    const isValid = await this.authService.validatePassword(
      username,
      dto.password,
    );
    if (!isValid) {
      throw new UnauthorizedException(
        'Password salah. Gagal membuka kunci data PDT!',
      );
    }

    // 2. Cek apakah record PDT ada
    const record = await this.prisma.plannedDowntime.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Data PDT tidak ditemukan');
    }

    // 3. Proses Update Nilainya
    // Hapus field password agar tidak disimpan salah sasaran
    const { password, ...updateData } = dto;

    const plainUpdateData: any = { ...updateData, isLocked: false }; // Jika mau unlock total, set isLocked ke false
    if (updateData.planDate) {
      plainUpdateData.planDate = new Date(updateData.planDate);
    }

    return this.prisma.plannedDowntime.update({
      where: { id },
      data: plainUpdateData,
    });
  }
}
