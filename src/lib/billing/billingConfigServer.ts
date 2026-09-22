import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_BILLING_CONFIG } from "./defaultConfig";
import type { BillingConfig, BillingTier } from "./types";

// The Prisma model still has exactly one `tiers Json` column (no schema
// change/migration for the 2026-09-22 two-tier-table feature) — it now
// holds an object carrying BOTH tables plus the threshold, instead of a
// flat BillingTier[]. Packing/unpacking that shape happens only here.
interface TiersJsonShape {
  highUsageThreshold: number;
  lowUsageTiers: BillingTier[];
  highUsageTiers: BillingTier[];
}

function tiersToJson(config: Pick<BillingConfig, "highUsageThreshold" | "lowUsageTiers" | "highUsageTiers">): Prisma.InputJsonValue {
  const shape: TiersJsonShape = {
    highUsageThreshold: config.highUsageThreshold,
    lowUsageTiers: config.lowUsageTiers,
    highUsageTiers: config.highUsageTiers,
  };
  return shape as unknown as Prisma.InputJsonValue;
}

const SINGLETON_ID = "singleton";

function toBillingConfig(row: {
  ftRate: number;
  taxRatePercent: number;
  baseCharge: number;
  tiers: unknown;
  documentPath?: string | null;
  documentName?: string | null;
}): BillingConfig {
  const shape = row.tiers as TiersJsonShape;
  return {
    ftRate: row.ftRate,
    taxRatePercent: row.taxRatePercent,
    baseCharge: row.baseCharge,
    highUsageThreshold: shape.highUsageThreshold,
    lowUsageTiers: shape.lowUsageTiers,
    highUsageTiers: shape.highUsageTiers,
    documentPath: row.documentPath ?? null,
    documentName: row.documentName ?? null,
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
    data: {
      id: SINGLETON_ID,
      ftRate: DEFAULT_BILLING_CONFIG.ftRate,
      taxRatePercent: DEFAULT_BILLING_CONFIG.taxRatePercent,
      baseCharge: DEFAULT_BILLING_CONFIG.baseCharge,
      tiers: tiersToJson(DEFAULT_BILLING_CONFIG),
    },
  });
  return toBillingConfig(seeded);
}

export async function saveBillingConfig(config: BillingConfig): Promise<BillingConfig> {
  const saved = await prisma.billingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      ftRate: config.ftRate,
      taxRatePercent: config.taxRatePercent,
      baseCharge: config.baseCharge,
      tiers: tiersToJson(config),
    },
    update: {
      ftRate: config.ftRate,
      taxRatePercent: config.taxRatePercent,
      baseCharge: config.baseCharge,
      tiers: tiersToJson(config),
    },
  });
  return toBillingConfig(saved);
}

// Additive — saveBillingConfig() above only ever touches the rate fields,
// never these two, and vice versa here: uploading/removing the evidence
// document never touches ftRate/taxRatePercent/baseCharge/tiers. Kept
// separate on purpose so saving rates can never accidentally wipe the
// attached document, or vice versa.
export async function saveBillingConfigDocument(
  documentPath: string | null,
  documentName: string | null,
): Promise<BillingConfig> {
  const saved = await prisma.billingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      ftRate: DEFAULT_BILLING_CONFIG.ftRate,
      taxRatePercent: DEFAULT_BILLING_CONFIG.taxRatePercent,
      baseCharge: DEFAULT_BILLING_CONFIG.baseCharge,
      tiers: tiersToJson(DEFAULT_BILLING_CONFIG),
      documentPath,
      documentName,
    },
    update: { documentPath, documentName },
  });
  return toBillingConfig(saved);
}
