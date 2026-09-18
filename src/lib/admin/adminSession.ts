import type { AdminSession } from "./types";

// Client-side identity for the logged-in Admin (2026-09-17) — same shape/
// posture as src/lib/checker/checkerSession.ts and
// src/lib/resident/residentSession.ts (opaque id persisted in localStorage,
// never expires until explicit logout). Saved once after a successful
// Google login resolves to role ADMIN (src/app/page.tsx). Ft mutation API
// calls (src/lib/admin/ftApi.ts) send this id in a header so the server can
// independently re-check the caller's role from the database — the server
// never trusts a role string from the client, only this opaque id.
const STORAGE_KEY = "rmu-admin-session";

export function getAdminSession(): AdminSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
