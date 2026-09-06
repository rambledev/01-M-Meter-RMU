import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_BILLING_CONFIG } from "./defaultConfig";
import type { BillingConfig, BillingTier } from "./types";

// Prisma's Json input type wants InputJsonValue, not our own BillingTier[]
// shape — a plain array of plain objects is valid JSON either way.
function tiersToJson(tiers: BillingTier[]): Prisma.InputJsonValue {
  return tiers as unknown as Prisma.InputJsonValue;
}

const SINGLETON_ID = "singleton";

function toBillingConfig(row: {
  ftRate: number;
  taxRatePercent: number;
  baseCharge: number;
  tiers: unknown;
}): BillingConfig {
  return {
    ftRate: row.ftRate,
    taxRatePercent: row.taxRatePercent,
    baseCharge: row.baseCharge,
    tiers: row.tiers as BillingTier[],
  };
}

// Seeds the default config on first read so every later read/write sees a
// stable, already-persisted row — the same guarantee the old per-device
// IndexedDB repository used to provide, now shared by every device via this
// one PostgreSQL row instead (moved server-side 2026-09-06).
export async function getOrSeedBillingConfig(): Promise<BillingConfig> {
  const existing = await prisma.billingConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return toBillingConfig(existing);

  const seeded = await prisma.billingConfig.create({
    data: { id: SINGLETON_ID, ...DEFAULT_BILLING_CONFIG, tiers: tiersToJson(DEFAULT_BILLING_CONFIG.tiers) },
  });
  return toBillingConfig(seeded);
}

export async function saveBillingConfig(config: BillingConfig): Promise<BillingConfig> {
  const saved = await prisma.billingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...config, tiers: tiersToJson(config.tiers) },
    update: {
      ftRate: config.ftRate,
      taxRatePercent: config.taxRatePercent,
      baseCharge: config.baseCharge,
      tiers: tiersToJson(config.tiers),
    },
  });
  return toBillingConfig(saved);
}
