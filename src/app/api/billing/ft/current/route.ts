import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { resolveFtForMonth } from "@/lib/billing/ftResolver";
import { parseMonthParam } from "@/lib/export/monthParam";

// GET /api/billing/ft/current?month=YYYY-MM — public read (2026-09-17),
// used by every client-side billing display (checker/reading, resident
// history detail, checker's local offline history) so each one resolves
// Ft for the SPECIFIC month it's showing, never "the current rate". Thin
// wrapper around src/lib/billing/ftResolver.ts — no calculation happens
// here, this route only exposes the resolver to the browser.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const readingMonth = month ? parseMonthParam(month) : null;
  if (!month || !readingMonth) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุเดือนให้ถูกต้อง (YYYY-MM)");
  }

  const resolution = await resolveFtForMonth(readingMonth);
  return NextResponse.json({ ok: true, data: resolution });
}
