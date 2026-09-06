import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { formatReadingPeriod } from "@/lib/admin/period";
import type { ReadingHistoryDTO } from "@/lib/admin/types";

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// ประวัติการจดมิเตอร์ (admin) — read-only, every Reading joined with its
// Meter/Room/Zone/recorder. No filtering server-side: the client filters
// this (small, demo-scale) list by zone/search (src/components/admin/
// ReadingHistoryManagement.tsx), same pattern as the Meter table.
export async function GET() {
  const readings = await prisma.reading.findMany({
    include: {
      meter: { include: { room: { include: { zone: true } } } },
      recorder: true,
    },
    orderBy: { readingMonth: "desc" },
  });

  const data: ReadingHistoryDTO[] = readings.map((r) => ({
    id: r.id,
    meterId: r.meterId,
    meterCode: r.meter.code,
    roomName: r.meter.room.name,
    zoneName: r.meter.room.zone.name,
    period: formatReadingPeriod(r.readingMonth),
    readingMonth: r.readingMonth.toISOString(),
    previousValue: toNumberOrNull(r.previousReading),
    currentValue: toNumberOrNull(r.confirmedValue),
    usage: toNumberOrNull(r.usage),
    status: r.status,
    recordedByName: r.recorder.name,
    recordedAt: r.recordedAt ? r.recordedAt.toISOString() : null,
  }));

  return NextResponse.json({ ok: true, data });
}
