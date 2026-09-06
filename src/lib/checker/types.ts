import type { MeterInfo } from "@/lib/meters/types";

// The logged-in checker (ผู้จดมิเตอร์) — persisted client-side in
// localStorage (src/lib/checker/checkerSession.ts) once logged in, never
// expires (2026-09-06: /checker's first real login, gating its new
// dashboard-first mobile layout).
export interface CheckerSession {
  id: string;
  name: string;
  zones: { id: string; name: string }[];
}

// One meter in the logged-in checker's dashboard — their own responsible
// zones' meters, each flagged with whether it already has a reading for
// the dashboard's selected month.
export interface CheckerDashboardMeter extends MeterInfo {
  readThisMonth: boolean;
}

export interface CheckerDashboard {
  zones: { id: string; name: string }[];
  meters: CheckerDashboardMeter[];
}
