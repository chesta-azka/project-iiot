import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Biar bisa dipake di mana aja tanpa import berulang kali
@Module({
      providers: [PrismaService],
      exports: [PrismaService], // Wajib diexport biar Engine bisa baca
})
export class PrismaModule { }