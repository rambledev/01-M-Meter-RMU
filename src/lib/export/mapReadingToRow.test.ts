import { describe, expect, it } from "vitest";
import type { BillingConfig } from "@/lib/billing/types";
import { mapReadingToRow, type ReadingForExport } from "./mapReadingToRow";

const CONFIG: BillingConfig = {
  ftRate: 0.5,
  taxRatePercent: 10,
  baseCharge: 10,
  tiers: [{ minUnit: 0, maxUnit: null, rate: 2 }],
};

function reading(overrides: Partial<ReadingForExport> = {}): ReadingForExport {
  return {
    confirmedValue: 260,
    previousReading: 200,
    meter: { room: { name: "ห้อง 101", residentName: "สมชาย ใจดี" } },
    ...overrides,
  };
}

describe("mapReadingToRow", () => {
  it("maps room/resident/values from the Reading+Meter+Room join", () => {
    const row = mapReadingToRow(reading(), 1, CONFIG);

    expect(row.seq).toBe(1);
    expect(row.roomName).toBe("ห้อง 101");
    expect(row.residentName).toBe("สมชาย ใจดี");
    expect(row.currentValue).toBe(260);
    expect(row.previousValue).toBe(200);
    expect(row.usage).toBe(60);
  });

  it("calls the Calculation Service for billing — usage=60 at the given config", () => {
    const row = mapReadingToRow(reading(), 1, CONFIG);
    // usage=60; baseCharge = 60*2 + 10 = 130; ftCharge = 60*0.5 = 30;
    // tax = (130+30)*10% = 16; total = 130+30+16 = 176
    expect(row.baseCharge).toBe(130);
    expect(row.ftCharge).toBe(30);
    expect(row.tax).toBeCloseTo(16, 5);
    expect(row.total).toBeCloseTo(176, 5);
  });

  it("accepts Prisma Decimal-like values (anything Number()-coercible)", () => {
    const row = mapReadingToRow(
      reading({ confirmedValue: "260.5", previousReading: "200.25" }),
      2,
      CONFIG,
    );
    expect(row.currentValue).toBe(260.5);
    expect(row.previousValue).toBe(200.25);
    expect(row.usage).toBe(60.25);
  });

  it("leaves usage and billing null when there is no previous reading", () => {
    const row = mapReadingToRow(reading({ previousReading: null }), 1, CONFIG);
    expect(row.previousValue).toBeNull();
    expect(row.usage).toBeNull();
    expect(row.baseCharge).toBeNull();
    expect(row.ftCharge).toBeNull();
    expect(row.tax).toBeNull();
    expect(row.total).toBeNull();
  });

  it("leaves currentValue/usage/billing null when confirmedValue is missing", () => {
    const row = mapReadingToRow(reading({ confirmedValue: null }), 1, CONFIG);
    expect(row.currentValue).toBeNull();
    expect(row.usage).toBeNull();
    expect(row.baseCharge).toBeNull();
  });

  it("falls back to an empty string when residentName is not set", () => {
    const row = mapReadingToRow(
      reading({ meter: { room: { name: "ห้อง 201", residentName: null } } }),
      1,
      CONFIG,
    );
    expect(row.residentName).toBe("");
  });

  it("uses whatever config is passed in — no formula duplicated here", () => {
    const otherConfig: BillingConfig = { ...CONFIG, ftRate: 2 };
    const row = mapReadingToRow(reading(), 1, otherConfig);
    expect(row.ftCharge).toBe(120); // usage=60 * ftRate=2
  });
});
