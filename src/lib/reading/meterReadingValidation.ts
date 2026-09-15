// Manual Meter Reading-first validation (2026-09-15 redesign of
// checker/reading/page.tsx): the checker's typed/pasted value is the
// SOURCE OF TRUTH. Nothing here ever rewrites, trims, or strips characters
// from what the user entered — every function below only classifies the
// raw input as valid/invalid and returns a message; the caller (page.tsx)
// keeps the raw string in state exactly as typed, always.
//
// Usage is DERIVED (calculateUsage() from readingMonth.ts, reused as-is —
// not reimplemented here) — there is exactly one place that computes it.

import { calculateUsage } from "./readingMonth";
import { DEFAULT_CALIBRATION_CONFIG } from "@/lib/calibration/config";

export type ValidationSeverity = "idle" | "success" | "warning" | "error";

// Digits with an optional single decimal point (e.g. "23188", "231.88",
// "001234.5") — confirmed against real schema/data, not assumed: Prisma's
// Reading.previousReading/confirmedValue/usage are all `Decimal?` (see
// docs/decision-log.md, "Decimal Meter Decision"), so integer-only would
// have silently blocked legitimate fractional-dial meters. Anything else —
// letters, comma, minus, space anywhere (including leading/trailing),
// multiple dots, a bare leading/trailing dot — fails this pattern and is
// rejected outright. Never partially accepted, never auto-corrected.
const READING_FORMAT_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

export function validateReadingFormat(
  raw: string,
): { valid: true; value: number } | { valid: false; error: string } {
  if (!READING_FORMAT_PATTERN.test(raw)) {
    return { valid: false, error: "กรุณากรอกตัวเลขและจุดทศนิยมให้ถูกต้อง" };
  }
  return { valid: true, value: Number(raw) };
}

// KNOWN GAP (intentional, per explicit instruction — do not "fix" this
// without a separate task): there is no meter-rollover / meter-replacement
// override anywhere in this system. A meter physically replaced with a new
// one that legitimately reads lower than the old meter's last reading has
// no path to be saved through this app at all — Admin's reading history
// (`/api/admin/readings`) is read-only, there is no edit endpoint. This is
// a hard, unconditional block by design for this phase; a future task
// would need to add an Admin override or a "report an issue" path instead
// of silently loosening this check.
export function validateAgainstPrevious(
  current: number,
  previous?: number,
): { error?: string } {
  if (previous !== undefined && current < previous) {
    return {
      error: "ค่ามิเตอร์ปัจจุบันน้อยกว่าค่าครั้งก่อน กรุณาตรวจสอบค่ามิเตอร์อีกครั้ง",
    };
  }
  return {};
}

// WARNING only — never escalates to an error, never blocks save on its
// own (see evaluateReading()). Thresholds live in lib/calibration/config.ts
// (not hardcoded here) so they can be recalibrated the same way OCR/camera
// thresholds are, per docs/meter-calibration.md's process. Skips the check
// entirely (no warning at all) when there isn't enough history — never
// invents a warning from insufficient data.
export function detectUsageAnomaly(
  usage: number,
  historicalUsages: number[],
  multiplier: number = DEFAULT_CALIBRATION_CONFIG.reading.usageAnomalyMultiplier,
  minHistory: number = DEFAULT_CALIBRATION_CONFIG.reading.minHistoryForAnomalyCheck,
): { warning?: string } {
  if (historicalUsages.length < minHistory) return {};
  const average =
    historicalUsages.reduce((sum, u) => sum + u, 0) / historicalUsages.length;
  if (average > 0 && usage > average * multiplier) {
    return {
      warning: "การใช้ไฟสูงกว่าค่าเฉลี่ยที่ผ่านมาอย่างมาก กรุณาตรวจสอบค่ามิเตอร์อีกครั้ง",
    };
  }
  return {};
}

export interface ReadingEvaluation {
  status: ValidationSeverity;
  formatError?: string;
  previousReadingError?: string;
  warnings: string[];
  value?: number; // parsed numeric value — only present once the format is valid
  usage?: number; // derived via calculateUsage() — only present once format+previous both pass
}

// Single entry point combining the three checks above into one status the
// UI drives off of (per explicit instruction: status must not be scattered
// ad-hoc strings across components). "idle" means the field is genuinely
// empty (untouched) — anything the user actually typed, including
// whitespace-only, goes through format validation and can be "error".
export function evaluateReading(input: {
  rawInput: string;
  previousReading?: number;
  historicalUsages: number[];
}): ReadingEvaluation {
  const { rawInput, previousReading, historicalUsages } = input;

  if (rawInput.length === 0) {
    return { status: "idle", warnings: [] };
  }

  const format = validateReadingFormat(rawInput);
  if (!format.valid) {
    return { status: "error", formatError: format.error, warnings: [] };
  }

  const previousCheck = validateAgainstPrevious(format.value, previousReading);
  if (previousCheck.error) {
    return {
      status: "error",
      previousReadingError: previousCheck.error,
      value: format.value,
      warnings: [],
    };
  }

  const usage = calculateUsage(format.value, previousReading);
  const warnings: string[] = [];
  if (usage !== undefined) {
    const anomaly = detectUsageAnomaly(usage, historicalUsages);
    if (anomaly.warning) warnings.push(anomaly.warning);
  }

  return {
    status: warnings.length > 0 ? "warning" : "success",
    value: format.value,
    usage,
    warnings,
  };
}
