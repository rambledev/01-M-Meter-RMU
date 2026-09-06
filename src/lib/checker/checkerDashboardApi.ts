import {
  getCachedDashboard,
  saveCachedDashboard,
} from "@/lib/offline/checkerDashboardRepository";
import type { CheckerDashboard } from "./types";

async function fetchDashboardFromServer(userId: string, month: string): Promise<CheckerDashboard> {
  const res = await fetch(
    `/api/checker/dashboard?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}`,
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดข้อมูลแดชบอร์ดไม่สำเร็จ");
  }
  return body.data as CheckerDashboard;
}

// Same network-first-with-offline-cache-fallback shape as fetchMeters()/
// fetchBillingConfig() — a checker out in the field with no signal must
// still be able to open their own landing page and see their meter list
// (even if the "จดแล้ว/ยังไม่จด" flags are only as fresh as the last
// successful fetch). Only throws if this device has never fetched
// successfully for this user before.
export async function fetchCheckerDashboard(
  userId: string,
  month: string,
): Promise<CheckerDashboard> {
  try {
    const dashboard = await fetchDashboardFromServer(userId, month);
    await saveCachedDashboard(userId, month, dashboard);
    return dashboard;
  } catch (err) {
    const cached = await getCachedDashboard(userId);
    if (cached) return cached;
    throw err instanceof Error ? err : new Error("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ");
  }
}
