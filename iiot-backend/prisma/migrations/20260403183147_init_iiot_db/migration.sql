-- CreateTable
CREATE TABLE "Machine" (
    "id" SERIAL NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRegister" INTEGER NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "lastCounter" INTEGER NOT NULL DEFAULT 0,
    "lastTemp" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Downtime" (
    "id" SERIAL NOT NULL,
    "machineId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "reason" TEXT,
    "operatorNote" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Downtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlarmConfig" (
    "id" SERIAL NOT NULL,
    "alarmCode" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'CRITICAL',

    CONSTRAINT "AlarmConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineId_key" ON "Machine"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_baseRegister_key" ON "Machine"("baseRegister");

-- CreateIndex
CREATE UNIQUE INDEX "AlarmConfig_alarmCode_key" ON "AlarmConfig"("alarmCode");

-- AddForeignKey
ALTER TABLE "Downtime" ADD CONSTRAINT "Downtime_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
