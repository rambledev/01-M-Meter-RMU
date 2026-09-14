import type { ResidentSession } from "./types";

// Never expires — matches src/lib/checker/checkerSession.ts's posture
// (stays logged in on this device until an explicit logout).
const STORAGE_KEY = "rmu-resident-session";

export function getResidentSession(): ResidentSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResidentSession;
  } catch {
    return null;
  }
}

export function saveResidentSession(session: ResidentSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearResidentSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
