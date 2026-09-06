import { describe, expect, it } from "vitest";
import {
  findMeterByCode,
  findMeterById,
  lookupMeter,
  parseMeterScanPayload,
} from "./meterLookup";
import type { MeterInfo } from "./types";

const FIXTURE: MeterInfo[] = [
  { id: "m1", code: "ME-001", roomId: "r1", roomName: "ห้อง 101", zoneId: "z1", zoneName: "Zone A" },
  { id: "m2", code: "ME-002", roomId: "r2", roomName: "ห้อง 102", zoneId: "z1", zoneName: "Zone A" },
];

describe("parseMeterScanPayload", () => {
  it("strips the METER: prefix", () => {
    expect(parseMeterScanPayload("METER:ME-001")).toBe("ME-001");
  });

  it("is case-insensitive on the prefix and trims whitespace", () => {
    expect(parseMeterScanPayload("  metEr:me-003  ")).toBe("me-003");
  });

  it("passes a raw code through unchanged (no prefix)", () => {
    expect(parseMeterScanPayload("ME-001")).toBe("ME-001");
  });
});

describe("findMeterByCode", () => {
  it("finds a meter from a raw meter code", () => {
    const meter = findMeterByCode(FIXTURE, "ME-001");
    expect(meter?.roomName).toBe("ห้อง 101");
    expect(meter?.zoneName).toBe("Zone A");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(findMeterByCode(FIXTURE, "  me-002  ")?.id).toBe("m2");
  });

  it("returns undefined for an unknown code", () => {
    expect(findMeterByCode(FIXTURE, "ME-999")).toBeUndefined();
  });
});

describe("findMeterById", () => {
  it("finds a meter by id", () => {
    expect(findMeterById(FIXTURE, "m2")?.code).toBe("ME-002");
  });

  it("returns undefined for an unknown id", () => {
    expect(findMeterById(FIXTURE, "does-not-exist")).toBeUndefined();
  });
});

describe("lookupMeter", () => {
  it("finds a meter from a raw meter code", () => {
    expect(lookupMeter(FIXTURE, "ME-001")?.code).toBe("ME-001");
  });

  it("finds a meter from a QR payload (METER:CODE)", () => {
    expect(lookupMeter(FIXTURE, "METER:ME-002")?.code).toBe("ME-002");
  });

  it("returns undefined for an unknown code", () => {
    expect(lookupMeter(FIXTURE, "ME-999")).toBeUndefined();
  });
});
