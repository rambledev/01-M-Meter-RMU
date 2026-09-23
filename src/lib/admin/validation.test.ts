import { describe, expect, it } from "vitest";
import {
  isValidRole,
  validateOptionalString,
  validateRequiredString,
  validateRmuEmail,
  validateZoneIds,
} from "./validation";

describe("validateRequiredString", () => {
  it("trims and accepts a non-empty string", () => {
    expect(validateRequiredString("  Zone A  ")).toBe("Zone A");
  });

  it("rejects an empty or whitespace-only string", () => {
    expect(validateRequiredString("")).toBeNull();
    expect(validateRequiredString("   ")).toBeNull();
  });

  it("rejects non-string values", () => {
    expect(validateRequiredString(123)).toBeNull();
    expect(validateRequiredString(null)).toBeNull();
    expect(validateRequiredString(undefined)).toBeNull();
  });
});

describe("validateOptionalString", () => {
  it("accepts undefined/null as absent", () => {
    expect(validateOptionalString(undefined)).toBeNull();
    expect(validateOptionalString(null)).toBeNull();
  });

  it("trims and accepts a non-empty string", () => {
    expect(validateOptionalString("  สมชาย ใจดี  ")).toBe("สมชาย ใจดี");
  });

  it("normalizes a whitespace-only string to null", () => {
    expect(validateOptionalString("   ")).toBeNull();
  });

  it("rejects non-string, non-nullish values", () => {
    expect(validateOptionalString(123)).toBeNull();
  });
});

describe("isValidRole", () => {
  it("accepts the three known roles", () => {
    expect(isValidRole("ADMIN")).toBe(true);
    expect(isValidRole("METER_READER")).toBe(true);
    expect(isValidRole("RESIDENT")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidRole("admin")).toBe(false);
    expect(isValidRole("SUPERUSER")).toBe(false);
    expect(isValidRole(123)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
  });
});

describe("validateZoneIds", () => {
  it("treats a missing value as an empty list (no zones assigned)", () => {
    expect(validateZoneIds(undefined)).toEqual([]);
    expect(validateZoneIds(null)).toEqual([]);
  });

  it("accepts an array of strings as-is", () => {
    expect(validateZoneIds(["zone-a", "zone-b"])).toEqual(["zone-a", "zone-b"]);
    expect(validateZoneIds([])).toEqual([]);
  });

  it("rejects a non-array value", () => {
    expect(validateZoneIds("zone-a")).toBeNull();
    expect(validateZoneIds(123)).toBeNull();
  });

  it("rejects an array containing a non-string element", () => {
    expect(validateZoneIds(["zone-a", 123])).toBeNull();
  });
});

describe("validateRmuEmail", () => {
  it("accepts an @rmu.ac.th email and lowercases it", () => {
    expect(validateRmuEmail("Somchai@RMU.ac.th")).toBe("somchai@rmu.ac.th");
  });

  it("rejects an email outside the rmu.ac.th domain", () => {
    expect(validateRmuEmail("someone@gmail.com")).toBeNull();
  });

  it("rejects empty/non-string values", () => {
    expect(validateRmuEmail("")).toBeNull();
    expect(validateRmuEmail(undefined)).toBeNull();
    expect(validateRmuEmail(123)).toBeNull();
  });
});
