import { describe, expect, it } from "vitest";
import {
  detectUsageAnomaly,
  evaluateReading,
  validateAgainstPrevious,
  validateReadingFormat,
} from "./meterReadingValidation";

describe("validateReadingFormat", () => {
  const validCases = ["23188", "231.88", "001234.5", "0", "00066"];
  for (const raw of validCases) {
    it(`accepts "${raw}"`, () => {
      const result = validateReadingFormat(raw);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.value).toBe(Number(raw));
    });
  }

  const invalidCases: Array<[string, string]> = [
    ["23A88", "letter"],
    ["23,188", "comma"],
    ["-23188", "minus"],
    ["23.18.8", "two decimal points"],
    [".23188", "leading dot, no digit before it"],
    ["23188.", "trailing dot, no digit after it"],
    ["231 88", "space in the middle"],
    [" 23188", "leading space"],
    ["23188 ", "trailing space"],
    ["", "empty string"],
    ["abc", "letters only"],
  ];
  for (const [raw, why] of invalidCases) {
    it(`rejects "${raw}" (${why}) without altering it`, () => {
      const result = validateReadingFormat(raw);
      expect(result.valid).toBe(false);
    });
  }
});

describe("validateAgainstPrevious", () => {
  it("passes when current is greater than previous", () => {
    expect(validateAgainstPrevious(23188, 23000)).toEqual({});
  });

  it("passes when current equals previous (no usage this month)", () => {
    expect(validateAgainstPrevious(23000, 23000)).toEqual({});
  });

  it("passes when there is no previous reading yet", () => {
    expect(validateAgainstPrevious(23188, undefined)).toEqual({});
  });

  it("errors when current is less than previous", () => {
    const result = validateAgainstPrevious(22000, 23000);
    expect(result.error).toBeTruthy();
  });
});

describe("detectUsageAnomaly", () => {
  it("does not warn with insufficient history", () => {
    expect(detectUsageAnomaly(1850, [300])).toEqual({});
    expect(detectUsageAnomaly(1850, [])).toEqual({});
  });

  it("does not warn for normal usage relative to history", () => {
    expect(detectUsageAnomaly(320, [300, 280, 310])).toEqual({});
  });

  it("warns when usage far exceeds the historical average", () => {
    const result = detectUsageAnomaly(1850, [300, 280, 310]);
    expect(result.warning).toBeTruthy();
  });

  it("respects a custom multiplier/minHistory", () => {
    expect(detectUsageAnomaly(650, [300, 300], 3, 2).warning).toBeUndefined();
    expect(detectUsageAnomaly(950, [300, 300], 3, 2).warning).toBeTruthy();
  });
});

describe("evaluateReading", () => {
  it("is idle when the input is empty", () => {
    const result = evaluateReading({
      rawInput: "",
      previousReading: 23000,
      historicalUsages: [],
    });
    expect(result.status).toBe("idle");
    expect(result.value).toBeUndefined();
    expect(result.usage).toBeUndefined();
  });

  it("is an error with a format message on malformed input", () => {
    const result = evaluateReading({
      rawInput: "23A88",
      previousReading: 23000,
      historicalUsages: [],
    });
    expect(result.status).toBe("error");
    expect(result.formatError).toBeTruthy();
    expect(result.value).toBeUndefined();
  });

  it("is an error with a previous-reading message when current < previous", () => {
    const result = evaluateReading({
      rawInput: "22000",
      previousReading: 23000,
      historicalUsages: [],
    });
    expect(result.status).toBe("error");
    expect(result.previousReadingError).toBeTruthy();
    // value is still parsed (format was fine) but usage is withheld —
    // never show a misleading usage number alongside a blocking error.
    expect(result.value).toBe(22000);
    expect(result.usage).toBeUndefined();
  });

  it("is success for a normal valid reading with no anomaly", () => {
    const result = evaluateReading({
      rawInput: "23188",
      previousReading: 23000,
      historicalUsages: [180, 190, 175],
    });
    expect(result.status).toBe("success");
    expect(result.value).toBe(23188);
    expect(result.usage).toBe(188);
    expect(result.warnings).toEqual([]);
  });

  it("is warning (not error) for an anomalously high but valid reading", () => {
    const result = evaluateReading({
      rawInput: "24850",
      previousReading: 23000,
      historicalUsages: [300, 280, 310],
    });
    expect(result.status).toBe("warning");
    expect(result.value).toBe(24850);
    expect(result.usage).toBe(1850);
    expect(result.warnings.length).toBe(1);
  });

  it("is success (no anomaly warning) when history is insufficient", () => {
    const result = evaluateReading({
      rawInput: "24850",
      previousReading: 23000,
      historicalUsages: [],
    });
    expect(result.status).toBe("success");
    expect(result.warnings).toEqual([]);
  });

  it("accepts a decimal reading end to end", () => {
    const result = evaluateReading({
      rawInput: "231.88",
      previousReading: 200,
      historicalUsages: [],
    });
    expect(result.status).toBe("success");
    expect(result.value).toBe(231.88);
  });

  it("has no usage/warnings when there is no previous reading (first-ever reading)", () => {
    const result = evaluateReading({
      rawInput: "100",
      previousReading: undefined,
      historicalUsages: [],
    });
    expect(result.status).toBe("success");
    expect(result.usage).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
});
