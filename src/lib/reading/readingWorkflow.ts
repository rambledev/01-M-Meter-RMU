// Orchestration layer between the UI and the offline repositories
// (see docs/workflow.md and item 12 of the Phase 3 spec):
//
//   UI -> Meter lookup / Reading workflow -> Repository -> Dexie -> IndexedDB
//
// The UI should call functions here instead of importing the repositories
// (or Dexie) directly.

import type { LocalReading } from "@/lib/offline/db";
import {
  addReadingImage,
  createDraftReading,
  findReadingByMeterAndMonth,
  getReading,
  updateReading,
} from "@/lib/offline/readingRepository";
import { enqueueForSync } from "@/lib/offline/syncQueueRepository";
import { calculateUsage, previousReadingMonth } from "./readingMonth";

export interface PreviousReadingLookup {
  value?: number;
  found: boolean;
}

// requirement.md §3.1: the previous reading is always the reading from the
// calendar month right before the selected one — never just "the latest
// reading on record".
export async function lookupPreviousReading(
  meterId: string,
  readingMonth: string,
): Promise<PreviousReadingLookup> {
  const reading = await findReadingByMeterAndMonth(
    meterId,
    previousReadingMonth(readingMonth),
  );
  return { value: reading?.confirmedValue, found: reading !== undefined };
}

// Client-side best-effort duplicate check (requirement.md §3.2) — the
// server's unique constraint is still the real source of truth once synced.
export async function checkDuplicateReading(
  meterId: string,
  readingMonth: string,
): Promise<LocalReading | undefined> {
  return findReadingByMeterAndMonth(meterId, readingMonth);
}

export interface SaveReadingImageInput {
  blob: Blob; // ORIGINAL full meter photo only — never an OCR crop (decision-log.md)
  mimeType: string;
}

export interface SaveReadingInput {
  meterId: string;
  readingMonth: string;
  recordedBy: string;
  previousReading?: number;
  confirmedValue: number;
  ocrValue?: string; // raw OCR result — kept separate from confirmedValue (ocr-strategy.md §4)
  image: SaveReadingImageInput;
}

export interface SaveReadingResult {
  reading: LocalReading;
}

// Save sequence per item 8 of the Phase 3 spec (Phase 4 adds ocrValue + the
// original image, saved via the same Phase 2 repository — no new storage
// layer, no crop image, ever persisted):
//   createDraftReading() -> addReadingImage() -> updateReading() -> status PENDING_SYNC -> enqueueForSync()
// Re-checks for a duplicate right before writing (in addition to whatever the
// UI already checked) to close the gap between "user looked at the screen"
// and "user pressed confirm".
export async function saveOfflineReading(
  input: SaveReadingInput,
): Promise<SaveReadingResult> {
  const existing = await findReadingByMeterAndMonth(
    input.meterId,
    input.readingMonth,
  );
  if (existing) {
    throw new Error(
      `มีการบันทึกมิเตอร์นี้ในเดือนนี้แล้ว (localId: ${existing.localId})`,
    );
  }

  const usage = calculateUsage(input.confirmedValue, input.previousReading);

  const draft = await createDraftReading({
    meterId: input.meterId,
    readingMonth: input.readingMonth,
    recordedBy: input.recordedBy,
    previousReading: input.previousReading,
  });

  await addReadingImage(draft.localId, input.image.blob, input.image.mimeType);

  await updateReading(draft.localId, {
    ocrValue: input.ocrValue,
    confirmedValue: input.confirmedValue,
    usage,
    status: "PENDING_SYNC",
    recordedAt: new Date().toISOString(),
  });

  await enqueueForSync(draft.localId, "CREATE");

  const saved = await getReading(draft.localId);
  if (!saved) {
    throw new Error("บันทึกไม่สำเร็จ — ไม่พบข้อมูลหลังบันทึก");
  }
  return { reading: saved };
}
