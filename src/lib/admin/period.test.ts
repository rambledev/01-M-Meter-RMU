import { describe, expect, it } from "vitest";
import { formatReadingPeriod } from "./period";

describe("formatReadingPeriod", () => {
  it("formats January 2026 as 01/2569 (Buddhist year)", () => {
    expect(formatReadingPeriod(new Date("2026-01-01T00:00:00.000Z"))).toBe("01/2569");
  });

  it("zero-pads single-digit months", () => {
    expect(formatReadingPeriod(new Date("2026-03-01T00:00:00.000Z"))).toBe("03/2569");
  });

  it("does not zero-pad double-digit months", () => {
    expect(formatReadingPeriod(new Date("2026-12-01T00:00:00.000Z"))).toBe("12/2569");
  });
});
