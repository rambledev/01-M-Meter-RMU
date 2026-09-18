import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { getOrSeedBillingConfig } from "@/lib/billing/billingConfigServer";
import { resolveFtForMonth } from "@/lib/billing/ftResolver";
import { prisma } from "@/lib/db/prisma";
import { calculateBilling } from "@/lib/export/calculation";
import { formatReadingPeriod } from "@/lib/admin/period";
import type { ResidentHistoryDTO } from "@/lib/resident/types";
import { toMonthValue } from "@/lib/reading/readingMonth";

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// A logged-in resident's own reading history + bill amounts (2026-09-09) —
// strictly scoped to their own residentRoomId only, never any other room's
// data. Returns every month on record for their room's meter(s) (usually
// exactly one meter per room) — the client picks/filters by month itself,
// same "fetch once, filter client-side" pattern as the admin/checker
// history views (the data volume per single room is always small).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบผู้ใช้งาน");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { residentRoom: { include: { zone: { select: { name: true } } } } },
  });
  if (!user) {
    return apiError(404, "NOT_FOUND", "ไม่พบผู้ใช้งาน");
  }

  if (!user.residentRoom) {
    const data: ResidentHistoryDTO = { room: null, readings: [] };
    return NextResponse.json({ ok: true, data });
  }

  const [meters, config] = await Promise.all([
    prisma.meter.findMany({ where: { roomId: user.residentRoom.id } }),
    getOrSeedBillingConfig(),
  ]);
  const meterIds = meters.map((m) => m.id);

  const readings =
    meterIds.length === 0
      ? []
      : await prisma.reading.findMany({
          where: { meterId: { in: meterIds } },
          orderBy: { readingMonth: "desc" },
        });

  // Each reading resolves Ft for ITS OWN readingMonth (2026-09-17) — never
  // "the current rate" applied retroactively to every past month.
  const ftResolutions = await Promise.all(
    readings.map((r) => resolveFtForMonth(r.readingMonth)),
  );

  const data: ResidentHistoryDTO = {
    room: {
      id: user.residentRoom.id,
      name: user.residentRoom.name,
      zoneName: user.residentRoom.zone.name,
    },
    readings: readings.map((r, index) => {
      const confirmedValue = toNumberOrNull(r.confirmedValue);
      const previousValue = toNumberOrNull(r.previousReading);
      const ftResolution = ftResolutions[index];
      const resolvedFtRate = ftResolution.found ? ftResolution.ftRate : null;
      const billing = calculateBilling(confirmedValue, previousValue, config, resolvedFtRate);
      const meterCode = meters.find((m) => m.id === r.meterId)?.code ?? "";
      return {
        id: r.id,
        meterCode,
        period: formatReadingPeriod(r.readingMonth),
        readingMonth: toMonthValue(r.readingMonth.toISOString()),
        previousValue,
        currentValue: confirmedValue,
        usage: toNumberOrNull(r.usage),
        status: r.status,
        billing: {
          baseCharge: billing.baseCharge,
          ft: billing.ft,
          tax: billing.tax,
          total: billing.total,
        },
      };
    }),
  };

  return NextResponse.json({ ok: true, data });
}
