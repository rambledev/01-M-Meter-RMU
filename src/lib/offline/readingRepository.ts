import { db, type LocalReading, type LocalReadingImage, type ReadingStatus } from "./db";

function nowIso(): string {
  return new Date().toISOString();
}

export interface CreateDraftReadingInput {
  meterId: string;
  readingMonth: string;
  recordedBy: string;
  previousReading?: number;
}

export async function createDraftReading(
  input: CreateDraftReadingInput,
): Promise<LocalReading> {
  const timestamp = nowIso();
  const reading: LocalReading = {
    localId: crypto.randomUUID(),
    meterId: input.meterId,
    readingMonth: input.readingMonth,
    previousReading: input.previousReading,
    status: "DRAFT",
    recordedBy: input.recordedBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.readings.add(reading);
  return reading;
}

export async function updateReading(
  localId: string,
  changes: Partial<Omit<LocalReading, "localId" | "createdAt">>,
): Promise<void> {
  const updated = await db.readings.update(localId, {
    ...changes,
    updatedAt: nowIso(),
  });
  if (updated === 0) {
    throw new Error(`Reading not found: ${localId}`);
  }
}

export async function getReading(
  localId: string,
): Promise<LocalReading | undefined> {
  return db.readings.get(localId);
}

export async function getReadings(filter?: {
  status?: ReadingStatus;
}): Promise<LocalReading[]> {
  if (filter?.status) {
    return db.readings.where("status").equals(filter.status).toArray();
  }
  return db.readings.toArray();
}

// Used for both the Previous Reading lookup (requirement.md §3.1: the reading
// from the calendar month right before the selected one, never just "latest")
// and the client-side best-effort duplicate check (requirement.md §3.2) — the
// server's `@@unique([meterId, readingMonth])` remains the real source of
// truth once Phase 5 syncs this record.
export async function findReadingByMeterAndMonth(
  meterId: string,
  readingMonth: string,
): Promise<LocalReading | undefined> {
  return db.readings
    .where("[meterId+readingMonth]")
    .equals([meterId, readingMonth])
    .first();
}

// Only DRAFT readings can be discarded — anything past confirm must go through
// the sync/error flow instead (workflow.md §3), not be silently deleted.
export async function deleteDraftReading(localId: string): Promise<void> {
  const reading = await db.readings.get(localId);
  if (!reading) return;
  if (reading.status !== "DRAFT") {
    throw new Error(
      `Only DRAFT readings can be deleted (current status: ${reading.status})`,
    );
  }
  await db.transaction("rw", db.readings, db.readingImages, async () => {
    await db.readingImages.where("localReadingId").equals(localId).delete();
    await db.readings.delete(localId);
  });
}

// Original Image only — never pass an OCR crop/region image here
// (decision-log.md: "ไม่จัดเก็บ OCR Crop Image แบบถาวร").
export async function addReadingImage(
  localReadingId: string,
  blob: Blob,
  mimeType: string,
): Promise<LocalReadingImage> {
  const image: LocalReadingImage = {
    localId: crypto.randomUUID(),
    localReadingId,
    blob,
    mimeType,
    createdAt: nowIso(),
  };
  await db.readingImages.add(image);
  return image;
}

export async function getReadingImages(
  localReadingId: string,
): Promise<LocalReadingImage[]> {
  return db.readingImages
    .where("localReadingId")
    .equals(localReadingId)
    .toArray();
}
