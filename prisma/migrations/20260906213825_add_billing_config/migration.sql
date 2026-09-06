-- CreateTable
CREATE TABLE "BillingConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "ftRate" DOUBLE PRECISION NOT NULL,
    "taxRatePercent" DOUBLE PRECISION NOT NULL,
    "baseCharge" DOUBLE PRECISION NOT NULL,
    "tiers" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingConfig_pkey" PRIMARY KEY ("id")
);

