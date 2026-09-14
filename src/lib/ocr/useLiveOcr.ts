"use client";

// Real-time OCR "suggestion" loop shared by Camera Mode (live video frames)
// and Upload Image Mode (a static image + an adjustable ROI). This is a
// SUGGESTION ONLY — it only ever calls setState here; the caller
// (checker/reading/page.tsx) still requires an explicit confirm before any
// value reaches saveOfflineReading(). Every crop/preprocessed frame is
// discarded immediately after recognize() resolves — nothing from this
// loop is persisted, in development or production.
//
// Two-tier confidence policy (thresholds live in lib/calibration/config.ts):
//   - "preview" (ocrValidation.ts) gates whether a read is even shown as a
//     candidate at all.
//   - "stable" (ocrStability.ts) additionally requires the last N
//     preview-eligible reads to agree, each above a stricter confidence
//     bar, before the badge shows ✓.
//
// Field Calibration additions (development only, gated by NODE_ENV):
// timing + a debug snapshot (original/ROI/preprocessed frames as object
// URLs, for MeterOcrDebugPanel.tsx) and an in-memory metrics recording
// (ocrMetrics.ts) — none of this runs, logs, or allocates in production.

import { useEffect, useRef, useState } from "react";
import { DEFAULT_CALIBRATION_CONFIG } from "@/lib/calibration/config";
import { cropToRegion } from "@/lib/image/meterCrop";
import { preprocessForOcr } from "@/lib/image/meterPreprocess";
import { recordOcrMetric } from "./ocrMetrics";
import { recognizeMeterValue } from "./ocrProvider";
import type { OcrRegion } from "./ocrRegion";
import { evaluateStability, type OcrSample } from "./ocrStability";
import { validateOcrResult } from "./ocrValidation";

export type LiveOcrStatus = "reading" | "unstable" | "stable";

export interface LiveOcrState {
  status: LiveOcrStatus;
  value: string;
  confidence: number;
}

export interface OcrDebugSnapshot {
  timestamp: number;
  mode: "camera" | "upload";
  roi: OcrRegion;
  originalUrl: string;
  roiUrl: string;
  preprocessedUrl: string;
  value: string;
  confidence: number;
  durationMs: number;
  status: LiveOcrStatus;
}

export interface UseLiveOcrResult {
  state: LiveOcrState;
  debug: OcrDebugSnapshot | null; // always null outside development
}

export interface UseLiveOcrOptions {
  intervalMs?: number;
  enabled: boolean;
  mode: "camera" | "upload";
}

const IDLE_STATE: LiveOcrState = { status: "reading", value: "", confidence: 0 };

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

interface DebugUrls {
  originalUrl: string;
  roiUrl: string;
  preprocessedUrl: string;
}

function revokeDebugUrls(urls: DebugUrls | null) {
  if (!urls) return;
  URL.revokeObjectURL(urls.originalUrl);
  URL.revokeObjectURL(urls.roiUrl);
  URL.revokeObjectURL(urls.preprocessedUrl);
}

export function useLiveOcr(
  captureFrame: () => Blob | null | Promise<Blob | null>,
  region: OcrRegion,
  options: UseLiveOcrOptions,
): UseLiveOcrResult {
  const {
    intervalMs = DEFAULT_CALIBRATION_CONFIG.ocr.liveIntervalMs,
    enabled,
    mode,
  } = options;
  const [state, setState] = useState<LiveOcrState>(IDLE_STATE);
  const [debug, setDebug] = useState<OcrDebugSnapshot | null>(null);

  const bufferRef = useRef<OcrSample[]>([]);
  const busyRef = useRef(false);
  const captureFrameRef = useRef(captureFrame);
  const regionRef = useRef(region);
  const lastDebugUrlsRef = useRef<DebugUrls | null>(null);

  // Keep the refs pointed at the latest values without re-running the
  // polling effect below on every render (refs may only be written from an
  // effect/event handler, never during render itself).
  useEffect(() => {
    captureFrameRef.current = captureFrame;
    regionRef.current = region;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    bufferRef.current = [];

    async function tick() {
      if (busyRef.current || cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      busyRef.current = true;
      const startedAt = now();
      try {
        const frame = await captureFrameRef.current();
        if (!frame || cancelled) return;

        const cropped = await cropToRegion(frame, regionRef.current);
        const preprocessed = await preprocessForOcr(cropped);
        const result = await recognizeMeterValue(preprocessed);
        if (cancelled) return;
        const durationMs = now() - startedAt;

        const preview = validateOcrResult(result);
        let nextState: LiveOcrState;
        if (!preview.valid) {
          bufferRef.current = [];
          nextState = IDLE_STATE;
        } else {
          bufferRef.current = [...bufferRef.current, result].slice(-3);
          const stability = evaluateStability(bufferRef.current);
          nextState = {
            status: stability === "stable" ? "stable" : "unstable",
            value: result.value,
            confidence: result.confidence,
          };
        }
        setState(nextState);

        if (process.env.NODE_ENV === "development") {
          console.group(`[useLiveOcr][tick] mode=${mode}`);
          console.log({
            timestamp: Date.now(),
            mode,
            roi: regionRef.current,
            value: result.value,
            confidence: result.confidence,
            durationMs,
            status: nextState.status,
          });
          console.groupEnd();

          recordOcrMetric({
            timestamp: Date.now(),
            mode,
            value: result.value,
            confidence: result.confidence,
            duration: durationMs,
            status: nextState.status,
          });

          revokeDebugUrls(lastDebugUrlsRef.current);
          const urls: DebugUrls = {
            originalUrl: URL.createObjectURL(frame),
            roiUrl: URL.createObjectURL(cropped),
            preprocessedUrl: URL.createObjectURL(preprocessed),
          };
          lastDebugUrlsRef.current = urls;
          setDebug({
            timestamp: Date.now(),
            mode,
            roi: regionRef.current,
            ...urls,
            value: result.value,
            confidence: result.confidence,
            durationMs,
            status: nextState.status,
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[useLiveOcr][tick] ERROR", { error: err, mode });
        }
      } finally {
        busyRef.current = false;
      }
    }

    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      revokeDebugUrls(lastDebugUrlsRef.current);
      lastDebugUrlsRef.current = null;
    };
  }, [enabled, intervalMs, mode]);

  return {
    state: enabled ? state : IDLE_STATE,
    debug: enabled ? debug : null,
  };
}
