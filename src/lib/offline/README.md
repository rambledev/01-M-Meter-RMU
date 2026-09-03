# src/lib/offline

Client-side offline data layer — Dexie/IndexedDB.

- `db.ts` — Dexie database definition (`readings`, `readingImages`, `syncQueue` tables) and their TypeScript shapes, mirroring `prisma/schema.prisma`.
- `readingRepository.ts` — CRUD for drafts/readings and their images. UI code should call these functions, not `db` directly.
- `syncQueueRepository.ts` — queue data structure + CRUD only. No network sync, retry, or conflict resolution — that's Phase 5.

See `docs/offline-strategy.md` for the full design and rationale.
