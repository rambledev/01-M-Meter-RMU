export interface ZoneOption {
  id: string;
  name: string;
}

// Public zone directory — GET /api/zones (2026-09-18). Used by the
// self-service signup flow on "/" so a new METER_READER can pick their
// responsible zone(s) before the account exists — a separate, unauthenticated
// endpoint from src/lib/admin/adminApi.ts's listZones() (GET /api/admin/zones).
export async function fetchZoneOptions(): Promise<ZoneOption[]> {
  const res = await fetch("/api/zones");
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดรายชื่อโซนไม่สำเร็จ");
  }
  return body.data as ZoneOption[];
}
