import { getCachedMeters, saveCachedMeters } from "@/lib/offline/meterCacheRepository";
import type { MeterInfo } from "./types";

async function fetchMetersFromServer(): Promise<MeterInfo[]> {
  const res = await fetch("/api/meters");
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดรายชื่อมิเตอร์ไม่สำเร็จ");
  }
  return body.data as MeterInfo[];
}

// Live fetch first (so the list is fresh whenever there's a connection);
// on any failure (offline, server error), fall back to the last
// successfully-cached list so the reading workflow keeps working offline.
// Only throws if there is truly nothing to show (offline AND never
// fetched successfully before).
export async function fetchMeters(): Promise<MeterInfo[]> {
  try {
    const meters = await fetchMetersFromServer();
    await saveCachedMeters(meters);
    return meters;
  } catch (err) {
    const cached = await getCachedMeters();
    if (cached.length > 0) return cached;
    throw err instanceof Error ? err : new Error("โหลดรายชื่อมิเตอร์ไม่สำเร็จ");
  }
}
