import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BILLING_CONFIG } from "@/lib/billing/defaultConfig";
import type { BillingConfig } from "@/lib/billing/types";
import { getCachedBillingConfig, saveCachedBillingConfig } from "./billingConfigRepository";
import { db } from "./db";

afterEach(async () => {
  await db.billingConfig.clear();
});

describe("getCachedBillingConfig", () => {
  it("returns null when nothing has been cached yet", async () => {
    expect(await getCachedBillingConfig()).toBeNull();
  });

  it("returns whatever was previously cached", async () => {
    const custom: BillingConfig = {
      ftRate: 0.5,
      taxRatePercent: 5,
      baseCharge: 20,
      highUsageThreshold: 150,
      lowUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 3 }],
      highUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 4 }],
    };
    await saveCachedBillingConfig(custom);

    expect(await getCachedBillingConfig()).toEqual(custom);
  });
});

describe("saveCachedBillingConfig", () => {
  it("overwrites the previously cached config (custom FT)", async () => {
    await saveCachedBillingConfig({ ...DEFAULT_BILLING_CONFIG, ftRate: 1.23 });
    const config = await getCachedBillingConfig();
    expect(config?.ftRate).toBe(1.23);
  });

  it("overwrites the previously cached config (custom tier rate)", async () => {
    const customTiers = DEFAULT_BILLING_CONFIG.lowUsageTiers.map((t, i) =>
      i === 0 ? { ...t, rate: 9.99 } : t,
    );
    await saveCachedBillingConfig({ ...DEFAULT_BILLING_CONFIG, lowUsageTiers: customTiers });

    const config = await getCachedBillingConfig();
    expect(config?.lowUsageTiers[0].rate).toBe(9.99);
  });
});
