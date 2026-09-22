import { describe, expect, it } from "vitest";
import { buildBillingBreakdown } from "./breakdown";
import type { BillingConfig } from "./types";

const CONFIG: BillingConfig = {
  ftRate: 0.5,
  taxRatePercent: 10,
  baseCharge: 10,
  highUsageThreshold: 150,
  lowUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
  highUsageTiers: [{ minUnit: 0, maxUnit: null, rate: 3 }],
};

describe("buildBillingBreakdown", () => {
  it("delegates every number to the Calculation Service", () => {
    const breakdown = buildBillingBreakdown(110, 10, CONFIG, 0.5);
    // usage=100; baseCharge(ค่าพื้นฐานรวม)=100*2=200 (no service charge, 2026-09-22);
    // ft=200*0.5=100; preVatCharge=300; tax=300*10%=30; total=300+30+10=340
    expect(breakdown.usage).toBe(100);
    expect(breakdown.baseCharge).toBe(200);
    expect(breakdown.ft).toBe(100);
    expect(breakdown.preVatCharge).toBe(300);
    expect(breakdown.tax).toBeCloseTo(30, 5);
    expect(breakdown.total).toBeCloseTo(340, 5);
    expect(breakdown.ftNotConfigured).toBe(false);
    expect(breakdown.usedHighUsageTiers).toBe(false);
    expect(breakdown.tierLines).toEqual([
      { tier: CONFIG.lowUsageTiers[0], units: 100, charge: 200 },
    ]);
  });

  // 2026-09-22: usage > highUsageThreshold bills entirely under
  // highUsageTiers, not lowUsageTiers extended further.
  it("uses highUsageTiers (not lowUsageTiers) once usage passes highUsageThreshold", () => {
    const breakdown = buildBillingBreakdown(360, 10, CONFIG, 0.5); // usage = 350 > 150
    expect(breakdown.usage).toBe(350);
    expect(breakdown.usedHighUsageTiers).toBe(true);
    expect(breakdown.tierLines).toEqual([
      { tier: CONFIG.highUsageTiers[0], units: 350, charge: 1050 }, // 350 * 3
    ]);
    // baseCharge=1050 (no service charge); ft=1050*0.5=525;
    // preVatCharge=1575; tax=157.5; total=1575+157.5+10=1742.5
    expect(breakdown.baseCharge).toBe(1050);
    expect(breakdown.total).toBeCloseTo(1742.5, 5);
  });

  it("returns an empty tier breakdown when there is no previous reading", () => {
    const breakdown = buildBillingBreakdown(110, null, CONFIG, 0.5);
    expect(breakdown.usage).toBeNull();
    expect(breakdown.tierLines).toEqual([]);
    expect(breakdown.baseCharge).toBeNull();
    expect(breakdown.ftNotConfigured).toBe(false);
  });

  it("withholds the whole bill and flags ftNotConfigured when Ft is not resolved for the month", () => {
    const breakdown = buildBillingBreakdown(110, 10, CONFIG, null);
    expect(breakdown.usage).toBe(100); // usage is still known
    expect(breakdown.baseCharge).toBeNull();
    expect(breakdown.ft).toBeNull();
    expect(breakdown.tax).toBeNull();
    expect(breakdown.total).toBeNull();
    expect(breakdown.ftNotConfigured).toBe(true);
  });
});
