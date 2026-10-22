"use client";

import { PieChart } from "lucide-react";
import ExecutiveSummaryView from "@/components/ExecutiveSummaryView";

// Admin tab "สรุปข้อมูล" (2026-09-22) — the same org-wide KPI/chart report
// as /executive (ExecutiveSummaryView), just reachable without switching
// role/URL. No separate summary logic here; see ExecutiveSummaryView for
// the actual report.
export default function AdminSummary() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold text-primary-800 dark:text-primary-400">
        <PieChart aria-hidden="true" className="h-5 w-5 shrink-0" />
        สรุปข้อมูล
      </h3>
      <ExecutiveSummaryView />
    </section>
  );
}
