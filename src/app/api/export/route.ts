import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildMeterBillingWorkbook } from "@/lib/export/excel";
import { buildExportFilename } from "@/lib/export/filename";
import { mapReadingToRow } from "@/lib/export/mapReadingToRow";
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

  const rows = readings.map((reading, index) => mapReadingToRow(reading, index + 1));
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
