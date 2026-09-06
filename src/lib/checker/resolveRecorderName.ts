import type { CheckerSession } from "./types";

// A device's local reading history can, in principle, contain readings
// recorded by a different checker who used this device before (or the
// fixed demo user id from before real login existed) — this only resolves
// a friendly name for the CURRENT session's own readings; anything else
// falls back to the raw recordedBy id (was hardcoded to one demo user
// before 2026-09-06's login feature).
export function resolveRecorderName(
  recordedBy: string,
  session: CheckerSession | null,
): string {
  if (session && recordedBy === session.id) return session.name;
  return recordedBy;
}
