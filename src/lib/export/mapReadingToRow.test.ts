import { describe, expect, it } from "vitest";
import { mapReadingToRow, type ReadingForExport } from "./mapReadingToRow";

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
    const row = mapReadingToRow(reading(), 1);

    expect(row).toEqual({
      seq: 1,
      roomName: "ห้อง 101",
      residentName: "สมชาย ใจดี",
      currentValue: 260,
      previousValue: 200,
      usage: 60,
      baseCharge: null,
      ftCharge: null,
      tax: null,
      total: null,
    });
  });

  it("accepts Prisma Decimal-like values (anything Number()-coercible)", () => {
    // Prisma returns Decimal fields as objects whose toString()/valueOf()
    // yield the numeric string — Number(x) coerces those correctly too.
    const row = mapReadingToRow(
      reading({ confirmedValue: "260.5", previousReading: "200.25" }),
      2,
    );
    expect(row.currentValue).toBe(260.5);
    expect(row.previousValue).toBe(200.25);
    expect(row.usage).toBe(60.25);
  });

  it("leaves usage null when there is no previous reading", () => {
    const row = mapReadingToRow(reading({ previousReading: null }), 1);
    expect(row.previousValue).toBeNull();
    expect(row.usage).toBeNull();
  });

  it("leaves currentValue/usage null when confirmedValue is missing", () => {
    const row = mapReadingToRow(reading({ confirmedValue: null }), 1);
    expect(row.currentValue).toBeNull();
    expect(row.usage).toBeNull();
  });

  it("falls back to an empty string when residentName is not set", () => {
    const row = mapReadingToRow(
      reading({ meter: { room: { name: "ห้อง 201", residentName: null } } }),
      1,
    );
    expect(row.residentName).toBe("");
  });

  it("never populates a real billing formula", () => {
    const row = mapReadingToRow(reading(), 1);
    expect(row.baseCharge).toBeNull();
    expect(row.ftCharge).toBeNull();
    expect(row.tax).toBeNull();
    expect(row.total).toBeNull();
  });
});
