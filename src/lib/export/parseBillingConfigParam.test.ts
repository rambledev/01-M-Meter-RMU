import { describe, expect, it } from "vitest";
import type { BillingConfig } from "@/lib/billing/types";
import { parseBillingConfigParam } from "./parseBillingConfigParam";

const CONFIG: BillingConfig = {
  ftRate: 0.5,
  taxRatePercent: 10,
  baseCharge: 10,
  tiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
};

describe("parseBillingConfigParam", () => {
  it("parses a valid JSON-encoded config", () => {
    expect(parseBillingConfigParam(JSON.stringify(CONFIG))).toEqual(CONFIG);
  });

  it("returns null for a missing param", () => {
    expect(parseBillingConfigParam(null)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseBillingConfigParam("{not json")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseBillingConfigParam(JSON.stringify({ ftRate: 1 }))).toBeNull();
  });
});
