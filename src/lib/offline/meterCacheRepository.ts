import type { MeterInfo } from "@/lib/meters/types";
import { db } from "./db";

// Local mirror of the last successful GET /api/meters response — keeps the
// checker workflow's meter list (quick-select, manual code entry, QR scan)
// usable offline, same "offline-first, not bolted on later" principle as
// every other repository in this folder.

export async function getCachedMeters(): Promise<MeterInfo[]> {
  return db.cachedMeters.toArray();
}

export async function saveCachedMeters(meters: MeterInfo[]): Promise<void> {
  await db.transaction("rw", db.cachedMeters, async () => {
    await db.cachedMeters.clear();
    await db.cachedMeters.bulkAdd(meters);
  });
}
