import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BILLING_CONFIG } from "@/lib/billing/defaultConfig";
import type { BillingConfig } from "@/lib/billing/types";
import {
  getBillingConfig,
  resetBillingConfig,
  saveBillingConfig,
} from "./billingConfigRepository";
import { db } from "./db";

afterEach(async () => {
  await db.billingConfig.clear();
});

describe("getBillingConfig", () => {
  it("auto-creates and returns the default configuration on first read", async () => {
    const config = await getBillingConfig();
    expect(config).toEqual(DEFAULT_BILLING_CONFIG);

    const stored = await db.billingConfig.get("singleton");
    expect(stored).toBeDefined();
  });

  it("returns whatever was previously saved, not the default, on later reads", async () => {
    const custom: BillingConfig = {
      ftRate: 0.5,
      taxRatePercent: 5,
      baseCharge: 20,
      tiers: [{ minUnit: 0, maxUnit: null, rate: 3 }],
    };
    await saveBillingConfig(custom);

    const config = await getBillingConfig();
    expect(config).toEqual(custom);
  });
});

describe("saveBillingConfig", () => {
  it("overwrites the previously saved config (custom FT)", async () => {
    await saveBillingConfig({ ...DEFAULT_BILLING_CONFIG, ftRate: 1.23 });
    const config = await getBillingConfig();
    expect(config.ftRate).toBe(1.23);
  });

  it("overwrites the previously saved config (custom Tax)", async () => {
    await saveBillingConfig({ ...DEFAULT_BILLING_CONFIG, taxRatePercent: 15 });
    const config = await getBillingConfig();
    expect(config.taxRatePercent).toBe(15);
  });

  it("overwrites the previously saved config (custom tier rate)", async () => {
    const customTiers = DEFAULT_BILLING_CONFIG.tiers.map((t, i) =>
      i === 0 ? { ...t, rate: 9.99 } : t,
    );
    await saveBillingConfig({ ...DEFAULT_BILLING_CONFIG, tiers: customTiers });

    const config = await getBillingConfig();
    expect(config.tiers[0].rate).toBe(9.99);
  });
});

describe("resetBillingConfig", () => {
  it("restores the default configuration after a custom save", async () => {
    await saveBillingConfig({ ...DEFAULT_BILLING_CONFIG, ftRate: 99 });
    expect((await getBillingConfig()).ftRate).toBe(99);

    const reset = await resetBillingConfig();
    expect(reset).toEqual(DEFAULT_BILLING_CONFIG);
    expect((await getBillingConfig())).toEqual(DEFAULT_BILLING_CONFIG);
  });
});
