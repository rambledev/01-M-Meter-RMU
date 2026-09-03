import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING_CONFIG } from "@/lib/billing/defaultConfig";
import type { BillingConfig } from "@/lib/billing/types";
import {
  calculateBaseCharge,
  calculateBilling,
  calculateFT,
  calculateTax,
  calculateTotal,
  calculateUsage,
  computeTierBreakdown,
} from "./calculation";

const FLAT_CONFIG: BillingConfig = {
  ftRate: 0.5,
  taxRatePercent: 10,
  baseCharge: 10,
  tiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
};

describe("calculateUsage", () => {
  it("computes current minus previous", () => {
    expect(calculateUsage(260, 200)).toBe(60);
  });

  it("does not guess a value when there is no previous reading", () => {
    expect(calculateUsage(260, null)).toBeNull();
  });
});

describe("computeTierBreakdown", () => {
  it("splits usage across tiers, clamped at each tier's cap", () => {
    const lines = computeTierBreakdown(60, DEFAULT_BILLING_CONFIG.tiers);
    expect(lines).toEqual([
      { tier: DEFAULT_BILLING_CONFIG.tiers[0], units: 20, charge: 20 * 1.142 },
      { tier: DEFAULT_BILLING_CONFIG.tiers[1], units: 34, charge: 34 * 2.0 },
      { tier: DEFAULT_BILLING_CONFIG.tiers[2], units: 4, charge: 4 * 2.18 },
      { tier: DEFAULT_BILLING_CONFIG.tiers[3], units: 0, charge: 0 },
      { tier: DEFAULT_BILLING_CONFIG.tiers[4], units: 0, charge: 0 },
    ]);
  });

  it("gives the whole amount to a single unbounded tier", () => {
    const lines = computeTierBreakdown(100, FLAT_CONFIG.tiers);
    expect(lines).toEqual([{ tier: FLAT_CONFIG.tiers[0], units: 100, charge: 200 }]);
  });
});

describe("calculateBaseCharge", () => {
  it("adds the fixed base charge to the tiered energy charge", () => {
    // usage=100 * rate=2 + fixed=10
    expect(calculateBaseCharge(100, FLAT_CONFIG)).toBe(210);
  });

  it("returns null when usage is null (no previous reading)", () => {
    expect(calculateBaseCharge(null, FLAT_CONFIG)).toBeNull();
  });
});

describe("calculateFT", () => {
  it("multiplies usage by the configured FT rate", () => {
    expect(calculateFT(283, DEFAULT_BILLING_CONFIG)).toBeCloseTo(27.51, 2);
  });

  it("returns null when usage is null", () => {
    expect(calculateFT(null, DEFAULT_BILLING_CONFIG)).toBeNull();
  });

  it("uses whatever ftRate the config carries, not a hard-coded rate", () => {
    expect(calculateFT(100, { ...FLAT_CONFIG, ftRate: 1.5 })).toBe(150);
  });
});

describe("calculateTax", () => {
  it("taxes the sum of base charge and FT at the configured rate", () => {
    // (100 + 20) * 10% = 12
    expect(calculateTax(100, 20, FLAT_CONFIG)).toBeCloseTo(12, 5);
  });

  it("returns null when either input is null", () => {
    expect(calculateTax(null, 20, FLAT_CONFIG)).toBeNull();
    expect(calculateTax(100, null, FLAT_CONFIG)).toBeNull();
  });

  it("uses whatever taxRatePercent the config carries", () => {
    expect(calculateTax(100, 0, { ...FLAT_CONFIG, taxRatePercent: 7 })).toBeCloseTo(7, 5);
  });
});

describe("calculateTotal", () => {
  it("sums base charge, FT, and tax", () => {
    expect(calculateTotal(100, 20, 12)).toBe(132);
  });

  it("returns null when any input is null", () => {
    expect(calculateTotal(null, 20, 12)).toBeNull();
    expect(calculateTotal(100, null, 12)).toBeNull();
    expect(calculateTotal(100, 20, null)).toBeNull();
  });
});

describe("calculateBilling", () => {
  it("computes the full breakdown from confirmedValue/previousReading/config", () => {
    const result = calculateBilling(110, 10, FLAT_CONFIG);
    // usage = 100; baseCharge = 100*2 + 10 = 210; ft = 100*0.5 = 50;
    // tax = (210+50)*10% = 26; total = 210+50+26 = 286
    expect(result.usage).toBe(100);
    expect(result.baseCharge).toBe(210);
    expect(result.ft).toBe(50);
    expect(result.tax).toBeCloseTo(26, 5);
    expect(result.total).toBeCloseTo(286, 5);
  });

  it("never guesses a previous reading — withholds the whole bill instead", () => {
    expect(calculateBilling(110, null, FLAT_CONFIG)).toEqual({
      usage: null,
      baseCharge: null,
      ft: null,
      tax: null,
      total: null,
    });
  });

  it("withholds the whole bill when confirmedValue itself is missing", () => {
    expect(calculateBilling(null, 10, FLAT_CONFIG)).toEqual({
      usage: null,
      baseCharge: null,
      ft: null,
      tax: null,
      total: null,
    });
  });

  it("matches the FT worked example from the Phase 6B spec (283 units)", () => {
    const result = calculateBilling(3120, 2837, DEFAULT_BILLING_CONFIG);
    expect(result.usage).toBe(283);
    expect(result.ft).toBeCloseTo(27.51, 2);
  });
});
