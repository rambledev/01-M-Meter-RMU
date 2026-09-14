// Post-OCR sanity check (requirement §7 of the Meter ROI Guide refactor) —
// the OCR result is still only a prefill (page.tsx lets the user edit it
// regardless), this just decides whether to prefill at all or ask for a
// retake when the read is obviously unusable.
//
// The confidence bar is a Field Calibration threshold — see
// lib/calibration/config.ts (single source of truth, revised against
// docs/meter-calibration.md's real-device results). Digit-count bounds
// stay local: they're a format rule, not a hardware-tuned threshold.

import { DEFAULT_CALIBRATION_CONFIG } from "@/lib/calibration/config";

export interface OcrRecognitionResult {
  value: string;
  confidence: number; // 0-1
}

export interface OcrValidationResult {
  valid: boolean;
  reason?: string;
}

// Digits with an optional decimal point — meter displays here include
// fractional dials (e.g. "001234.5"), so this stays looser than a strict
// 5-digit integer format.
const VALUE_PATTERN = /^[0-9]+(\.[0-9]+)?$/;
const MIN_DIGITS = 4;
const MAX_DIGITS = 6;

export function validateOcrResult(result: OcrRecognitionResult): OcrValidationResult {
  const digitCount = result.value.replace(".", "").length;

  if (!VALUE_PATTERN.test(result.value)) {
    return { valid: false, reason: "ไม่ใช่ตัวเลข" };
  }
  if (digitCount < MIN_DIGITS || digitCount > MAX_DIGITS) {
    return { valid: false, reason: "จำนวนหลักไม่สมเหตุสมผล" };
  }
  if (result.confidence < DEFAULT_CALIBRATION_CONFIG.ocr.previewConfidence) {
    return { valid: false, reason: "ความเชื่อมั่นต่ำเกินไป" };
  }
  return { valid: true };
}
