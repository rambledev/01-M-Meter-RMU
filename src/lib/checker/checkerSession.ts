import type { CheckerSession } from "./types";

// Never expires — the user confirmed a device stays logged in until
// someone explicitly logs out (matches the "no real login" ease-of-use
// this MVP has elsewhere, now backed by a real credential check once).
const STORAGE_KEY = "rmu-checker-session";

export function getCheckerSession(): CheckerSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckerSession;
  } catch {
    return null;
  }
}

export function saveCheckerSession(session: CheckerSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearCheckerSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
