import { describe, expect, it } from "vitest";
import { lookupMeter } from "./meterLookup";

describe("lookupMeter", () => {
  it("finds a meter from a raw meter code", () => {
    const meter = lookupMeter("ME-001");
    expect(meter?.code).toBe("ME-001");
    expect(meter?.room.name).toBe("ห้อง 101");
    expect(meter?.room.zone.name).toBe("Zone A");
  });

  it("finds a meter from a QR payload (METER:CODE)", () => {
    const meter = lookupMeter("METER:ME-002");
    expect(meter?.code).toBe("ME-002");
  });

  it("is case-insensitive and trims whitespace", () => {
    const meter = lookupMeter("  metEr:me-003  ");
    expect(meter?.code).toBe("ME-003");
  });

  it("returns undefined for an unknown code", () => {
    expect(lookupMeter("ME-999")).toBeUndefined();
  });
});
