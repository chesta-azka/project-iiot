import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
      const machineIDs = [
            'AQ-BLW-01', 'AQ-BLW-02', 'AQ-FIL-01', 'AQ-FIL-02',
            'AQ-CAP-01', 'AQ-CAP-02', 'AQ-LBL-01', 'AQ-LBL-02',
            'AQ-INK-01', 'AQ-INK-02', 'AQ-PCK-01', 'AQ-PCK-02',
            'AQ-PLT-01', 'AQ-WRP-01', 'AQ-WRP-02', 'AQ-CON-01'
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
      console.log('✅ 16 Machines Seeded!');
}

main()
      .catch((e) => console.error(e))
      .finally(async () => await prisma.$disconnect());