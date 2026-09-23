import type { FtRateDTO } from "@/lib/admin/types";

// Public (non-admin) client-side lookup of the resolved Ft rate for one
// specific month — GET /api/billing/ft/current. Used everywhere a bill is
// displayed client-side so it resolves Ft for THAT reading's own month,
// never "the current rate" (2026-09-17). Any failure (network error,
// non-2xx, malformed body) resolves to `null` — the same "not configured"
// signal as a genuine FT_NOT_CONFIGURED result, so callers never silently
// compute a bill with a guessed rate.
export async function fetchFtForMonth(monthValue: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/billing/ft/current?month=${encodeURIComponent(monthValue)}`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) return null;
    const data = body.data as { found: boolean; ftRate?: number };
    return data.found && typeof data.ftRate === "number" ? data.ftRate : null;
  } catch {
    return null;
  }
}

// Public lookup of recent Ft rate announcements (months with an uploaded
// document) — GET /api/billing/ft/announcements, for the "ประกาศปรับค่า
// Ft" section on /resident and the home login page (2026-09-23). This is
// supplementary info, not billing-critical, so any failure resolves to an
// empty list rather than throwing — the section just renders nothing.
export async function fetchFtAnnouncements(): Promise<FtRateDTO[]> {
  try {
    const res = await fetch("/api/billing/ft/announcements");
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) return [];
    return Array.isArray(body.data) ? (body.data as FtRateDTO[]) : [];
  } catch {
    return [];
  }
}
