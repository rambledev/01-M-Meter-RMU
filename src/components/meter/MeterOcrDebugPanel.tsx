"use client";

import { useEffect, useState } from "react";
import { getOcrMetrics, summarizeOcrMetrics } from "@/lib/ocr/ocrMetrics";
import type { OcrDebugSnapshot } from "@/lib/ocr/useLiveOcr";

interface MeterOcrDebugPanelProps {
  snapshot: OcrDebugSnapshot | null;
}

// Development-only Field Calibration tool — the caller
// (checker/reading/page.tsx) only renders this behind
// `process.env.NODE_ENV === "development"`, so it never ships to
// production. Shows the actual frames the OCR pipeline just processed
// side by side with timing/confidence, plus a rolling summary of
// ocrMetrics.ts, so a tester can tune thresholds (meterPreprocess.ts
// options, ocrValidation.ts/ocrStability.ts confidence bars) against a
// real meter in the field.
export default function MeterOcrDebugPanel({ snapshot }: MeterOcrDebugPanelProps) {
  const [, forceTick] = useState(0);

  // ocrMetrics.ts is a plain in-memory module, not React state — poll to
  // pick up new entries recorded by useLiveOcr ticks elsewhere on the page.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const summary = summarizeOcrMetrics();
  const recent = [...getOcrMetrics()].slice(-5).reverse();

  return (
    <details
      open
      className="rounded-xl border border-dashed border-zinc-400 bg-zinc-50 p-3 text-xs dark:border-zinc-600 dark:bg-zinc-900"
    >
      <summary className="cursor-pointer select-none font-semibold text-zinc-700 dark:text-zinc-300">
        🛠 OCR Debug Panel (dev only)
      </summary>

      {!snapshot ? (
        <p className="mt-2 text-zinc-500">ยังไม่มีข้อมูล — รอ live OCR รอบแรก</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <DebugImage label="Original" url={snapshot.originalUrl} />
            <DebugImage label="ROI (crop)" url={snapshot.roiUrl} />
            <DebugImage label="Preprocessed" url={snapshot.preprocessedUrl} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <DebugStat label="Mode" value={snapshot.mode} />
            <DebugStat label="Value" value={snapshot.value || "-"} />
            <DebugStat label="Confidence" value={`${Math.round(snapshot.confidence * 100)}%`} />
            <DebugStat label="Duration" value={`${Math.round(snapshot.durationMs)} ms`} />
            <DebugStat label="Status" value={snapshot.status} />
            <DebugStat
              label="ROI"
              value={`x:${snapshot.roi.x.toFixed(2)} y:${snapshot.roi.y.toFixed(2)} w:${snapshot.roi.width.toFixed(2)} h:${snapshot.roi.height.toFixed(2)}`}
            />
          </dl>
        </div>
      )}

      <div className="mt-3 border-t border-zinc-300 pt-2 dark:border-zinc-700">
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
          Metrics (runtime memory, {summary.count} รายการ)
        </p>
        {summary.count > 0 && (
          <>
            <p className="text-zinc-500">
              avg confidence {Math.round(summary.averageConfidence * 100)}% · avg
              duration {Math.round(summary.averageDurationMs)} ms · stable rate{" "}
              {Math.round(summary.stableRate * 100)}%
            </p>
            <table className="mt-1 w-full text-left">
              <thead className="text-zinc-500">
                <tr>
                  <th className="pr-2 font-normal">mode</th>
                  <th className="pr-2 font-normal">value</th>
                  <th className="pr-2 font-normal">conf</th>
                  <th className="pr-2 font-normal">ms</th>
                  <th className="font-normal">status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((entry) => (
                  <tr key={entry.timestamp}>
                    <td className="pr-2">{entry.mode}</td>
                    <td className="pr-2">{entry.value || "-"}</td>
                    <td className="pr-2">{Math.round(entry.confidence * 100)}%</td>
                    <td className="pr-2">{Math.round(entry.duration)}</td>
                    <td>{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </details>
  );
}

function DebugImage({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-zinc-500">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="w-full rounded border border-zinc-300 dark:border-zinc-700"
      />
    </div>
  );
}

function DebugStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-800 dark:text-zinc-200">{value}</dd>
    </div>
  );
}
