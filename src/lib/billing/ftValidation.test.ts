import { describe, expect, it } from "vitest";
import { validateFtNotes, validateFtRateValue, validateReadingMonthParam } from "./ftValidation";

describe("validateReadingMonthParam", () => {
  it("parses a valid YYYY-MM into the 1st-of-month Date", () => {
    const date = validateReadingMonthParam("2026-09");
    expect(date).not.toBeNull();
    expect(date?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("rejects a malformed month string", () => {
    expect(validateReadingMonthParam("2026-9")).toBeNull();
    expect(validateReadingMonthParam("2026/09")).toBeNull();
    expect(validateReadingMonthParam("not-a-month")).toBeNull();
  });

  it("rejects an out-of-range month number", () => {
    expect(validateReadingMonthParam("2026-00")).toBeNull();
    expect(validateReadingMonthParam("2026-13")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(validateReadingMonthParam(202609)).toBeNull();
    expect(validateReadingMonthParam(null)).toBeNull();
    expect(validateReadingMonthParam(undefined)).toBeNull();
  });
});

describe("validateFtRateValue", () => {
  it("accepts a valid non-negative number", () => {
    expect(validateFtRateValue(0.1623)).toBe(0.1623);
    expect(validateFtRateValue(0)).toBe(0);
    expect(validateFtRateValue("0.1972")).toBe(0.1972);
  });

  it("rejects negative values", () => {
    expect(validateFtRateValue(-0.1)).toBeNull();
  });

  it("rejects non-finite / non-numeric values", () => {
    expect(validateFtRateValue(NaN)).toBeNull();
    expect(validateFtRateValue(Infinity)).toBeNull();
    expect(validateFtRateValue("abc")).toBeNull();
    expect(validateFtRateValue(undefined)).toBeNull();
    expect(validateFtRateValue(null)).toBeNull();
  });

  it("rejects a value beyond Decimal(10,4)'s magnitude", () => {
    expect(validateFtRateValue(1_000_000)).toBeNull();
  });
});

describe("validateFtNotes", () => {
  it("trims and accepts a normal string", () => {
    expect(validateFtNotes("  ประกาศ กฟภ. เดือนกันยายน  ")).toBe("ประกาศ กฟภ. เดือนกันยายน");
  });

  it("treats missing/empty as null (optional field)", () => {
    expect(validateFtNotes(undefined)).toBeNull();
    expect(validateFtNotes(null)).toBeNull();
    expect(validateFtNotes("   ")).toBeNull();
  });

  it("rejects an overly long note", () => {
    expect(validateFtNotes("a".repeat(1001))).toBeNull();
    expect(validateFtNotes("a".repeat(1000))).toBe("a".repeat(1000));
  });

  it("rejects the wrong type", () => {
    expect(validateFtNotes(123)).toBeNull();
  });
});
