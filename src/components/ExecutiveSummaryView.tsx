"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  Gauge,
  Home,
  MapPin,
  PieChart as PieChartIcon,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchExecutiveSummary } from "@/lib/executive/executiveApi";
import type { ExecutiveSummary } from "@/lib/executive/types";
import { getMockExecutiveSummary } from "@/lib/mock/mockData";
import { useMockMode } from "@/lib/mock/mockMode";
import {
  READING_STATUS_LABEL,
  type ReadingStatusValue,
} from "@/lib/reading/readingStatusLabels";

// Fixed/semantic — same status meaning everywhere this chart renders
// (standalone on /executive, or embedded in AdminSummary under /admin's
// red theme), so these never swap with the role color; matches
// src/lib/reading/readingStatusLabels.ts's own status color convention.
const STATUS_CHART_COLOR: Record<ReadingStatusValue, string> = {
  DRAFT: "#a1a1aa",
  PENDING_SYNC: "#f59e0b",
  SYNCING: "#3b82f6",
  SYNCED: "#059669",
  SYNC_ERROR: "#ef4444",
};

const GRID_STROKE = "#71717a33";
const AXIS_COLOR = "#71717a";

// Data-series colors (2026-10-08 pastel/formal re-theme) — a fixed
// qualitative palette distinguishing the 4 chart series, independent of
// role brand color for the same reason as STATUS_CHART_COLOR above.
// Muted/pastel versions of the original hues, keeping the same original
// pairing (usage+cost as a teal-green pair, count+zone-usage as a
// gold-terracotta pair).
const USAGE_TREND_COLOR = "#5a9c7a";
const COST_TREND_COLOR = "#3f7a78";
const READING_COUNT_COLOR = "#a89144";
const ZONE_USAGE_COLOR = "#b97d4b";

function thb(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

// Recharts' Tooltip formatter type accepts a wider ValueType (string |
// number | array) than what these charts ever actually pass — Number()
// coerces safely regardless.
function formatUnitTooltip(value: unknown): string {
  return `${thb(Number(value))} หน่วย`;
}
function formatBahtTooltip(value: unknown): string {
  return `${thb(Number(value))} บาท`;
}
function formatCountTooltip(value: unknown): string {
  return `${Number(value)} รายการ`;
}

// KPI cards + trend/comparison charts over the whole system's data (2026-09-06,
// originally built for the ผู้บริหาร/Executive role "ในรูปแบบ power bi").
// Extracted (2026-09-22) so both /executive and the Admin "สรุปข้อมูล" tab
// render the exact same report from one place — no separate copy of the
// KPI/chart logic. Callers own their own page/tab chrome (title, back link,
// container) — this component is just the filter + KPI + chart body.
const PERIOD_OPTIONS = [
  { label: "รายเดือน", months: 1 },
  { label: "3 เดือน", months: 3 },
  { label: "6 เดือน", months: 6 },
  { label: "1 ปี", months: 12 },
] as const;

export default function ExecutiveSummaryView() {
  const [mockMode] = useMockMode();
  const [zoneId, setZoneId] = useState<string>("");
  // Windows the trend-over-time charts to the most recent N months —
  // works the same way for real data (the API already returns every
  // month with data, unbounded) and mock data (now a multi-year range,
  // 2567-current) — pure client-side slicing, no extra fetch either way.
  // zoneBreakdown/statusBreakdown stay all-time regardless (see their own
  // chart titles — "สะสมทั้งหมด").
  const [periodMonths, setPeriodMonths] = useState<number>(12);
  // Mock data is a pure, synchronous computation — derived directly during
  // render via useMemo, never through setState-in-an-effect.
  const mockSummary = useMemo(
    () => (mockMode ? getMockExecutiveSummary(zoneId || undefined) : null),
    [mockMode, zoneId],
  );
  const [fetchedSummary, setFetchedSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mockMode) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExecutiveSummary(zoneId || undefined);
        if (!cancelled) setFetchedSummary(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId, mockMode]);

  const summary = mockMode ? mockSummary : fetchedSummary;
  const effectiveLoading = mockMode ? false : loading;
  const effectiveError = mockMode ? null : error;
  const windowedTrend = useMemo(
    () => summary?.monthlyTrend.slice(-periodMonths) ?? [],
    [summary, periodMonths],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-300 p-1 dark:border-zinc-700">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.months}
              type="button"
              onClick={() => setPeriodMonths(opt.months)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                periodMonths === opt.months
                  ? "bg-primary-600 text-white"
                  : "text-zinc-600 hover:bg-primary-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">ทุกโซน</option>
          {summary?.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      {effectiveLoading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
      {effectiveError && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          {effectiveError}
        </p>
      )}

      {summary && !effectiveLoading && !effectiveError && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="โซน" value={summary.zoneCount} icon={MapPin} />
            <KpiCard label="ห้องพัก" value={summary.roomCount} icon={Home} />
            <KpiCard label="มิเตอร์" value={summary.meterCount} icon={Gauge} />
            <KpiCard
              label="รายการจดมิเตอร์ทั้งหมด"
              value={summary.totalReadingCount}
              icon={ClipboardList}
            />
            <KpiCard label="จดแล้วเดือนนี้" value={summary.readingCountThisMonth} icon={CalendarCheck} />
            <KpiCard
              label="ยังไม่จดเดือนนี้"
              value={summary.missingThisMonthCount}
              icon={CalendarX}
              tone={summary.missingThisMonthCount > 0 ? "warning" : "default"}
            />
            <KpiCard label="หน่วยไฟที่ใช้รวม" value={`${thb(summary.totalUsage)} หน่วย`} icon={Zap} />
            <KpiCard label="ค่าไฟรวมทั้งหมด" value={`${thb(summary.totalBilling)} บาท`} icon={Banknote} />
          </div>

          {/* Chart grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="แนวโน้มการใช้ไฟฟ้า (หน่วย/เดือน)" icon={TrendingUp}>
              {windowedTrend.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={windowedTrend}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="periodLabel" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} />
                    <Tooltip formatter={formatUnitTooltip} />
                    <Line
                      type="monotone"
                      dataKey="totalUsage"
                      name="หน่วยไฟที่ใช้"
                      stroke={USAGE_TREND_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="แนวโน้มค่าไฟ (บาท/เดือน)" icon={Banknote}>
              {windowedTrend.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={windowedTrend}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="periodLabel" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} />
                    <Tooltip formatter={formatBahtTooltip} />
                    <Line
                      type="monotone"
                      dataKey="totalBilling"
                      name="ค่าไฟ"
                      stroke={COST_TREND_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="จำนวนรายการจดมิเตอร์ต่อเดือน" icon={ClipboardList}>
              {windowedTrend.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={windowedTrend}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="periodLabel" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} allowDecimals={false} />
                    <Tooltip formatter={formatCountTooltip} />
                    <Bar dataKey="readingCount" name="จำนวนรายการ" fill={READING_COUNT_COLOR} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="เปรียบเทียบการใช้ไฟตามโซน (สะสมทั้งหมด)" icon={MapPin}>
              {summary.zoneBreakdown.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.zoneBreakdown}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="zoneName" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} />
                    <Tooltip formatter={formatUnitTooltip} />
                    <Bar dataKey="totalUsage" name="หน่วยไฟที่ใช้" fill={ZONE_USAGE_COLOR} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="สถานะข้อมูลการจดมิเตอร์" icon={PieChartIcon}>
              {summary.statusBreakdown.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Tooltip formatter={formatCountTooltip} />
                    <Legend
                      formatter={(value: string) =>
                        READING_STATUS_LABEL[value as ReadingStatusValue] ?? value
                      }
                    />
                    <Pie
                      data={summary.statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {summary.statusBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_CHART_COLOR[entry.status]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border-t-4 border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
        tone === "warning"
          ? "border-t-amber-500 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-t-primary-500 border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          tone === "warning"
            ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
            : "bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400"
        }`}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-800 dark:text-primary-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyChartNote() {
  return (
    <p className="flex h-[260px] items-center justify-center text-sm text-zinc-500">
      ยังไม่มีข้อมูล
    </p>
  );
}
