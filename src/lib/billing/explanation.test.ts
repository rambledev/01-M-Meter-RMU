import { describe, expect, it } from "vitest";
import { buildBillingExplanation } from "./explanation";
import type { BillingConfig } from "./types";

describe("buildBillingExplanation", () => {
  it("interpolates the current config's numbers into the explanation text", () => {
    const config: BillingConfig = {
      ftRate: 0.1234,
      taxRatePercent: 9,
      baseCharge: 5.5,
      tiers: [{ minUnit: 0, maxUnit: null, rate: 1 }],
    };

    const explanation = buildBillingExplanation(config);

    expect(explanation.steps.some((s) => s.includes("0.1234"))).toBe(true);
    expect(explanation.steps.some((s) => s.includes("9%"))).toBe(true);
    expect(explanation.config).toBe(config);
  });

  it("changes when the config changes — not a fixed hard-coded string", () => {
    const a = buildBillingExplanation({
      ftRate: 0.1,
      taxRatePercent: 7,
      baseCharge: 1,
      tiers: [{ minUnit: 0, maxUnit: null, rate: 1 }],
    });
    const b = buildBillingExplanation({
      ftRate: 0.2,
      taxRatePercent: 8,
      baseCharge: 1,
      tiers: [{ minUnit: 0, maxUnit: null, rate: 1 }],
    });

    expect(a.steps).not.toEqual(b.steps);
  });

  it("never claims to be an official formula", () => {
    const explanation = buildBillingExplanation({
      ftRate: 0.1,
      taxRatePercent: 7,
      baseCharge: 1,
      tiers: [{ minUnit: 0, maxUnit: null, rate: 1 }],
    });
    expect(explanation.disclaimer).not.toContain("สูตรทางการ");
  });
});
