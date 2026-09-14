// ============================================================================
// DEVELOPMENT-ONLY. NOT PERSISTED. NOT APPLICATION STATE.
// ============================================================================
// This module is a Field Calibration debugging aid, nothing more:
//   - "Development-only": every call to recordOcrMetric() in useLiveOcr.ts
//     is wrapped in `if (process.env.NODE_ENV === "development")` — this
//     module never records anything in a production build.
//   - "Not persisted": `entries` below is a plain in-process array. It is
//     never written to localStorage, IndexedDB, cookies, or any server —
//     it lives only in this tab's JS heap and is gone on reload/navigation.
//   - "Not application state": nothing in the reading workflow
//     (readingWorkflow.ts, saveOfflineReading(), billing, duplicate
//     checking) reads from this module, directly or indirectly. It exists
//     solely so MeterOcrDebugPanel.tsx can show a tester real
//     accuracy/timing numbers while calibrating thresholds
//     (lib/calibration/config.ts) against real meters — see
//     docs/meter-calibration.md.
// ============================================================================

import type { LiveOcrStatus } from "./useLiveOcr";

export interface OcrMetricEntry {
  timestamp: number;
  mode: "camera" | "upload";
  value: string;
  confidence: number;
  duration: number; // ms, crop+preprocess+recognize wall time
  status: LiveOcrStatus;
}

const MAX_ENTRIES = 200;
let entries: OcrMetricEntry[] = [];

export function recordOcrMetric(entry: OcrMetricEntry): void {
  entries = [...entries, entry].slice(-MAX_ENTRIES);
}

export function getOcrMetrics(): readonly OcrMetricEntry[] {
  return entries;
}

export function clearOcrMetrics(): void {
  entries = [];
}

export interface OcrMetricsSummary {
  count: number;
  averageConfidence: number;
  averageDurationMs: number;
  stableRate: number; // fraction of entries with status "stable"
}

export function summarizeOcrMetrics(
  recent: readonly OcrMetricEntry[] = entries,
): OcrMetricsSummary {
  if (recent.length === 0) {
    return { count: 0, averageConfidence: 0, averageDurationMs: 0, stableRate: 0 };
  }
  const count = recent.length;
  const averageConfidence =
    recent.reduce((sum, e) => sum + e.confidence, 0) / count;
  const averageDurationMs = recent.reduce((sum, e) => sum + e.duration, 0) / count;
  const stableRate = recent.filter((e) => e.status === "stable").length / count;
  return { count, averageConfidence, averageDurationMs, stableRate };
}
