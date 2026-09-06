import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { AdminDashboardSummary } from "@/lib/admin/types";

// readingMonth is always normalized to the 1st of the month, UTC (data-model.md §5).
function currentMonthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function GET() {
  const [
    zoneCount,
    roomCount,
    meterCount,
    userCount,
    readingCount,
    readingCountThisMonth,
    syncErrorCount,
  ] = await Promise.all([
    prisma.zone.count(),
    prisma.room.count(),
    prisma.meter.count(),
    prisma.user.count(),
    prisma.reading.count(),
    prisma.reading.count({ where: { readingMonth: currentMonthStartUtc() } }),
    prisma.reading.count({ where: { status: "SYNC_ERROR" } }),
  ]);

  const summary: AdminDashboardSummary = {
    zoneCount,
    roomCount,
    meterCount,
    userCount,
    readingCount,
    readingCountThisMonth,
    syncErrorCount,
  };

  return NextResponse.json({ ok: true, data: summary });
}
