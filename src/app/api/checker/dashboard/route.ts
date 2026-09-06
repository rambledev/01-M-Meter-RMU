import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { prisma } from "@/lib/db/prisma";
import { parseMonthParam } from "@/lib/export/monthParam";

// A logged-in checker's own dashboard (2026-09-06): the meters within
// their responsibleZones (assigned by Admin), each flagged with whether it
// already has a reading for the requested month — the same "have I read
// this yet" question Admin's missing-readings panel answers, just scoped
// to one checker's own zones instead of the whole system.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const readingMonth = parseMonthParam(searchParams.get("month") ?? "");

  if (!userId) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบผู้ใช้งาน");
  }
  if (!readingMonth) {
    return apiError(400, "VALIDATION_ERROR", "รูปแบบเดือนไม่ถูกต้อง");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { responsibleZones: true },
  });
  if (!user) {
    return apiError(404, "NOT_FOUND", "ไม่พบผู้ใช้งาน");
  }

  const zoneIds = user.responsibleZones.map((z) => z.id);
  const meters =
    zoneIds.length === 0
      ? []
      : await prisma.meter.findMany({
          where: { room: { zoneId: { in: zoneIds } } },
          include: {
            room: { include: { zone: true } },
            readings: { where: { readingMonth }, select: { id: true } },
          },
          orderBy: { code: "asc" },
        });

  return NextResponse.json({
    ok: true,
    data: {
      zones: user.responsibleZones.map((z) => ({ id: z.id, name: z.name })),
      meters: meters.map((m) => ({
        id: m.id,
        code: m.code,
        roomId: m.roomId,
        roomName: m.room.name,
        zoneId: m.room.zoneId,
        zoneName: m.room.zone.name,
        readThisMonth: m.readings.length > 0,
      })),
    },
  });
}
