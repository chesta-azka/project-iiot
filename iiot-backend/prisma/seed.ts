import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Ensure .env is loaded
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
      const machineIDs = [
            'AQ-BLW-01', 'AQ-FIL-01',
            'AQ-CAP-01', 'AQ-LBL-01',
            'AQ-PLT-01', 'AQ-WRP-01',
            'AQ-CON-01',
      ];

      for (let i = 0; i < machineIDs.length; i++) {
            await prisma.machine.upsert({
                  where: { machineId: machineIDs[i] },
                  update: {},
                  create: {
                        machineId: machineIDs[i],
                        name: machineIDs[i].replace('AQ-', 'Machine '),
                        baseRegister: i * 50, // Sesuaikan offset register lu
                        status: 0,
                  },
            });
      }
      console.log('✅ Machines Seeded!');

      // --- GENERATE DYNAMIC DOWNTIME UNTUK HARI INI ---
      console.log('Sedang membuat data Downtime dinamis di database...');
      await prisma.downtime.deleteMany(); // Bersihin data lama biar gak dobel

      const dbMachines = await prisma.machine.findMany();
      const today = new Date();
      today.setHours(6, 0, 0, 0); // Anggap shift 1 mulai jam 06:00 pagi ini

      // Kalau jam 6 pagi hari ini itu di masa depan (berarti ini jam 00-05 pagi), kita mundurin 1 hari
      if (today.getTime() > Date.now()) {
            today.setDate(today.getDate() - 1);
      }

      let totalDowntimes = 0;
      for (const machine of dbMachines) {
            // Loop buat tiap jam selama 24 jam dari awal shift 1
            for (let i = 0; i < 24; i++) {
                  const currentHour = new Date(today);
                  currentHour.setHours(currentHour.getHours() + i);

                  // Jangan generate data buat jam yang belum terjadi (masa depan)
                  if (currentHour.getTime() > Date.now()) {
                        break;
                  }

                  // 60% peluang mesin mengalami downtime di jam ini
                  if (Math.random() > 0.4) {
                        const isPlanned = Math.random() > 0.8; // 20% kemungkinannya Planned Downtime (PDT)
                        const durationMenit = Math.floor(Math.random() * 4) + 1; // Downtime antara 1 - 4 menit
                        const durationSec = durationMenit * 60;

                        // Tentukan startTime acak di dalam jam tersebut (menit ke 0 sampai 50)
                        const startTime = new Date(currentHour);
                        startTime.setMinutes(Math.floor(Math.random() * 50));

                        // Tentukan endTime
                        const endTime = new Date(startTime);
                        endTime.setSeconds(endTime.getSeconds() + durationSec);

                        await prisma.downtime.create({
                              data: {
                                    machineId: machine.id,
                                    startTime: startTime,
                                    endTime: endTime,
                                    duration: durationSec,
                                    isPlanned: isPlanned,
                                    operatorNote: `Mock Data Dinamis dari Seeder (${isPlanned ? 'P' : 'UP'}DT)`,
                                    isApproved: true,
                              },
                        });
                        totalDowntimes++;
                  }
            }
      }
      console.log(`✅ Berhasil menginjeksi ${totalDowntimes} data Downtime dinamis ke database!`);

}

main()
      .catch((e) => console.error(e))
      .finally(async () => await prisma.$disconnect());