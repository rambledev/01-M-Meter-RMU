import type { ExecutiveSummary } from "./types";

export async function fetchExecutiveSummary(zoneId?: string): Promise<ExecutiveSummary> {
  const query = zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : "";
  const res = await fetch(`/api/executive/summary${query}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดข้อมูลรายงานไม่สำเร็จ");
  }
  return body.data as ExecutiveSummary;
}
