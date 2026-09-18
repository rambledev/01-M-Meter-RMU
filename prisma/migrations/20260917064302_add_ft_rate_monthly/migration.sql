-- CreateEnum
CREATE TYPE "FtStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "FtHistoryAction" AS ENUM ('CREATE', 'UPDATE', 'DISABLE', 'ENABLE');

-- CreateTable
CREATE TABLE "FtRate" (
    "id" TEXT NOT NULL,
    "readingMonth" DATE NOT NULL,
    "ftRate" DECIMAL(10,4) NOT NULL,
    "status" "FtStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FtRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FtRateHistory" (
    "id" TEXT NOT NULL,
    "ftRateId" TEXT NOT NULL,
    "readingMonth" DATE NOT NULL,
    "action" "FtHistoryAction" NOT NULL,
    "oldValue" DECIMAL(10,4),
    "newValue" DECIMAL(10,4),
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FtRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FtDocument" (
    "id" TEXT NOT NULL,
    "ftRateId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FtDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FtRate_readingMonth_key" ON "FtRate"("readingMonth");

-- AddForeignKey
ALTER TABLE "FtRate" ADD CONSTRAINT "FtRate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtRateHistory" ADD CONSTRAINT "FtRateHistory_ftRateId_fkey" FOREIGN KEY ("ftRateId") REFERENCES "FtRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtRateHistory" ADD CONSTRAINT "FtRateHistory_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtDocument" ADD CONSTRAINT "FtDocument_ftRateId_fkey" FOREIGN KEY ("ftRateId") REFERENCES "FtRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtDocument" ADD CONSTRAINT "FtDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
