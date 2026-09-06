// Shared status label/color for ReadingStatus — mirrors Prisma's enum
// (prisma/schema.prisma) and the Dexie mirror (src/lib/offline/db.ts).
// Used by both the checker page's own history list and the admin reading
// history tab, so the two never drift apart.
export type ReadingStatusValue =
  | "DRAFT"
  | "PENDING_SYNC"
  | "SYNCING"
  | "SYNCED"
  | "SYNC_ERROR";

export const READING_STATUS_LABEL: Record<ReadingStatusValue, string> = {
  DRAFT: "แบบร่าง",
  PENDING_SYNC: "รอ Sync",
  SYNCING: "กำลัง Sync",
  SYNCED: "Sync แล้ว",
  SYNC_ERROR: "Sync ผิดพลาด",
};

export const READING_STATUS_COLOR: Record<ReadingStatusValue, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  PENDING_SYNC: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  SYNCING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  SYNCED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  SYNC_ERROR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};
