import { describe, expect, it } from "vitest";
import { calculateBilling, calculateUsage } from "./calculation";

describe("calculateUsage", () => {
  it("computes current minus previous", () => {
    expect(calculateUsage(260, 200)).toBe(60);
  });

  it("does not guess a value when there is no previous reading", () => {
    expect(calculateUsage(260, null)).toBeNull();
  });
});

describe("calculateBilling", () => {
  it("never invents a billing formula — always returns nulls", () => {
    expect(calculateBilling(60)).toEqual({
      baseCharge: null,
      ftCharge: null,
      tax: null,
      total: null,
    });
    expect(calculateBilling(null)).toEqual({
      baseCharge: null,
      ftCharge: null,
      tax: null,
      total: null,
    });
  });
});
