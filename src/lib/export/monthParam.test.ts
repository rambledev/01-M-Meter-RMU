import { describe, expect, it } from "vitest";
import { parseMonthParam } from "./monthParam";

describe("parseMonthParam", () => {
  it("parses a valid YYYY-MM into the exact UTC readingMonth filter date", () => {
    const date = parseMonthParam("2026-09");
    expect(date?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects an out-of-range month", () => {
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("2026-00")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseMonthParam("not-a-month")).toBeNull();
    expect(parseMonthParam("2026-9")).toBeNull();
    expect(parseMonthParam("")).toBeNull();
  });
});
