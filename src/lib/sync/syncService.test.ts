import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { getReading, getReadings } from "@/lib/offline/readingRepository";
import { getPendingQueueItems } from "@/lib/offline/syncQueueRepository";
import { saveOfflineReading } from "@/lib/reading/readingWorkflow";
import { syncPendingReadings } from "./syncService";

function testImage(contents = "original-photo-bytes") {
  return { blob: new Blob([contents], { type: "image/jpeg" }), mimeType: "image/jpeg" };
}

async function seedPendingReading(overrides: { meterId?: string; readingMonth?: string } = {}) {
  const { reading } = await saveOfflineReading({
    meterId: overrides.meterId ?? "meter-1",
    readingMonth: overrides.readingMonth ?? "2026-09-01",
    recordedBy: "user-1",
    previousReading: 100,
    ocrValue: "135",
    confirmedValue: 135,
    image: testImage(),
  });
  return reading;
}

afterEach(async () => {
  await db.readings.clear();
  await db.readingImages.clear();
  await db.syncQueue.clear();
  vi.unstubAllGlobals();
});

describe("syncPendingReadings", () => {
  it("marks the reading SYNCED and completes the queue item on success", async () => {
    const reading = await seedPendingReading();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            reading: { id: "server-123", meterId: reading.meterId, readingMonth: reading.readingMonth, status: "SYNCED", path: "/upload/meter/x.jpg" },
          }),
          { status: 201 },
        ),
      ),
    );

    const summary = await syncPendingReadings();

    expect(summary).toEqual({ succeeded: 1, failed: 0 });

    const updated = await getReading(reading.localId);
    expect(updated?.status).toBe("SYNCED");
    expect(updated?.serverId).toBe("server-123");

    const pending = await getPendingQueueItems();
    expect(pending).toHaveLength(0); // queue item is completed (status SYNCED), no longer "pending"
  });

  it("sends the original image as multipart form data, never an OCR crop", async () => {
    const reading = await seedPendingReading();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          reading: { id: "server-1", meterId: reading.meterId, readingMonth: reading.readingMonth, status: "SYNCED", path: "/x.jpg" },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await syncPendingReadings();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/readings/sync");
    const formData = init?.body as FormData;

    const files = formData.getAll("image");
    expect(files).toHaveLength(1); // exactly one image field — never a second (crop) field
    const uploaded = files[0] as File;
    expect(await uploaded.text()).toBe("original-photo-bytes");

    const readingField = JSON.parse(formData.get("reading") as string);
    expect(readingField.confirmedValue).toBe(135);
  });

  it("marks the reading SYNC_ERROR and increments retryCount on server failure", async () => {
    await seedPendingReading();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: false, error: "INTERNAL_ERROR", message: "บันทึกไม่สำเร็จ" }),
          { status: 500 },
        ),
      ),
    );

    const summary = await syncPendingReadings();
    expect(summary).toEqual({ succeeded: 0, failed: 1 });

    const [item] = await getPendingQueueItems();
    expect(item.status).toBe("SYNC_ERROR");
    expect(item.retryCount).toBe(1);
    expect(item.lastError).toBe("บันทึกไม่สำเร็จ");
  });

  it("marks SYNC_ERROR on a network failure (fetch throws)", async () => {
    await seedPendingReading();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const summary = await syncPendingReadings();
    expect(summary).toEqual({ succeeded: 0, failed: 1 });

    const [item] = await getPendingQueueItems();
    expect(item.status).toBe("SYNC_ERROR");
    expect(item.retryCount).toBe(1);
  });

  it("treats a DUPLICATE server response as synced without creating a second local reading", async () => {
    const reading = await seedPendingReading();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: "DUPLICATE",
            message: "รายการนี้ถูกบันทึกเข้าสู่ระบบแล้ว",
            existing: { confirmedValue: 135, recordedBy: "user-1", recordedAt: reading.recordedAt },
          }),
          { status: 409 },
        ),
      ),
    );

    const summary = await syncPendingReadings();
    expect(summary).toEqual({ succeeded: 1, failed: 0 });

    const updated = await getReading(reading.localId);
    expect(updated?.status).toBe("SYNCED");

    const all = await getReadings();
    const forThisMeterMonth = all.filter(
      (r) => r.meterId === reading.meterId && r.readingMonth === reading.readingMonth,
    );
    expect(forThisMeterMonth).toHaveLength(1); // still exactly one local record, not duplicated
  });
});
