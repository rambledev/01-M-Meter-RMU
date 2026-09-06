import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import { parseMonthParam } from "@/lib/export/monthParam";
import type { MissingReadingDTO } from "@/lib/admin/types";

// GET /api/admin/readings/missing?month=YYYY-MM — every Meter that has NO
// Reading for that month (data-model.md §3.1: readingMonth is always the
// 1st of the month, UTC). Answers "which rooms still haven't been read this
// round?" — a Meter is 1:1 with a Room in practice, so this doubles as the
// room-level answer the admin UI asks for.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const readingMonth = month ? parseMonthParam(month) : null;
  if (!month || !readingMonth) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุเดือนให้ถูกต้อง (YYYY-MM)");
  }

  const meters = await prisma.meter.findMany({
    where: { readings: { none: { readingMonth } } },
    include: { room: { include: { zone: true } } },
    orderBy: { code: "asc" },
  });

  const data: MissingReadingDTO[] = meters.map((m) => ({
    meterId: m.id,
    meterCode: m.code,
    roomName: m.room.name,
    zoneName: m.room.zone.name,
  }));

  return NextResponse.json({ ok: true, data });
}
