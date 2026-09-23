"use client";

import ExecutiveSummaryView from "@/components/ExecutiveSummaryView";

// Admin tab "สรุปข้อมูล" (2026-09-22) — the same org-wide KPI/chart report
// as /executive (ExecutiveSummaryView), just reachable without switching
// role/URL. No separate summary logic here; see ExecutiveSummaryView for
// the actual report.
export default function AdminSummary() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">สรุปข้อมูล</h3>
      <ExecutiveSummaryView />
    </section>
  );
}
