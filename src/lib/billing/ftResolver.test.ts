import { describe, expect, it } from "vitest";
import { normalizeToMonthStart } from "./ftResolver";

describe("normalizeToMonthStart", () => {
  it("keeps a date that is already the 1st of the month unchanged", () => {
    const date = new Date(Date.UTC(2026, 8, 1));
    expect(normalizeToMonthStart(date).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("normalizes any day-of-month down to the 1st", () => {
    const date = new Date(Date.UTC(2026, 8, 17, 13, 45));
    expect(normalizeToMonthStart(date).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("normalizes the last day of a month without rolling into the next one", () => {
    const date = new Date(Date.UTC(2026, 8, 30, 23, 59, 59));
    expect(normalizeToMonthStart(date).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
