# src/lib/sync

Sync orchestration between the offline queue and the server (Phase 5).

- `syncService.ts` — `syncPendingReadings()`: walks the offline queue
  (`src/lib/offline/syncQueueRepository.ts`), uploads each pending reading +
  image to `POST /api/readings/sync`, and updates local status
  (`SYNCED`/`SYNC_ERROR`) accordingly.

Manual trigger only (a "Sync ข้อมูล" button in the UI) — no background/auto
sync on reconnect, by explicit decision (see `docs/decision-log.md`).
