import type { ReadingStatus } from "@/lib/offline/db";

export interface MonthlyTrendPoint {
  month: string; // "YYYY-MM"
  periodLabel: string; // "MM/BBBB" via formatReadingPeriod
  readingCount: number;
  totalUsage: number;
  totalBilling: number;
}

export interface ZoneBreakdown {
  zoneId: string;
  zoneName: string;
  meterCount: number;
  readingCount: number;
  totalUsage: number;
  totalBilling: number;
}

export interface StatusBreakdown {
  status: ReadingStatus;
  count: number;
}

export interface ExecutiveSummary {
  zoneCount: number;
  roomCount: number;
  meterCount: number;
  totalReadingCount: number;
  totalUsage: number;
  totalBilling: number;
  readingCountThisMonth: number;
  missingThisMonthCount: number;
  monthlyTrend: MonthlyTrendPoint[];
  zoneBreakdown: ZoneBreakdown[];
  statusBreakdown: StatusBreakdown[];
  zones: { id: string; name: string }[];
}
