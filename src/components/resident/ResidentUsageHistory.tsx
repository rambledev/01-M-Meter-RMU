"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  READING_STATUS_COLOR,
  READING_STATUS_LABEL,
  type ReadingStatusValue,
} from "@/lib/reading/readingStatusLabels";
import type { ResidentReadingDTO } from "@/lib/resident/types";

function baht(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUsageTooltip(value: unknown): string {
  return `${Number(value).toLocaleString("th-TH")} หน่วย`;
}

// "ประวัติการใช้งาน" card list + trend chart (2026-10-08 redesign, replaces
// the old plain data table) — a small usage-per-month bar chart above a
// stack of receipt-style cards, one per reading month, each own its own
// usage/cost/status at a glance. Oldest-first for the chart (so the line
// reads left-to-right as time passing) but the card list stays
// newest-first, matching how the original table and the admin's own
// history views both order it.
export default function ResidentUsageHistory({ readings }: { readings: ResidentReadingDTO[] }) {
  if (readings.length === 0) {
    return <p className="text-sm text-zinc-500">ยังไม่มีประวัติการจดมิเตอร์</p>;
  }

  const chartData = [...readings]
    .sort((a, b) => a.readingMonth.localeCompare(b.readingMonth))
    .map((r) => ({ period: r.period, usage: r.usage ?? 0 }));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData}>
            <XAxis dataKey="period" fontSize={10} stroke="#a1a1aa" interval="preserveStartEnd" />
            <Tooltip formatter={formatUsageTooltip} labelClassName="text-zinc-900" />
            {/* --primary-500 directly, not Tailwind's --color-primary-500: that
                indirection (--color-primary-500: var(--primary-500), declared
                once in the @theme inline block) doesn't re-resolve per
                [data-role] scope the way Tailwind's generated utility
                classes do — confirmed via computed-style inspection, this
                raw CSS variable does. */}
            <Bar dataKey="usage" name="หน่วยที่ใช้" fill="var(--primary-500)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2">
        {readings.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{r.period}</p>
              <p className="text-xs text-zinc-500">
                {r.usage === null ? "ยังไม่มีข้อมูล" : `${r.usage.toLocaleString("th-TH")} หน่วย`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <p className="text-sm font-bold text-primary-700 dark:text-primary-400">
                {r.billing.total === null ? "-" : `${baht(r.billing.total)} บาท`}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  READING_STATUS_COLOR[r.status as ReadingStatusValue] ??
                  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {READING_STATUS_LABEL[r.status as ReadingStatusValue] ?? r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
