import Dexie, { type Table } from "dexie";

// Mirrors Prisma's ReadingStatus enum (prisma/schema.prisma) — do not add new values here
// without updating the server schema first (see docs/data-model.md).
export type ReadingStatus =
  | "DRAFT"
  | "PENDING_SYNC"
  | "SYNCING"
  | "SYNCED"
  | "SYNC_ERROR";

// Client-side mirror of the Reading model (prisma/schema.prisma).
// readingMonth/recordedAt/createdAt/updatedAt are stored as ISO strings because
// IndexedDB has no native Date type that survives structured clone comparisons well
// across Dexie versions; conversion to/from Date happens at the sync layer (Phase 5).
export interface LocalReading {
  localId: string; // client-generated id (crypto.randomUUID()), primary key — kept separate from serverId so no server ID needs to be guessed offline (see decision-log.md)
  serverId?: string; // filled in once the reading has been synced and the server assigned its own id
  meterId: string;
  readingMonth: string; // ISO date string, always the 1st of the month
  previousReading?: number; // snapshot at confirm time (nullable — no prior reading yet)
  ocrValue?: string;
  confirmedValue?: number; // nullable while status is DRAFT (requirement.md §3.3, data-model.md §5)
  usage?: number; // confirmedValue - previousReading, nullable until confirmed
  status: ReadingStatus;
  recordedBy: string;
  recordedAt?: string; // set when the user confirms — absent while still DRAFT
  createdAt: string;
  updatedAt: string;
  lastSyncError?: string; // set when status = SYNC_ERROR (workflow.md §3)
}

// Original Image only — never crop/OCR region images (decision-log.md: "ไม่จัดเก็บ OCR Crop Image แบบถาวร").
export interface LocalReadingImage {
  localId: string;
  localReadingId: string; // FK -> LocalReading.localId
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

export type SyncQueueAction = "CREATE" | "UPDATE";

// Queue entries prepared for Phase 5 (auto-sync). No network/retry logic lives here yet.
export interface SyncQueueItem {
  id: string;
  readingId: string; // FK -> LocalReading.localId
  action: SyncQueueAction;
  status: ReadingStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

class LocalDatabase extends Dexie {
  readings!: Table<LocalReading, string>;
  readingImages!: Table<LocalReadingImage, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("rmu-meter-offline");
    this.version(1).stores({
      readings: "localId, serverId, meterId, status, [meterId+readingMonth]",
      readingImages: "localId, localReadingId",
      syncQueue: "id, readingId, status",
    });
  }
}

export const db = new LocalDatabase();
