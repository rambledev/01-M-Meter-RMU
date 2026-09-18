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
