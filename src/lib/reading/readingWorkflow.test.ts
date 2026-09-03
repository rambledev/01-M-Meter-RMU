import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { getReadingImages } from "@/lib/offline/readingRepository";
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

function testImage(contents = "fake-meter-photo"): {
  blob: Blob;
  mimeType: string;
} {
  return { blob: new Blob([contents], { type: "image/jpeg" }), mimeType: "image/jpeg" };
}

describe("lookupPreviousReading", () => {
  it("uses the reading from the calendar month right before the selected one", async () => {
    await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-07-01",
      recordedBy: "user-1",
      confirmedValue: 100,
      image: testImage(),
    });
    await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-08-01",
      recordedBy: "user-1",
      previousReading: 100,
      confirmedValue: 120,
      image: testImage(),
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
      image: testImage(),
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
      image: testImage(),
    });

    await expect(
      saveOfflineReading({
        meterId: "meter-1",
        readingMonth: "2026-09-01",
        recordedBy: "user-1",
        confirmedValue: 999,
        image: testImage(),
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
      image: testImage(),
    });

    await expect(
      saveOfflineReading({
        meterId: "meter-1",
        readingMonth: "2026-09-01",
        recordedBy: "user-1",
        confirmedValue: 120,
        image: testImage(),
      }),
    ).resolves.toBeDefined();
  });

  // --- Phase 4 (Camera + OCR) ---

  it("keeps ocrValue separate from confirmedValue instead of overwriting it", async () => {
    const { reading } = await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
      previousReading: 100,
      ocrValue: "1234.5", // what OCR read
      confirmedValue: 1230, // what the user actually corrected it to
      image: testImage(),
    });

    expect(reading.ocrValue).toBe("1234.5");
    expect(reading.confirmedValue).toBe(1230);
    // usage must be derived from confirmedValue, never from the raw OCR text
    expect(reading.usage).toBe(1130);
  });

  it("stores only the original image — never an OCR crop", async () => {
    const original = testImage("full-meter-photo-bytes");
    const { reading } = await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
      ocrValue: "1234.5",
      confirmedValue: 1234.5,
      image: original,
    });

    const images = await getReadingImages(reading.localId);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe("image/jpeg");
    await expect(images[0].blob.text()).resolves.toBe(
      await original.blob.text(),
    );
  });

  it("creates an offline reading together with its image and sync queue entry", async () => {
    const { reading } = await saveOfflineReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
      ocrValue: "50",
      confirmedValue: 50,
      image: testImage(),
    });

    const images = await getReadingImages(reading.localId);
    const queue = await getPendingQueueItems();

    expect(reading.status).toBe("PENDING_SYNC");
    expect(images).toHaveLength(1);
    expect(queue).toHaveLength(1);
    expect(queue[0].readingId).toBe(reading.localId);
  });
});
