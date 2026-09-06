import { NextResponse } from "next/server";
import { formatReadingPeriod } from "@/lib/admin/period";
import { getOrSeedBillingConfig } from "@/lib/billing/billingConfigServer";
import { prisma } from "@/lib/db/prisma";
import { calculateBilling } from "@/lib/export/calculation";
import type {
  ExecutiveSummary,
  MonthlyTrendPoint,
  StatusBreakdown,
  ZoneBreakdown,
} from "@/lib/executive/types";
import { currentMonthValue } from "@/lib/reading/readingMonth";

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ผู้บริหาร (Executive role) reporting dashboard (2026-09-06): read-only,
// system-wide summary/trends/zone comparison — no auth gate, same as
// Admin's own dashboard (no real login concept for this role either).
// Optional ?zoneId= scopes every KPI/chart except the zone-comparison bars
// (whose whole purpose is comparing zones — filtering it to one zone would
// defeat the point, so it just narrows to that one entry instead).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get("zoneId") || undefined;

  const [zones, config] = await Promise.all([
    prisma.zone.findMany({ orderBy: { name: "asc" } }),
    getOrSeedBillingConfig(),
  ]);

  const roomWhere = zoneId ? { zoneId } : undefined;
  const meterWhere = zoneId ? { room: { zoneId } } : undefined;
  const readingZoneWhere = zoneId ? { meter: { room: { zoneId } } } : undefined;

  const [roomCount, meters, readings, statusGroups] = await Promise.all([
    prisma.room.count({ where: roomWhere }),
    prisma.meter.findMany({
      where: meterWhere,
      include: { room: { include: { zone: true } } },
    }),
    prisma.reading.findMany({
      where: { confirmedValue: { not: null }, ...readingZoneWhere },
      select: {
        readingMonth: true,
        usage: true,
        confirmedValue: true,
        previousReading: true,
        meter: { select: { room: { select: { zoneId: true, zone: { select: { name: true } } } } } },
      },
    }),
    prisma.reading.groupBy({
      by: ["status"],
      where: readingZoneWhere,
      _count: { _all: true },
    }),
  ]);

  // Each reading's billing total, computed once via the current config —
  // no separate formula, same Calculation Service every other page uses.
  const readingBilling = readings.map((r) => {
    const usage = toNumberOrNull(r.usage) ?? 0;
    const billing =
      calculateBilling(toNumberOrNull(r.confirmedValue), toNumberOrNull(r.previousReading), config)
        .total ?? 0;
    return { readingMonth: r.readingMonth, zoneId: r.meter.room.zoneId, usage, billing };
  });

  // Monthly trend — system-wide (within the zone filter), one point per
  // calendar month that actually has at least one reading.
  const monthMap = new Map<
    string,
    { readingCount: number; totalUsage: number; totalBilling: number }
  >();
  for (const r of readingBilling) {
    const monthKey = r.readingMonth.toISOString().slice(0, 7);
    const entry = monthMap.get(monthKey) ?? { readingCount: 0, totalUsage: 0, totalBilling: 0 };
    entry.readingCount += 1;
    entry.totalUsage += r.usage;
    entry.totalBilling += r.billing;
    monthMap.set(monthKey, entry);
  }
  const monthlyTrend: MonthlyTrendPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, v]) => ({
      month: monthKey,
      periodLabel: formatReadingPeriod(new Date(`${monthKey}-01T00:00:00.000Z`)),
      readingCount: v.readingCount,
      totalUsage: round2(v.totalUsage),
      totalBilling: round2(v.totalBilling),
    }));

  // Zone comparison — all-time totals per zone (narrowed to just the
  // selected zone when a filter is active).
  const zoneMeterCounts = new Map<string, number>();
  for (const m of meters) {
    zoneMeterCounts.set(m.room.zoneId, (zoneMeterCounts.get(m.room.zoneId) ?? 0) + 1);
  }
  const zoneAgg = new Map<string, { readingCount: number; totalUsage: number; totalBilling: number }>();
  for (const r of readingBilling) {
    const entry = zoneAgg.get(r.zoneId) ?? { readingCount: 0, totalUsage: 0, totalBilling: 0 };
    entry.readingCount += 1;
    entry.totalUsage += r.usage;
    entry.totalBilling += r.billing;
    zoneAgg.set(r.zoneId, entry);
  }
  const zoneBreakdown: ZoneBreakdown[] = zones
    .filter((z) => !zoneId || z.id === zoneId)
    .map((z) => {
      const agg = zoneAgg.get(z.id) ?? { readingCount: 0, totalUsage: 0, totalBilling: 0 };
      return {
        zoneId: z.id,
        zoneName: z.name,
        meterCount: zoneMeterCounts.get(z.id) ?? 0,
        readingCount: agg.readingCount,
        totalUsage: round2(agg.totalUsage),
        totalBilling: round2(agg.totalBilling),
      };
    });

  const statusBreakdown: StatusBreakdown[] = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));

  const totalUsage = round2(readingBilling.reduce((sum, r) => sum + r.usage, 0));
  const totalBilling = round2(readingBilling.reduce((sum, r) => sum + r.billing, 0));
  const readingCountThisMonth = readingBilling.filter(
    (r) => r.readingMonth.toISOString().slice(0, 7) === currentMonthValue(),
  ).length;

  const data: ExecutiveSummary = {
    zoneCount: zoneId ? 1 : zones.length,
    roomCount,
    meterCount: meters.length,
    totalReadingCount: readings.length,
    totalUsage,
    totalBilling,
    readingCountThisMonth,
    missingThisMonthCount: Math.max(0, meters.length - readingCountThisMonth),
    monthlyTrend,
    zoneBreakdown,
    statusBreakdown,
    zones: zones.map((z) => ({ id: z.id, name: z.name })),
  };

  return NextResponse.json({ ok: true, data });
}
