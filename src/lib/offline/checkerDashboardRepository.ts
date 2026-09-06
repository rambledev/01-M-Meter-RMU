import type { CheckerDashboard } from "@/lib/checker/types";
import { db, type LocalCheckerDashboard } from "./db";

function nowIso(): string {
  return new Date().toISOString();
}

function toCheckerDashboard(stored: LocalCheckerDashboard): CheckerDashboard {
  const { zones, meters } = stored;
  return { zones, meters };
}

export async function getCachedDashboard(userId: string): Promise<CheckerDashboard | null> {
  const stored = await db.checkerDashboard.get(userId);
  return stored ? toCheckerDashboard(stored) : null;
}

export async function saveCachedDashboard(
  userId: string,
  month: string,
  dashboard: CheckerDashboard,
): Promise<void> {
  const row: LocalCheckerDashboard = { ...dashboard, userId, month, updatedAt: nowIso() };
  await db.checkerDashboard.put(row);
}
