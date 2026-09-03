// Client-side sync orchestration (Phase 5) — deliberately simple: no
// background/Service Worker/Web Worker sync, no exponential backoff, no
// conflict resolution. One button ("Sync ข้อมูล") calls syncPendingReadings()
// and processes the queue sequentially (offline-strategy.md §4).

import {
  getReading,
  getReadingImages,
  updateReading,
} from "@/lib/offline/readingRepository";
import type { SyncQueueItem } from "@/lib/offline/db";
import { getPendingQueueItems, updateQueueItem } from "@/lib/offline/syncQueueRepository";

interface SyncApiSuccess {
  ok: true;
  reading: { id: string; meterId: string; readingMonth: string; status: string; path: string };
}

interface SyncApiError {
  ok: false;
  error: string;
  message: string;
  existing?: { confirmedValue: number | null; recordedBy: string; recordedAt: string | null };
}

type SyncApiResponse = SyncApiSuccess | SyncApiError;

export interface SyncSummary {
  succeeded: number;
  failed: number;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

// Sends only the ORIGINAL image — there is nothing else in readingImages to
// send (no OCR crop was ever stored, see decision-log.md).
async function syncOne(item: SyncQueueItem): Promise<boolean> {
  const reading = await getReading(item.readingId);
  if (!reading) {
    await updateQueueItem(item.id, {
      status: "SYNC_ERROR",
      lastError: "ไม่พบข้อมูล reading ในเครื่อง",
      retryCount: item.retryCount + 1,
    });
    return false;
  }

  const images = await getReadingImages(item.readingId);
  const original = images[0];

  const formData = new FormData();
  formData.append(
    "reading",
    JSON.stringify({
      localId: reading.localId,
      meterId: reading.meterId,
      readingMonth: reading.readingMonth,
      previousReading: reading.previousReading ?? null,
      ocrValue: reading.ocrValue ?? null,
      confirmedValue: reading.confirmedValue,
      usage: reading.usage ?? null,
      recordedBy: reading.recordedBy,
      recordedAt: reading.recordedAt,
    }),
  );
  if (original) {
    formData.append(
      "image",
      original.blob,
      `${reading.localId}.${extensionForMimeType(original.mimeType)}`,
    );
  }

  let body: SyncApiResponse;
  try {
    const res = await fetch("/api/readings/sync", { method: "POST", body: formData });
    body = (await res.json()) as SyncApiResponse;
  } catch {
    await updateReading(reading.localId, {
      status: "SYNC_ERROR",
      lastSyncError: "เชื่อมต่อเครือข่ายไม่สำเร็จ",
    });
    await updateQueueItem(item.id, {
      status: "SYNC_ERROR",
      lastError: "เชื่อมต่อเครือข่ายไม่สำเร็จ",
      retryCount: item.retryCount + 1,
    });
    return false;
  }

  if (body.ok) {
    await updateReading(reading.localId, {
      serverId: body.reading.id,
      status: "SYNCED",
      lastSyncError: undefined,
    });
    await updateQueueItem(item.id, { status: "SYNCED" });
    return true;
  }

  if (body.error === "DUPLICATE") {
    // Server is the source of truth for duplicates (requirement.md §3.2) —
    // the data already exists there, so treat this local record as caught up
    // rather than retrying forever. Simplest option permitted by the Phase 5
    // spec (see decision-log.md).
    await updateReading(reading.localId, { status: "SYNCED" });
    await updateQueueItem(item.id, { status: "SYNCED" });
    return true;
  }

  await updateReading(reading.localId, {
    status: "SYNC_ERROR",
    lastSyncError: body.message,
  });
  await updateQueueItem(item.id, {
    status: "SYNC_ERROR",
    lastError: body.message,
    retryCount: item.retryCount + 1,
  });
  return false;
}

export async function syncPendingReadings(): Promise<SyncSummary> {
  const items = await getPendingQueueItems();
  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    const ok = await syncOne(item);
    if (ok) succeeded += 1;
    else failed += 1;
  }
  return { succeeded, failed };
}
