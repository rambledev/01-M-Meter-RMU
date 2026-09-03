import { describe, expect, it } from "vitest";
import { buildBillingBreakdown } from "./breakdown";
import type { BillingConfig } from "./types";

const CONFIG: BillingConfig = {
  ftRate: 0.5,
  taxRatePercent: 10,
  baseCharge: 10,
  tiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
};

describe("buildBillingBreakdown", () => {
  it("delegates every number to the Calculation Service", () => {
    const breakdown = buildBillingBreakdown(110, 10, CONFIG);
    expect(breakdown.usage).toBe(100);
    expect(breakdown.baseCharge).toBe(210); // 100*2 + 10
    expect(breakdown.ft).toBe(50);
    expect(breakdown.tierLines).toEqual([
      { tier: CONFIG.tiers[0], units: 100, charge: 200 },
    ]);
  });

  it("returns an empty tier breakdown when there is no previous reading", () => {
    const breakdown = buildBillingBreakdown(110, null, CONFIG);
    expect(breakdown.usage).toBeNull();
    expect(breakdown.tierLines).toEqual([]);
    expect(breakdown.baseCharge).toBeNull();
  });
});
