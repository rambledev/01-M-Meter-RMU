import { afterEach, describe, expect, it } from "vitest";
import type { MeterInfo } from "@/lib/meters/types";
import { getCachedMeters, saveCachedMeters } from "./meterCacheRepository";
import { db } from "./db";

afterEach(async () => {
  await db.cachedMeters.clear();
});

const FIXTURE: MeterInfo[] = [
  { id: "m1", code: "ME-001", roomId: "r1", roomName: "ห้อง 101", zoneId: "z1", zoneName: "Zone A" },
  { id: "m2", code: "ME-002", roomId: "r2", roomName: "ห้อง 102", zoneId: "z1", zoneName: "Zone A" },
];

describe("getCachedMeters", () => {
  it("returns an empty list before anything has been cached", async () => {
    expect(await getCachedMeters()).toEqual([]);
  });
});

describe("saveCachedMeters", () => {
  it("stores the given meters, replacing any previous cache", async () => {
    await saveCachedMeters(FIXTURE);
    expect(await getCachedMeters()).toEqual(FIXTURE);

    const replaced: MeterInfo[] = [
      { id: "m3", code: "ME-003", roomId: "r3", roomName: "ห้อง 201", zoneId: "z2", zoneName: "Zone B" },
    ];
    await saveCachedMeters(replaced);
    expect(await getCachedMeters()).toEqual(replaced);
  });
});
