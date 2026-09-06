"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { fetchExecutiveSummary } from "@/lib/executive/executiveApi";
import type { ExecutiveSummary } from "@/lib/executive/types";
import {
  READING_STATUS_LABEL,
  type ReadingStatusValue,
} from "@/lib/reading/readingStatusLabels";

const STATUS_CHART_COLOR: Record<ReadingStatusValue, string> = {
  DRAFT: "#a1a1aa",
  PENDING_SYNC: "#f59e0b",
  SYNCING: "#3b82f6",
  SYNCED: "#059669",
  SYNC_ERROR: "#ef4444",
};

const GRID_STROKE = "#71717a33";
const AXIS_COLOR = "#71717a";

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

// ผู้บริหาร (Executive role) — BI-style reporting dashboard (2026-09-06):
// KPI cards + trend/comparison charts over the whole system's data,
// requested explicitly "ในรูปแบบ power bi" (KPI cards + charts + a slicer,
// the way a Power BI report page is laid out). Replaces the placeholder
// page. No login gate — same as Admin, this role has no per-user scoping
// need (it's an org-wide view, not "my own" data like /checker).
export default function ExecutivePage() {
  const [zoneId, setZoneId] = useState<string>("");
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExecutiveSummary(zoneId || undefined);
        if (!cancelled) setSummary(data);
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
  }, [zoneId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-emerald-600 pb-3">
        <div>
          <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
            รายงานสรุปสำหรับผู้บริหาร
          </h1>
          <p className="text-sm text-zinc-500">
            สรุปข้อมูล แนวโน้ม และเปรียบเทียบการใช้ไฟฟ้าทั้งระบบ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">ทุกโซน</option>
            {summary?.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <Link
            href="/"
            className="shrink-0 text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            เปลี่ยนบทบาท
          </Link>
        </div>
      </header>

      {loading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
      {error && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          {error}
        </p>
      )}

      {summary && !loading && !error && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="โซน" value={summary.zoneCount} />
            <KpiCard label="ห้องพัก" value={summary.roomCount} />
            <KpiCard label="มิเตอร์" value={summary.meterCount} />
            <KpiCard label="รายการจดมิเตอร์ทั้งหมด" value={summary.totalReadingCount} />
            <KpiCard label="จดแล้วเดือนนี้" value={summary.readingCountThisMonth} />
            <KpiCard
              label="ยังไม่จดเดือนนี้"
              value={summary.missingThisMonthCount}
              tone={summary.missingThisMonthCount > 0 ? "warning" : "default"}
            />
            <KpiCard label="หน่วยไฟที่ใช้รวม" value={`${thb(summary.totalUsage)} หน่วย`} />
            <KpiCard label="ค่าไฟรวมทั้งหมด" value={`${thb(summary.totalBilling)} บาท`} />
          </div>

          {/* Chart grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="แนวโน้มการใช้ไฟฟ้า (หน่วย/เดือน)">
              {summary.monthlyTrend.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={summary.monthlyTrend}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="periodLabel" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} />
                    <Tooltip formatter={formatUnitTooltip} />
                    <Line
                      type="monotone"
                      dataKey="totalUsage"
                      name="หน่วยไฟที่ใช้"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="แนวโน้มค่าไฟ (บาท/เดือน)">
              {summary.monthlyTrend.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={summary.monthlyTrend}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="periodLabel" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} />
                    <Tooltip formatter={formatBahtTooltip} />
                    <Line
                      type="monotone"
                      dataKey="totalBilling"
                      name="ค่าไฟ"
                      stroke="#0d9488"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="จำนวนรายการจดมิเตอร์ต่อเดือน">
              {summary.monthlyTrend.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.monthlyTrend}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="periodLabel" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} allowDecimals={false} />
                    <Tooltip formatter={formatCountTooltip} />
                    <Bar dataKey="readingCount" name="จำนวนรายการ" fill="#65a30d" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="เปรียบเทียบการใช้ไฟตามโซน (สะสมทั้งหมด)">
              {summary.zoneBreakdown.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.zoneBreakdown}>
                    <CartesianGrid stroke={GRID_STROKE} />
                    <XAxis dataKey="zoneName" stroke={AXIS_COLOR} fontSize={12} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} />
                    <Tooltip formatter={formatUnitTooltip} />
                    <Bar dataKey="totalUsage" name="หน่วยไฟที่ใช้" fill="#d97706" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="สถานะข้อมูลการจดมิเตอร์">
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
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border-t-4 border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
        tone === "warning"
          ? "border-t-amber-500 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-t-emerald-500 border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">{title}</p>
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
