import { describe, expect, it } from "vitest";
import type { BillingTier } from "@/lib/billing/types";
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
  selectTiersForUsage,
} from "./calculation";

// highUsageThreshold set well above every usage this file exercises with
// FLAT_CONFIG, so existing tests keep hitting lowUsageTiers exactly as
// before the 2026-09-22 two-table feature; highUsageTiers here is a
// distinct rate specifically so the dedicated selection tests below can
// tell which table actually got used.
const FLAT_CONFIG: BillingConfig = {
  ftRate: 0.5,
  taxRatePercent: 10,
  baseCharge: 10,
  highUsageThreshold: 1000,
  lowUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
  highUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 9 }],
};

// Same tier boundaries as the live BillingConfig at audit time (2026-09-22
// tier-crossing bug fix) — inclusive-both-ends bands, each tier's minUnit
// one past the previous tier's maxUnit (0–15, 16–25, ...), exactly the
// shape tierValidation.ts requires and the shape that exposed the bug.
const BOUNDARY_TIERS: BillingTier[] = [
  { minUnit: 0, maxUnit: 15, rate: 2.3488 },
  { minUnit: 16, maxUnit: 25, rate: 2.9882 },
  { minUnit: 26, maxUnit: 35, rate: 3.2405 },
  { minUnit: 36, maxUnit: 100, rate: 3.6237 },
  { minUnit: 101, maxUnit: 150, rate: 3.7171 },
  { minUnit: 151, maxUnit: 400, rate: 4.2218 },
  { minUnit: 401, maxUnit: null, rate: 4.4217 },
];

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
    const lines = computeTierBreakdown(60, DEFAULT_BILLING_CONFIG.lowUsageTiers);
    // DEFAULT_BILLING_CONFIG.lowUsageTiers: 0-20, 21-55, 56-90, 91-400, 401+.
    // Each tier after the first is floored at the PREVIOUS tier's maxUnit
    // (20, then 55, then 90, then 400), not its own minUnit (21/56/91/401)
    // — units: 20, 35, 5, 0, 0 (previously wrongly expected 20, 34, 4, 0, 0,
    // the tier-crossing bug fixed 2026-09-22).
    expect(lines).toEqual([
      { tier: DEFAULT_BILLING_CONFIG.lowUsageTiers[0], units: 20, charge: 20 * 1.142 },
      { tier: DEFAULT_BILLING_CONFIG.lowUsageTiers[1], units: 35, charge: 35 * 2.0 },
      { tier: DEFAULT_BILLING_CONFIG.lowUsageTiers[2], units: 5, charge: 5 * 2.18 },
      { tier: DEFAULT_BILLING_CONFIG.lowUsageTiers[3], units: 0, charge: 0 },
      { tier: DEFAULT_BILLING_CONFIG.lowUsageTiers[4], units: 0, charge: 0 },
    ]);
  });

  it("gives the whole amount to a single unbounded tier", () => {
    const lines = computeTierBreakdown(100, FLAT_CONFIG.lowUsageTiers);
    expect(lines).toEqual([{ tier: FLAT_CONFIG.lowUsageTiers[0], units: 100, charge: 200 }]);
  });

  // Regression coverage for the 2026-09-22 tier-crossing bug: with
  // inclusive-both-ends tiers (0–15, 16–25, 26–35, 36–100, 101–150,
  // 151–400, 401–∞ — the shape tierValidation.ts requires), the units
  // billed per tier must sum to exactly `usage`, at every tier boundary and
  // straddling every crossing. Before the fix, every tier past the first
  // silently dropped 1 unit (units summed to less than usage).
  it.each([
    [0, [0, 0, 0, 0, 0, 0, 0]],
    [1, [1, 0, 0, 0, 0, 0, 0]],
    [15, [15, 0, 0, 0, 0, 0, 0]],
    [16, [15, 1, 0, 0, 0, 0, 0]],
    [25, [15, 10, 0, 0, 0, 0, 0]],
    [26, [15, 10, 1, 0, 0, 0, 0]],
    [35, [15, 10, 10, 0, 0, 0, 0]],
    [36, [15, 10, 10, 1, 0, 0, 0]],
    [100, [15, 10, 10, 65, 0, 0, 0]],
    [101, [15, 10, 10, 65, 1, 0, 0]],
    [150, [15, 10, 10, 65, 50, 0, 0]],
    [151, [15, 10, 10, 65, 50, 1, 0]],
    [350, [15, 10, 10, 65, 50, 200, 0]],
    [400, [15, 10, 10, 65, 50, 250, 0]],
    [401, [15, 10, 10, 65, 50, 250, 1]],
    [500, [15, 10, 10, 65, 50, 250, 100]],
  ] as const)("usage=%i bills %j units across tiers, summing back to usage", (usage, expectedUnits) => {
    const lines = computeTierBreakdown(usage, BOUNDARY_TIERS);
    expect(lines.map((line) => line.units)).toEqual(expectedUnits);

    const sum = lines.reduce((total, line) => total + line.units, 0);
    expect(sum).toBe(usage);
  });

  it("carries the usage=350 worked example from the audit report exactly", () => {
    const lines = computeTierBreakdown(350, BOUNDARY_TIERS);
    expect(lines.map((line) => line.units)).toEqual([15, 10, 10, 65, 50, 200, 0]);
    expect(lines.reduce((sum, line) => sum + line.units, 0)).toBe(350);
  });

  it("keeps billing usage into the last, unbounded tier instead of stranding it at 0", () => {
    expect(computeTierBreakdown(401, BOUNDARY_TIERS).at(-1)?.units).toBe(1);
    expect(computeTierBreakdown(500, BOUNDARY_TIERS).at(-1)?.units).toBe(100);
  });
});

describe("calculateBaseCharge", () => {
  it("sums the tiered energy charge only — no service charge (2026-09-22)", () => {
    // usage=100 * rate=2 (service charge=10 is NOT included; added once, at
    // the very end, only in calculateTotal())
    expect(calculateBaseCharge(100, FLAT_CONFIG)).toBe(200);
  });

  it("returns null when usage is null (no previous reading)", () => {
    expect(calculateBaseCharge(null, FLAT_CONFIG)).toBeNull();
  });
});

// 2026-09-22: two separate rate tables ("ใช้ไฟไม่เกิน 150 หน่วย" vs "มากกว่า
// 150 หน่วย"), picked by TOTAL usage — never blended within one bill, and
// never the lowUsageTiers table just extended further past the threshold.
describe("selectTiersForUsage / calculateBaseCharge (two-table selection)", () => {
  const TWO_BAND_CONFIG: BillingConfig = {
    ftRate: 0.5,
    taxRatePercent: 10,
    baseCharge: 10,
    highUsageThreshold: 150,
    lowUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
    highUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 5 }],
  };

  it("uses lowUsageTiers at exactly the threshold (usage <= threshold)", () => {
    expect(selectTiersForUsage(150, TWO_BAND_CONFIG)).toBe(TWO_BAND_CONFIG.lowUsageTiers);
    // calculateBaseCharge (ค่าพื้นฐานรวม) excludes the service charge (2026-09-22)
    expect(calculateBaseCharge(150, TWO_BAND_CONFIG)).toBe(150 * 2);
  });

  it("uses highUsageTiers just past the threshold (usage > threshold)", () => {
    expect(selectTiersForUsage(151, TWO_BAND_CONFIG)).toBe(TWO_BAND_CONFIG.highUsageTiers);
    expect(calculateBaseCharge(151, TWO_BAND_CONFIG)).toBe(151 * 5);
  });

  it("bills the whole reading under one table, not lowUsageTiers up to 150 plus highUsageTiers for the rest", () => {
    // If the tables were blended, 350 units would be 150*2 + 200*5 = 1300.
    // Billed correctly under highUsageTiers alone: 350*5 = 1750.
    expect(calculateBaseCharge(350, TWO_BAND_CONFIG)).toBe(350 * 5);
  });
});

// 2026-09-22: FT is now baseCharge (บาท) × ftRate, not usage (หน่วย) × ftRate
// — changed per explicit user instruction, overriding the earlier
// usage-based formula.
describe("calculateFT", () => {
  it("multiplies the base charge (baht) by the resolved FT rate", () => {
    expect(calculateFT(616.083269, 0.0972)).toBeCloseTo(59.88, 2);
  });

  it("returns null when baseCharge is null", () => {
    expect(calculateFT(null, 0.0972)).toBeNull();
  });

  it("returns null when ftRate is null (FT_NOT_CONFIGURED) — no fallback to 0", () => {
    expect(calculateFT(100, null)).toBeNull();
  });

  it("uses whatever ftRate is passed in, not a hard-coded rate", () => {
    expect(calculateFT(100, 1.5)).toBe(150);
  });
});

// 2026-09-22: VAT = ค่าไฟก่อน VAT × taxRatePercent — takes the already-summed
// preVatCharge (baseCharge + ft) directly, not the two addends separately.
describe("calculateTax", () => {
  it("taxes the pre-VAT charge at the configured rate", () => {
    // 120 * 10% = 12
    expect(calculateTax(120, FLAT_CONFIG)).toBeCloseTo(12, 5);
  });

  it("returns null when preVatCharge is null", () => {
    expect(calculateTax(null, FLAT_CONFIG)).toBeNull();
  });

  it("uses whatever taxRatePercent the config carries", () => {
    expect(calculateTax(100, { ...FLAT_CONFIG, taxRatePercent: 7 })).toBeCloseTo(7, 5);
  });
});

// 2026-09-22: ค่าไฟสุทธิ = ค่าไฟก่อน VAT + VAT + ค่าบริการ — the service charge
// (config.baseCharge) is added here, once, not folded into preVatCharge/tax.
describe("calculateTotal", () => {
  it("sums the pre-VAT charge, VAT, and the config's service charge", () => {
    // preVatCharge=120 + tax=12 + baseCharge(FLAT_CONFIG=10) = 142
    expect(calculateTotal(120, 12, FLAT_CONFIG)).toBe(142);
  });

  it("returns null when preVatCharge or tax is null", () => {
    expect(calculateTotal(null, 12, FLAT_CONFIG)).toBeNull();
    expect(calculateTotal(120, null, FLAT_CONFIG)).toBeNull();
  });
});

describe("calculateBilling", () => {
  // 2026-09-22 formula: ค่าพื้นฐานรวม (tiered only, no service charge) → ค่า FT
  // = ค่าพื้นฐานรวม×ftRate → ค่าไฟก่อน VAT = ค่าพื้นฐานรวม+ค่าFT → VAT = ก่อนVAT×rate
  // → ค่าไฟสุทธิ = ก่อนVAT + VAT + ค่าบริการ (บวกครั้งเดียว ตอนท้ายสุด เท่านั้น)
  it("computes the full breakdown from confirmedValue/previousReading/config/resolvedFtRate", () => {
    const result = calculateBilling(110, 10, FLAT_CONFIG, 0.5);
    // usage=100; baseCharge(ค่าพื้นฐานรวม)=100*2=200 (ไม่รวมค่าบริการ 10);
    // ft=200*0.5=100; preVatCharge=200+100=300; tax=300*10%=30;
    // total=300+30+10(ค่าบริการ)=340
    expect(result.usage).toBe(100);
    expect(result.baseCharge).toBe(200);
    expect(result.ft).toBe(100);
    expect(result.preVatCharge).toBe(300);
    expect(result.tax).toBeCloseTo(30, 5);
    expect(result.total).toBeCloseTo(340, 5);
    expect(result.ftNotConfigured).toBe(false);
  });

  it("never guesses a previous reading — withholds the whole bill instead", () => {
    expect(calculateBilling(110, null, FLAT_CONFIG, 0.5)).toEqual({
      usage: null,
      baseCharge: null,
      ft: null,
      preVatCharge: null,
      tax: null,
      total: null,
      ftNotConfigured: false,
    });
  });

  it("withholds the whole bill when confirmedValue itself is missing", () => {
    expect(calculateBilling(null, 10, FLAT_CONFIG, 0.5)).toEqual({
      usage: null,
      baseCharge: null,
      ft: null,
      preVatCharge: null,
      tax: null,
      total: null,
      ftNotConfigured: false,
    });
  });

  // Was "matches the FT worked example from the Phase 6B spec" (ft=27.51,
  // usage×ftRate) — 2026-09-22: FT formula changed twice since (now
  // baseCharge×ftRate, where baseCharge excludes the service charge), so the
  // original spec's FT figure no longer applies here; usage itself (283,
  // from the same 3120/2837 reading pair) is unaffected.
  it("computes usage/baseCharge/ft for a 283-unit multi-tier reading", () => {
    // usage=283 > DEFAULT_BILLING_CONFIG.highUsageThreshold(150), so this
    // bills under highUsageTiers — numerically identical to lowUsageTiers
    // right now (2026-09-22 default: both tables start as the same copy,
    // see defaultConfig.ts), so the expected figures are unchanged.
    const result = calculateBilling(3120, 2837, DEFAULT_BILLING_CONFIG, 0.0972);
    expect(result.usage).toBe(283);
    expect(result.baseCharge).toBeCloseTo(607.89, 2); // tiered only, no service charge
    expect(result.ft).toBeCloseTo(59.09, 2);
    expect(result.preVatCharge).toBeCloseTo(666.98, 2);
    expect(result.total).toBeCloseTo(721.86, 2); // includes service charge (8.19) once, at the end
  });

  it("withholds the whole bill and flags ftNotConfigured when the month has no Ft — never falls back to 0/default", () => {
    const result = calculateBilling(110, 10, FLAT_CONFIG, null);
    expect(result.usage).toBe(100); // usage itself is still known
    expect(result.baseCharge).toBeNull();
    expect(result.ft).toBeNull();
    expect(result.preVatCharge).toBeNull();
    expect(result.tax).toBeNull();
    expect(result.total).toBeNull();
    expect(result.ftNotConfigured).toBe(true);
  });
});
