import { describe, expect, it } from "vitest";
import { validateOcrResult } from "./ocrValidation";

describe("validateOcrResult", () => {
  it("accepts a clean 5-digit read with high confidence", () => {
    expect(validateOcrResult({ value: "23188", confidence: 0.96 })).toEqual({
      valid: true,
    });
  });

  it("accepts a decimal reading within the digit-count range", () => {
    expect(validateOcrResult({ value: "1234.5", confidence: 0.8 })).toEqual({
      valid: true,
    });
  });

  it("rejects non-digit output", () => {
    expect(validateOcrResult({ value: "23A88", confidence: 0.96 }).valid).toBe(
      false,
    );
  });

  it("rejects a value that is too short", () => {
    expect(validateOcrResult({ value: "12", confidence: 0.96 }).valid).toBe(
      false,
    );
  });

  it("rejects a value that is too long", () => {
    expect(
      validateOcrResult({ value: "1234567", confidence: 0.96 }).valid,
    ).toBe(false);
  });

  it("rejects low confidence even when the digits look fine", () => {
    expect(validateOcrResult({ value: "23188", confidence: 0.3 }).valid).toBe(
      false,
    );
  });
});
