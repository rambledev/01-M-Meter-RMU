# src/lib/offline

Client-side offline data layer — Dexie/IndexedDB.

- `db.ts` — Dexie database definition (`readings`, `readingImages`, `syncQueue`, `billingConfig` tables) and their TypeScript shapes, mirroring `prisma/schema.prisma` where applicable.
- `readingRepository.ts` — CRUD for drafts/readings and their images. UI code should call these functions, not `db` directly.
- `syncQueueRepository.ts` — queue data structure + CRUD; actual network sync lives in `src/lib/sync/`.
- `billingConfigRepository.ts` — `getBillingConfig()`/`saveBillingConfig()`/`resetBillingConfig()` (Phase 6B). No Prisma model — the billing config is client-only, editable in the Settings UI.

See `docs/offline-strategy.md` for the full design and rationale.
