import { PrismaClient } from "@prisma/client";
import { mockPrismaClient } from "./mockPrisma";

// MOCK_DATA=true in .env swaps every `prisma.model.method(...)` call in the
// whole app over to the in-memory mock store (src/lib/db/mockStore.ts +
// mockPrisma.ts) instead of the real PostgreSQL client — added 2026-09-08
// so the app can run and be demoed with zero network dependency while the
// real database server is unreachable. This is the ONLY file that needs to
// change to flip that switch; every route still just imports { prisma }
// from here unchanged. Set MOCK_DATA=false (or remove it) to go back to
// the real database once it's reachable again.
const useMockData = process.env.MOCK_DATA === "true";

// Standard Next.js singleton pattern — avoids exhausting DB connections from
// module re-evaluation on every hot-reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = useMockData
  ? (mockPrismaClient as unknown as PrismaClient)
  : (globalForPrisma.prisma ?? new PrismaClient());

if (!useMockData && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (useMockData) {
  console.log("[db] MOCK_DATA=true — using in-memory mock data, no PostgreSQL connection will be made.");
}
