import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter, log: ['error'] });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('==============================================');
      console.log('✅ PRISMA: KONEKSI BERHASIL TEMBUS, MEKK!');
      console.log('==============================================');
    } catch (error) {
      console.error('❌ PRISMA GAGAL KONEK KE DB:', error.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
