import { afterEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  addReadingImage,
  createDraftReading,
  deleteDraftReading,
  getReading,
  getReadingImages,
  getReadings,
  updateReading,
} from "./readingRepository";

afterEach(async () => {
  await db.readings.clear();
  await db.readingImages.clear();
  await db.syncQueue.clear();
});

describe("createDraftReading", () => {
  it("creates a DRAFT reading", async () => {
    const reading = await createDraftReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
      previousReading: 100,
    });

    expect(reading.status).toBe("DRAFT");
    expect(reading.confirmedValue).toBeUndefined();

    const stored = await getReading(reading.localId);
    expect(stored).toEqual(reading);
  });
});

describe("updateReading", () => {
  it("edits fields and changes status", async () => {
    const reading = await createDraftReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
    });

    await updateReading(reading.localId, {
      ocrValue: "12345",
      confirmedValue: 12345,
      usage: 45,
      status: "PENDING_SYNC",
      recordedAt: new Date().toISOString(),
    });

    const updated = await getReading(reading.localId);
    expect(updated?.confirmedValue).toBe(12345);
    expect(updated?.status).toBe("PENDING_SYNC");
    expect(updated?.recordedAt).toBeDefined();
  });

  it("throws when the reading does not exist", async () => {
    await expect(
      updateReading("does-not-exist", { status: "SYNCED" }),
    ).rejects.toThrow();
  });
});

describe("getReadings", () => {
  it("filters by status", async () => {
    const a = await createDraftReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
    });
    await createDraftReading({
      meterId: "meter-2",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
    });
    await updateReading(a.localId, { status: "SYNCED" });

    const draft = await getReadings({ status: "DRAFT" });
    const synced = await getReadings({ status: "SYNCED" });

    expect(draft).toHaveLength(1);
    expect(synced).toHaveLength(1);
    expect(synced[0].localId).toBe(a.localId);
  });
});

describe("reading images", () => {
  it("stores an image blob linked to its reading", async () => {
    const reading = await createDraftReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
    });
    const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });

    const image = await addReadingImage(reading.localId, blob, "image/jpeg");

    expect(image.localReadingId).toBe(reading.localId);

    const images = await getReadingImages(reading.localId);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe("image/jpeg");
    // IndexedDB structured-clones the Blob, so it's a new instance with equal content.
    expect(images[0].blob.size).toBe(blob.size);
    expect(images[0].blob.type).toBe(blob.type);
    await expect(images[0].blob.text()).resolves.toBe(
      await blob.text(),
    );
  });
});

describe("deleteDraftReading", () => {
  it("deletes a DRAFT reading and its images", async () => {
    const reading = await createDraftReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
    });
    await addReadingImage(
      reading.localId,
      new Blob(["x"]),
      "image/jpeg",
    );

    await deleteDraftReading(reading.localId);

    expect(await getReading(reading.localId)).toBeUndefined();
    expect(await getReadingImages(reading.localId)).toHaveLength(0);
  });

  it("refuses to delete a reading that is no longer DRAFT", async () => {
    const reading = await createDraftReading({
      meterId: "meter-1",
      readingMonth: "2026-09-01",
      recordedBy: "user-1",
    });
    await updateReading(reading.localId, { status: "PENDING_SYNC" });

    await expect(deleteDraftReading(reading.localId)).rejects.toThrow();
  });
});
