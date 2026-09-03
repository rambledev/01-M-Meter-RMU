import { db, type SyncQueueAction, type SyncQueueItem } from "./db";

// Data structure + CRUD only — no network calls, retry scheduling, or conflict
// resolution here. Phase 5 (Sync) builds that logic on top of these primitives.

function nowIso(): string {
  return new Date().toISOString();
}

export async function enqueueForSync(
  readingId: string,
  action: SyncQueueAction,
): Promise<SyncQueueItem> {
  const timestamp = nowIso();
  const item: SyncQueueItem = {
    id: crypto.randomUUID(),
    readingId,
    action,
    status: "PENDING_SYNC",
    retryCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.syncQueue.add(item);
  return item;
}

export async function getQueueItem(
  id: string,
): Promise<SyncQueueItem | undefined> {
  return db.syncQueue.get(id);
}

// Ordered oldest-first so Phase 5 can process sequentially (offline-strategy.md §4).
export async function getPendingQueueItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue
    .where("status")
    .anyOf(["PENDING_SYNC", "SYNC_ERROR"])
    .sortBy("createdAt");
}

export async function updateQueueItem(
  id: string,
  changes: Partial<Omit<SyncQueueItem, "id" | "createdAt">>,
): Promise<void> {
  const updated = await db.syncQueue.update(id, {
    ...changes,
    updatedAt: nowIso(),
  });
  if (updated === 0) {
    throw new Error(`Sync queue item not found: ${id}`);
  }
}
