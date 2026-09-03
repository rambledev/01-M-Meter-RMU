import { describe, expect, it } from "vitest";
import {
  calculateUsage,
  isFutureMonth,
  previousReadingMonth,
  toMonthValue,
  toReadingMonth,
} from "./readingMonth";

describe("previousReadingMonth", () => {
  it("returns the prior calendar month", () => {
    expect(previousReadingMonth("2026-09-01")).toBe("2026-08-01");
  });

  it("rolls back across a year boundary", () => {
    expect(previousReadingMonth("2026-01-01")).toBe("2025-12-01");
  });
});

describe("toReadingMonth / toMonthValue", () => {
  it("round-trips between month-input value and stored readingMonth", () => {
    expect(toReadingMonth("2026-09")).toBe("2026-09-01");
    expect(toMonthValue("2026-09-01")).toBe("2026-09");
  });
});

describe("isFutureMonth", () => {
  it("flags a month far in the future", () => {
    expect(isFutureMonth("2099-01")).toBe(true);
  });

  it("does not flag a month in the past", () => {
    expect(isFutureMonth("2020-01")).toBe(false);
  });
});

describe("calculateUsage", () => {
  it("computes current minus previous", () => {
    expect(calculateUsage(135, 120)).toBe(15);
  });

  it("does not guess a value when there is no previous reading", () => {
    expect(calculateUsage(135, undefined)).toBeUndefined();
  });
});
