import { afterEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  enqueueForSync,
  getPendingQueueItems,
  getQueueItem,
  updateQueueItem,
} from "./syncQueueRepository";

afterEach(async () => {
  await db.readings.clear();
  await db.readingImages.clear();
  await db.syncQueue.clear();
});

describe("enqueueForSync", () => {
  it("creates a queue entry in PENDING_SYNC", async () => {
    const item = await enqueueForSync("reading-1", "CREATE");

    expect(item.status).toBe("PENDING_SYNC");
    expect(item.retryCount).toBe(0);

    const stored = await getQueueItem(item.id);
    expect(stored).toEqual(item);
  });
});

describe("getPendingQueueItems", () => {
  it("returns only PENDING_SYNC/SYNC_ERROR items, oldest first", async () => {
    const first = await enqueueForSync("reading-1", "CREATE");
    const second = await enqueueForSync("reading-2", "UPDATE");
    await updateQueueItem(second.id, { status: "SYNC_ERROR", lastError: "network" });
    const synced = await enqueueForSync("reading-3", "CREATE");
    await updateQueueItem(synced.id, { status: "SYNCED" });

    const pending = await getPendingQueueItems();

    expect(pending.map((item) => item.id)).toEqual([first.id, second.id]);
  });
});

describe("updateQueueItem", () => {
  it("changes status and tracks retries", async () => {
    const item = await enqueueForSync("reading-1", "CREATE");

    await updateQueueItem(item.id, {
      status: "SYNC_ERROR",
      retryCount: 1,
      lastError: "timeout",
    });

    const updated = await getQueueItem(item.id);
    expect(updated?.status).toBe("SYNC_ERROR");
    expect(updated?.retryCount).toBe(1);
    expect(updated?.lastError).toBe("timeout");
  });

  it("throws when the queue item does not exist", async () => {
    await expect(
      updateQueueItem("does-not-exist", { status: "SYNCED" }),
    ).rejects.toThrow();
  });
});
