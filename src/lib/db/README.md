# src/lib/db

Server-side data access layer — Prisma client singleton (`prisma.ts`), used
only from API routes (`src/app/api/**`), never imported by client components.

See `docs/data-model.md` for the schema and `src/app/api/readings/sync/route.ts`
for the one endpoint that uses it so far (Phase 5).
