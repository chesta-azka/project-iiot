import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Kuncinya: Prisma v7 minta 'datasources' di dalam constructor 
    // kalau env DATABASE_URL terdeteksi kosong/undefined.
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || "postgresql://user_iiot:securepassword@localhost:5433/iiot_events_db?schema=public",
        },
      },
    } as any); 
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