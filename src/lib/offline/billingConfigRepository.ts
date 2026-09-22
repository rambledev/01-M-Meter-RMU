import type { BillingConfig } from "@/lib/billing/types";
import { db, type LocalBillingConfig } from "./db";

const SINGLETON_ID = "singleton" as const;

function nowIso(): string {
  return new Date().toISOString();
}

function toBillingConfig(stored: LocalBillingConfig): BillingConfig {
  const { ftRate, taxRatePercent, baseCharge, highUsageThreshold, lowUsageTiers, highUsageTiers } =
    stored;
  return { ftRate, taxRatePercent, baseCharge, highUsageThreshold, lowUsageTiers, highUsageTiers };
}

// Offline-cache only — the Billing Configuration itself lives in PostgreSQL
// now (Admin edits it at /admin, tab "ตั้งค่าค่าไฟ"; src/lib/billing/
// billingConfigApi.ts fetches it). This table just remembers the last
// successfully-fetched copy so /checker keeps working while offline (moved
// from being the source of truth to a read cache, 2026-09-06).
export async function getCachedBillingConfig(): Promise<BillingConfig | null> {
  const stored = await db.billingConfig.get(SINGLETON_ID);
  return stored ? toBillingConfig(stored) : null;
}

export async function saveCachedBillingConfig(config: BillingConfig): Promise<void> {
  const row: LocalBillingConfig = { ...config, id: SINGLETON_ID, updatedAt: nowIso() };
  await db.billingConfig.put(row);
}
