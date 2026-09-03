import { NextResponse } from "next/server";
import { DEFAULT_BILLING_CONFIG } from "@/lib/billing/defaultConfig";
import { prisma } from "@/lib/db/prisma";
import { buildMeterBillingWorkbook } from "@/lib/export/excel";
import { buildExportFilename } from "@/lib/export/filename";
import { mapReadingToRow } from "@/lib/export/mapReadingToRow";
import { parseBillingConfigParam } from "@/lib/export/parseBillingConfigParam";
import { parseMonthParam } from "@/lib/export/monthParam";
import { formatMonthThai } from "@/lib/reading/readingMonth";

// GET /api/export?month=YYYY-MM — MVP Excel export (Phase 6). Reads from
// PostgreSQL only (never IndexedDB — this is a server route). No fake data
// is ever generated: an empty result returns a JSON "no data" response
// instead of an empty/fabricated workbook (Phase 6 spec item 8).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  const readingMonth = month ? parseMonthParam(month) : null;
  if (!month || !readingMonth) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", message: "กรุณาระบุเดือนให้ถูกต้อง (YYYY-MM)" },
      { status: 400 },
    );
  }

  const readings = await prisma.reading.findMany({
    where: { readingMonth },
    include: {
      meter: { include: { room: { include: { zone: true } } } },
      recorder: true,
    },
    orderBy: { meterId: "asc" },
  });

  if (readings.length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_DATA", message: "ไม่พบข้อมูลการอ่านมิเตอร์สำหรับเดือนนี้" },
      { status: 404 },
    );
  }

  // Phase 6B: the client sends its current billing config (possibly edited
  // via Settings) so this route uses the exact same rates the user just saw
  // on screen. Missing/malformed -> fall back to the default config; still
  // the same calculateBilling() call either way, never a second formula.
  const billingConfig =
    parseBillingConfigParam(searchParams.get("config")) ?? DEFAULT_BILLING_CONFIG;

  const rows = readings.map((reading, index) =>
    mapReadingToRow(reading, index + 1, billingConfig),
  );
  const buffer = await buildMeterBillingWorkbook({
    monthLabel: formatMonthThai(month),
    rows,
  });

  const filename = buildExportFilename(month);
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
