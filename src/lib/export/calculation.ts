// Calculation Service (export-format.md §3) — kept separate from Excel
// generation on purpose, so an unfinalized billing formula never has to
// touch layout/formatting code.
//
// The ONLY formula that is actually locked is:
//   usage = confirmedValue - previousReading
// Everything else (ค่าไฟพื้นฐาน / ค่า FT / ภาษี / รวมทั้งสิ้น) has NO real
// formula yet (requirement.md §5 ข้อ 1, export-format.md §4) — this service
// must never guess one. calculateBilling() always returns nulls; the Excel
// layer renders those as "-" so nobody mistakes a placeholder for a real bill.

import { calculateUsage as calculateUsageShared } from "@/lib/reading/readingMonth";

// Thin null-friendly wrapper around the single shared implementation of the
// locked formula — the reading workflow (client) and this export service
// (server) both call the same formula, never two copies of it.
export function calculateUsage(
  confirmedValue: number,
  previousReading: number | null,
): number | null {
  const usage = calculateUsageShared(confirmedValue, previousReading ?? undefined);
  return usage ?? null;
}

export interface BillingCalculation {
  baseCharge: number | null; // ค่าไฟพื้นฐาน
  ftCharge: number | null; // ค่า FT
  tax: number | null; // ภาษี
  total: number | null; // รวมทั้งสิ้น
}

// Stub for future billing rates — do not implement a real formula here
// until requirement.md §5 ข้อ 1 is resolved (see export-format.md §4/§6).
export function calculateBilling(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept to document the future signature
  _usage: number | null,
): BillingCalculation {
  return { baseCharge: null, ftCharge: null, tax: null, total: null };
}
