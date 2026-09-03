import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { getPendingQueueItems } from "@/lib/offline/syncQueueRepository";
import {
  checkDuplicateReading,
  lookupPreviousReading,
  saveOfflineReading,
} from "./readingWorkflow";

afterEach(async () => {
  await db.readings.clear();
  await db.readingImages.clear();
  await db.syncQueue.clear();
});

describe("lookupPreviousReading", () => {
  it("uses the reading from the calendar month right before the selected one", async () => {
    await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-07-01",
      recordedBy: "user-1",
      confirmedValue: 100,
    });
    await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-08-01",
      recordedBy: "user-1",
      previousReading: 100,
      confirmedValue: 120,
    });

    const forSeptember = await lookupPreviousReading("meter-1", "2026-09-01");
    expect(forSeptember).toEqual({ value: 120, found: true });

    const forAugust = await lookupPreviousReading("meter-1", "2026-08-01");
    expect(forAugust).toEqual({ value: 100, found: true });
  });

  it("reports not-found when there is no reading for the prior month", async () => {
    const result = await lookupPreviousReading("meter-1", "2026-09-01");
    expect(result).toEqual({ value: undefined, found: false });
  });
});

describe("saveOfflineReading", () => {
  it("creates the reading, computes usage, and enqueues it for sync", async () => {
    const { reading } = await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
      previousReading: 120,
      confirmedValue: 135,
    });

    expect(reading.status).toBe("PENDING_SYNC");
    expect(reading.usage).toBe(15);
    expect(reading.recordedAt).toBeDefined();

    const queue = await getPendingQueueItems();
    expect(queue).toHaveLength(1);
    expect(queue[0].readingId).toBe(reading.localId);
    expect(queue[0].action).toBe("CREATE");
  });

  it("prevents saving twice for the same meter + reading month", async () => {
    await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
      confirmedValue: 135,
    });

    await expect(
      saveOfflineReading({
        meterId: "meter-1",
        readingMonth: "2026-09-01",
        recordedBy: "user-1",
        confirmedValue: 999,
      }),
    ).rejects.toThrow();

    const duplicate = await checkDuplicateReading("meter-1", "2026-09-01");
    expect(duplicate?.confirmedValue).toBe(135); // the first save wins, not overwritten
  });

  it("allows the same meter in a different month", async () => {
    await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-08-01",
      recordedBy: "user-1",
      confirmedValue: 100,
    });

    await expect(
      saveOfflineReading({
        meterId: "meter-1",
        readingMonth: "2026-09-01",
        recordedBy: "user-1",
        confirmedValue: 120,
      }),
    ).resolves.toBeDefined();
  });
});
