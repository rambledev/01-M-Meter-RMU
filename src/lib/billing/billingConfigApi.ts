import {
  getCachedBillingConfig,
  saveCachedBillingConfig,
} from "@/lib/offline/billingConfigRepository";
import { DEFAULT_BILLING_CONFIG } from "./defaultConfig";
import type { BillingConfig } from "./types";

async function fetchBillingConfigFromServer(): Promise<BillingConfig> {
  const res = await fetch("/api/billing-config");
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดการตั้งค่าค่าไฟไม่สำเร็จ");
  }
  return body.data as BillingConfig;
}

// Live fetch first (so /checker always uses Admin's latest rate when
// online); on any failure (offline, server error) falls back to the last
// successfully-cached copy, then to the built-in default if this device has
// never fetched successfully before — the reading workflow must never be
// blocked just because the billing config couldn't load.
export async function fetchBillingConfig(): Promise<BillingConfig> {
  try {
    const config = await fetchBillingConfigFromServer();
    await saveCachedBillingConfig(config);
    return config;
  } catch {
    const cached = await getCachedBillingConfig();
    return cached ?? DEFAULT_BILLING_CONFIG;
  }
}
