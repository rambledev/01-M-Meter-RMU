// Tracks whether recent live-OCR reads have settled — requirement: value
// identical N reads in a row AND each of those reads at a stricter
// confidence bar than the one used just to preview a candidate (see
// ocrValidation.ts). Pure logic, no timers/DOM, so it's unit-testable
// directly — the timing/polling lives in useLiveOcr.ts.
//
// Both thresholds are Field Calibration values — see
// lib/calibration/config.ts (single source of truth, revised against
// docs/meter-calibration.md's real-device results).

import { DEFAULT_CALIBRATION_CONFIG } from "@/lib/calibration/config";

export interface OcrSample {
  value: string;
  confidence: number; // 0-1
}

export type StabilityStatus = "insufficient" | "unstable" | "stable";

export function evaluateStability(
  samples: OcrSample[],
  requiredMatches: number = DEFAULT_CALIBRATION_CONFIG.ocr.stabilityCount,
): StabilityStatus {
  if (samples.length < requiredMatches) return "insufficient";

  const recent = samples.slice(-requiredMatches);
  const sameValue = recent.every((sample) => sample.value === recent[0].value);
  const highConfidence = recent.every(
    (sample) => sample.confidence >= DEFAULT_CALIBRATION_CONFIG.ocr.stableConfidence,
  );
  return sameValue && highConfidence ? "stable" : "unstable";
}
