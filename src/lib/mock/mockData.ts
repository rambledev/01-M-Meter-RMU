import { formatReadingPeriod } from "@/lib/admin/period";
import type { AdminDashboardSummary, ReadingHistoryDTO, ZoneDTO } from "@/lib/admin/types";
import type {
  ExecutiveSummary,
  MonthlyTrendPoint,
  StatusBreakdown,
  ZoneBreakdown,
} from "@/lib/executive/types";
import type { ReadingStatusValue } from "@/lib/reading/readingStatusLabels";
import type { ResidentHistoryDTO } from "@/lib/resident/types";

// Mock data for the admin dashboard / "สรุปข้อมูล" (Executive) / "ประวัติการ
// จดมิเตอร์" "ใช้ข้อมูลตัวอย่าง" toggle (2026-10-08, extended 2026-10-08 to
// cover reading history too) — generated entirely in the browser, on
// demand. Never queries the database or calls an API route: this replaces
// the previous version of this feature, which actually inserted/deleted
// real Reading rows in the live database (removed by explicit request).
// Deterministic (no Math.random anywhere) so the same toggle-on always
// renders the same numbers, instead of reshuffling on every reload.
//
// Single source of truth: generateMockReadings() below produces one
// record per room/meter per month, and every other export (dashboard
// summary, executive summary, reading history table) derives its numbers
// from that same array — so "1,700 รายการจดมิเตอร์ทั้งหมด" on the
// dashboard and the 1,700 rows you'd find by expanding every meter on
// the ประวัติการจดมิเตอร์ tab are always the same 1,700, never two
// independently-approximated numbers that quietly drift apart.
//
// Mirrors the real 5 zones (บ้านพัก/วรุณ 1-4), each with 10 rooms/meters
// numbered 101-110 — บ้านพัก's rooms are "บ้าน 101".."บ้าน 110", the วรุณ
// zones' are plain "101".."110", matching how the real data names them.
//
// Range is anchored at January 2567 (2024) through the real current
// month (not a rolling "N months back" window) — by explicit request, so
// 2567 and 2568 (2024/2025) are always fully covered regardless of the
// period filter in src/components/ExecutiveSummaryView.tsx, which slices
// the most recent 1/3/6/12 months of the executive summary's monthlyTrend
// for its charts.
const RANGE_START_YEAR = 2024;
const RANGE_START_MONTH_INDEX0 = 0; // January, 0-based

const BASE_USAGE_PER_METER = 140; // kWh/month baseline, before seasonal/trend/jitter
const RATE_PER_UNIT = 4.8; // baht/unit — a flat display-only approximation, not the real tiered calculation
const RECORDER_NAME = "ผู้จดมิเตอร์ (ตัวอย่าง)";

interface MockZoneDef {
  id: string;
  name: string;
  rooms: string[];
}

function buildRoomNames(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const number = 101 + i;
    return prefix ? `${prefix} ${number}` : `${number}`;
  });
}

const MOCK_ZONES: MockZoneDef[] = [
  { id: "mock-zone-baan-phak", name: "บ้านพัก", rooms: buildRoomNames("บ้าน", 10) },
  { id: "mock-zone-warun-1", name: "วรุณ 1", rooms: buildRoomNames("", 10) },
  { id: "mock-zone-warun-2", name: "วรุณ 2", rooms: buildRoomNames("", 10) },
  { id: "mock-zone-warun-3", name: "วรุณ 3", rooms: buildRoomNames("", 10) },
  { id: "mock-zone-warun-4", name: "วรุณ 4", rooms: buildRoomNames("", 10) },
];

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

// Deterministic pseudo-"random" in [0, 1) from two small integers — same
// inputs always produce the same output.
function pseudoRandom(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface MonthEntry {
  date: Date;
  monthIndex: number;
}

// Every calendar month from January 2567 (2024) through the real current
// month, inclusive — a fixed start, not a rolling window (see header
// comment). At "now" = October 2569 (2026) that's Jan 2024-Oct 2026, 34
// months.
function buildMonths(): MonthEntry[] {
  const now = new Date();
  const count =
    (now.getUTCFullYear() - RANGE_START_YEAR) * 12 +
    (now.getUTCMonth() - RANGE_START_MONTH_INDEX0) +
    1;
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.UTC(RANGE_START_YEAR, RANGE_START_MONTH_INDEX0 + i, 1)),
    monthIndex: i,
  }));
}

function usageFor(zoneIndex: number, roomIndex: number, monthIndex: number): number {
  // Mild seasonal bump (hot-season peak, cycling every 12 months) + a
  // slow multi-year upward trend + small deterministic jitter per
  // room/month, individual to each meter (not just each zone) so rooms
  // in the same zone don't show identical lines.
  const seasonal = 1 + 0.25 * Math.sin(((monthIndex % 12) / 12) * Math.PI * 2 - Math.PI / 2);
  const trend = 1 + monthIndex * 0.004;
  const jitter = 0.8 + pseudoRandom(zoneIndex * 31 + roomIndex, monthIndex) * 0.4;
  return Math.round(BASE_USAGE_PER_METER * seasonal * trend * jitter);
}

function meterCodeFor(zoneIndex: number, roomIndex: number): string {
  return String(1000000 + (zoneIndex + 1) * 1000 + (roomIndex + 1)).padStart(10, "0");
}

// A handful of recent records read as PENDING_SYNC instead of SYNCED,
// purely for visual realism — never SYNC_ERROR, by explicit request
// across every role's mock view (dashboard "Sync ผิดพลาด" card, the
// ประวัติการจดมิเตอร์/ประวัติการใช้งาน status badges, the สรุปข้อมูล status
// donut chart — all derive from this same statusFor(), so excluding
// SYNC_ERROR here clears it everywhere at once).
function statusFor(zoneIndex: number, roomIndex: number, isLatestMonth: boolean): ReadingStatusValue {
  if (!isLatestMonth) return "SYNCED";
  const bucket = (zoneIndex * 7 + roomIndex) % 20;
  if (bucket === 0 || bucket === 1) return "PENDING_SYNC";
  return "SYNCED";
}

interface MockReading {
  id: string;
  zoneIndex: number;
  zoneId: string;
  zoneName: string;
  roomIndex: number;
  roomName: string;
  meterId: string;
  meterCode: string;
  date: Date;
  monthIndex: number;
  previousValue: number | null;
  currentValue: number;
  usage: number | null;
  status: ReadingStatusValue;
}

let cachedReadings: MockReading[] | null = null;

// Generated once per page load (module-level cache) — 50 meters × ~34
// months is cheap, but there's no reason to recompute it on every call.
function generateMockReadings(): MockReading[] {
  if (cachedReadings) return cachedReadings;

  const months = buildMonths();
  const latestMonthIndex = months[months.length - 1]?.monthIndex ?? -1;
  const readings: MockReading[] = [];

  MOCK_ZONES.forEach((zone, zoneIndex) => {
    zone.rooms.forEach((roomName, roomIndex) => {
      const meterId = `mock-meter-${zoneIndex}-${roomIndex}`;
      const meterCode = meterCodeFor(zoneIndex, roomIndex);
      let previousValue: number | null = null;

      for (const { date, monthIndex } of months) {
        const currentValue =
          (previousValue ?? 1000 + pseudoRandom(zoneIndex, roomIndex) * 3000) +
          (previousValue === null ? 0 : usageFor(zoneIndex, roomIndex, monthIndex));
        const rounded = Math.round(currentValue);
        const usage = previousValue === null ? null : rounded - previousValue;

        readings.push({
          id: `mock-reading-${zoneIndex}-${roomIndex}-${monthKey(date)}`,
          zoneIndex,
          zoneId: zone.id,
          zoneName: zone.name,
          roomIndex,
          roomName,
          meterId,
          meterCode,
          date,
          monthIndex,
          previousValue,
          currentValue: rounded,
          usage,
          status: statusFor(zoneIndex, roomIndex, monthIndex === latestMonthIndex),
        });

        previousValue = rounded;
      }
    });
  });

  cachedReadings = readings;
  return readings;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function getMockZones(): ZoneDTO[] {
  return MOCK_ZONES.map((z) => ({ id: z.id, name: z.name, roomCount: z.rooms.length }));
}

function recordedAtFor(date: Date, zoneIndex: number, roomIndex: number): string {
  const day = 3 + Math.floor(pseudoRandom(zoneIndex + 5, roomIndex) * 23);
  const hour = 8 + Math.floor(pseudoRandom(zoneIndex, roomIndex + 5) * 9);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day, hour, 0)).toISOString();
}

export function getMockReadingHistory(): ReadingHistoryDTO[] {
  return generateMockReadings()
    .map((r) => ({
      id: r.id,
      meterId: r.meterId,
      meterCode: r.meterCode,
      roomName: r.roomName,
      zoneName: r.zoneName,
      period: formatReadingPeriod(r.date),
      readingMonth: r.date.toISOString(),
      previousValue: r.previousValue,
      currentValue: r.currentValue,
      usage: r.usage,
      status: r.status,
      recordedByName: RECORDER_NAME,
      recordedAt: recordedAtFor(r.date, r.zoneIndex, r.roomIndex),
    }))
    .sort((a, b) => b.readingMonth.localeCompare(a.readingMonth));
}

// zoneId filters every KPI/chart to that one zone, except zoneBreakdown —
// whose whole purpose is comparing zones — which just narrows to that
// one entry instead. Mirrors src/app/api/executive/summary/route.ts's
// real filtering behavior exactly, so mock mode looks/behaves the same
// way the real report does. Always returns the FULL month range (like
// the real API, which returns every month with data, unbounded) —
// src/components/ExecutiveSummaryView.tsx's period filter slices the
// most recent N months of monthlyTrend for its charts, the same way for
// both mock and real data.
export function getMockExecutiveSummary(zoneId?: string): ExecutiveSummary {
  const all = generateMockReadings();
  const selectedZoneIndex = zoneId ? MOCK_ZONES.findIndex((z) => z.id === zoneId) : -1;
  const inScope = selectedZoneIndex >= 0 ? all.filter((r) => r.zoneIndex === selectedZoneIndex) : all;

  const monthMap = new Map<string, { readingCount: number; totalUsage: number }>();
  for (const r of inScope) {
    const key = monthKey(r.date);
    const entry = monthMap.get(key) ?? { readingCount: 0, totalUsage: 0 };
    entry.readingCount += 1;
    entry.totalUsage += r.usage ?? 0;
    monthMap.set(key, entry);
  }
  const monthlyTrend: MonthlyTrendPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      month: key,
      periodLabel: formatReadingPeriod(new Date(`${key}-01T00:00:00.000Z`)),
      readingCount: v.readingCount,
      totalUsage: v.totalUsage,
      totalBilling: Math.round(v.totalUsage * RATE_PER_UNIT * 100) / 100,
    }));

  const totalUsage = sum(monthlyTrend.map((m) => m.totalUsage));
  const totalBilling = sum(monthlyTrend.map((m) => m.totalBilling));
  const totalReadingCount = inScope.length;
  const zoneIndices = selectedZoneIndex >= 0 ? [selectedZoneIndex] : MOCK_ZONES.map((_, i) => i);
  const meterCount = sum(zoneIndices.map((zi) => MOCK_ZONES[zi].rooms.length));

  const zoneBreakdown: ZoneBreakdown[] = zoneIndices.map((zi) => {
    const zone = MOCK_ZONES[zi];
    const zoneReadings = all.filter((r) => r.zoneIndex === zi);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      meterCount: zone.rooms.length,
      readingCount: zoneReadings.length,
      totalUsage: sum(zoneReadings.map((r) => r.usage ?? 0)),
      totalBilling: Math.round(sum(zoneReadings.map((r) => r.usage ?? 0)) * RATE_PER_UNIT * 100) / 100,
    };
  });

  const statusCounts = new Map<ReadingStatusValue, number>();
  for (const r of inScope) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }
  const statusBreakdown: StatusBreakdown[] = Array.from(statusCounts.entries()).map(
    ([status, count]) => ({ status, count }),
  );

  return {
    zoneCount: zoneIndices.length,
    roomCount: meterCount, // one meter per room, matching this app's usual pattern
    meterCount,
    totalReadingCount,
    totalUsage,
    totalBilling,
    readingCountThisMonth: monthlyTrend[monthlyTrend.length - 1]?.readingCount ?? 0,
    missingThisMonthCount: 0,
    monthlyTrend,
    zoneBreakdown,
    statusBreakdown,
    zones: MOCK_ZONES.map((z) => ({ id: z.id, name: z.name })),
  };
}

export function getMockDashboardSummary(): AdminDashboardSummary {
  const all = generateMockReadings();
  const latestMonth = all.length > 0 ? Math.max(...all.map((r) => r.monthIndex)) : -1;
  const syncErrorCount = all.filter((r) => r.status === "SYNC_ERROR").length;
  return {
    zoneCount: MOCK_ZONES.length,
    roomCount: sum(MOCK_ZONES.map((z) => z.rooms.length)),
    meterCount: sum(MOCK_ZONES.map((z) => z.rooms.length)),
    userCount: sum(MOCK_ZONES.map((z) => z.rooms.length)) + MOCK_ZONES.length,
    readingCount: all.length,
    readingCountThisMonth: all.filter((r) => r.monthIndex === latestMonth).length,
    syncErrorCount,
  };
}

// "ประวัติการใช้งาน" on /resident — the full 2567-now archive (same range
// as the admin views), for one representative mock room (always บ้าน 101
// in บ้านพัก, regardless of which room the real signed-in resident
// actually has — this is a demo view, not a per-resident one).
// src/app/resident/page.tsx itself windows this down to one selectable
// calendar year at a time (by explicit request) — returning the full
// range here, rather than pre-trimming it, is what gives that year
// selector real data for every year instead of just the current one.
// Billing is a flat display-only approximation (same spirit as
// RATE_PER_UNIT above), not the real tiered calculateBilling() — that
// needs a live BillingConfig from the database, which mock mode never
// touches.
const RESIDENT_ZONE_INDEX = 0; // บ้านพัก
const RESIDENT_ROOM_INDEX = 0; // บ้าน 101
const MOCK_ENERGY_RATE = 3.8; // baht/unit, base tariff approximation
const MOCK_FT_RATE = 0.3; // baht/unit, Ft approximation
const MOCK_TAX_PERCENT = 7;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mockBillingFor(usage: number | null) {
  if (usage === null) {
    return { baseCharge: null, ft: null, tax: null, total: null };
  }
  const baseCharge = round2(usage * MOCK_ENERGY_RATE);
  const ft = round2(usage * MOCK_FT_RATE);
  const tax = round2((baseCharge + ft) * (MOCK_TAX_PERCENT / 100));
  const total = round2(baseCharge + ft + tax);
  return { baseCharge, ft, tax, total };
}

export function getMockResidentHistory(): ResidentHistoryDTO {
  const zone = MOCK_ZONES[RESIDENT_ZONE_INDEX];
  const all = generateMockReadings().filter(
    (r) => r.zoneIndex === RESIDENT_ZONE_INDEX && r.roomIndex === RESIDENT_ROOM_INDEX,
  );

  return {
    room: {
      id: `mock-room-${RESIDENT_ZONE_INDEX}-${RESIDENT_ROOM_INDEX}`,
      name: zone.rooms[RESIDENT_ROOM_INDEX],
      zoneName: zone.name,
    },
    readings: all
      .map((r) => ({
        id: r.id,
        meterCode: r.meterCode,
        period: formatReadingPeriod(r.date),
        readingMonth: monthKey(r.date),
        previousValue: r.previousValue,
        currentValue: r.currentValue,
        usage: r.usage,
        status: r.status,
        billing: mockBillingFor(r.usage),
      }))
      .sort((a, b) => b.readingMonth.localeCompare(a.readingMonth)),
  };
}
