import { DEFAULT_BILLING_CONFIG } from "@/lib/billing/defaultConfig";
import type { BillingConfig } from "@/lib/billing/types";
import { db, type LocalBillingConfig } from "./db";

const SINGLETON_ID = "singleton" as const;

function nowIso(): string {
  return new Date().toISOString();
}

function toBillingConfig(stored: LocalBillingConfig): BillingConfig {
  const { ftRate, taxRatePercent, baseCharge, tiers } = stored;
  return { ftRate, taxRatePercent, baseCharge, tiers };
}

// Seeds the default config on first read so every later read/save sees a
// stable, already-persisted row (Phase 6B kickoff §6: "ถ้ายังไม่มี config:
// สร้าง Default Configuration อัตโนมัติ").
export async function getBillingConfig(): Promise<BillingConfig> {
  const stored = await db.billingConfig.get(SINGLETON_ID);
  if (stored) return toBillingConfig(stored);

  await saveBillingConfig(DEFAULT_BILLING_CONFIG);
  return DEFAULT_BILLING_CONFIG;
}

export async function saveBillingConfig(config: BillingConfig): Promise<void> {
  const row: LocalBillingConfig = { ...config, id: SINGLETON_ID, updatedAt: nowIso() };
  await db.billingConfig.put(row);
}

export async function resetBillingConfig(): Promise<BillingConfig> {
  await saveBillingConfig(DEFAULT_BILLING_CONFIG);
  return DEFAULT_BILLING_CONFIG;
}
