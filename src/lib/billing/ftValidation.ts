import { parseMonthParam } from "@/lib/export/monthParam";

// Pure validation only — no DB/network here, mirrors the style of
// src/lib/billing/tierValidation.ts and src/lib/admin/validation.ts so it's
// unit-testable independently of the API routes that call it.

const MAX_FT_RATE = 999999.9999; // matches Decimal(10,4)'s max magnitude
const MAX_NOTES_LENGTH = 1000;

// "YYYY-MM" -> the Date used for FtRate.readingMonth (always the 1st of the
// month, @db.Date — same convention as Reading.readingMonth). Reuses the
// existing parser (src/lib/export/monthParam.ts) rather than a second
// "YYYY-MM" regex — one canonical parser for the whole app.
export function validateReadingMonthParam(month: unknown): Date | null {
  if (typeof month !== "string") return null;
  return parseMonthParam(month);
}

export function validateFtRateValue(value: unknown): number | null {
  // Required field — null/undefined/"" must be rejected, not silently
  // coerced to 0 by Number(null)/Number(undefined)'s own quirks.
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null; // ห้ามติดลบ
  if (n > MAX_FT_RATE) return null;
  return n;
}

// Empty/omitted notes is valid (optional field) — only reject the wrong
// type or something over the length limit, normalizing to null either way.
export function validateFtNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_NOTES_LENGTH) return null;
  return trimmed;
}

export function validateFtReason(value: unknown): string | null {
  return validateFtNotes(value);
}
