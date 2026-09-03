import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_CONFIG } from "./defaultConfig";
import { validateTiers } from "./tierValidation";
import type { BillingTier } from "./types";

describe("validateTiers", () => {
  it("accepts the default configuration", () => {
    const result = validateTiers(DEFAULT_BILLING_CONFIG.tiers);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty tier list", () => {
    const result = validateTiers([]);
    expect(result.valid).toBe(false);
  });

  it("rejects a negative rate", () => {
    const tiers: BillingTier[] = [{ minUnit: 0, maxUnit: null, rate: -1 }];
    const result = validateTiers(tiers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("อัตรา"))).toBe(true);
  });

  it("rejects a negative minUnit", () => {
    const tiers: BillingTier[] = [{ minUnit: -5, maxUnit: null, rate: 1 }];
    expect(validateTiers(tiers).valid).toBe(false);
  });

  it("rejects maxUnit <= minUnit on a non-last tier", () => {
    const tiers: BillingTier[] = [
      { minUnit: 0, maxUnit: 0, rate: 1 },
      { minUnit: 1, maxUnit: null, rate: 2 },
    ];
    expect(validateTiers(tiers).valid).toBe(false);
  });

  it("rejects an unlimited tier that isn't last", () => {
    const tiers: BillingTier[] = [
      { minUnit: 0, maxUnit: null, rate: 1 },
      { minUnit: 21, maxUnit: null, rate: 2 },
    ];
    expect(validateTiers(tiers).valid).toBe(false);
  });

  it("rejects overlapping tiers", () => {
    const tiers: BillingTier[] = [
      { minUnit: 0, maxUnit: 20, rate: 1 },
      { minUnit: 15, maxUnit: null, rate: 2 }, // overlaps [0,20]
    ];
    const result = validateTiers(tiers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("ทับซ้อน"))).toBe(true);
  });

  it("rejects tiers out of ascending order", () => {
    const tiers: BillingTier[] = [
      { minUnit: 21, maxUnit: 55, rate: 2 },
      { minUnit: 0, maxUnit: null, rate: 1 },
    ];
    expect(validateTiers(tiers).valid).toBe(false);
  });

  it("accepts touching (non-overlapping) boundaries", () => {
    const tiers: BillingTier[] = [
      { minUnit: 0, maxUnit: 20, rate: 1 },
      { minUnit: 21, maxUnit: null, rate: 2 },
    ];
    expect(validateTiers(tiers).valid).toBe(true);
  });
});
