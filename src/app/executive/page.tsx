"use client";

import Link from "next/link";
import { ArrowLeftRight, LineChart } from "lucide-react";
import ExecutiveSummaryView from "@/components/ExecutiveSummaryView";

// ผู้บริหาร (Executive role) — BI-style reporting dashboard (2026-09-06):
// KPI cards + trend/comparison charts over the whole system's data,
// requested explicitly "ในรูปแบบ power bi" (KPI cards + charts + a slicer,
// the way a Power BI report page is laid out). No login gate — same as
// Admin, this role has no per-user scoping need (it's an org-wide view,
// not "my own" data like /checker). The report body itself lives in
// ExecutiveSummaryView (2026-09-22, shared with the Admin "สรุปข้อมูล" tab)
// — this page only owns its own header/back-link chrome.
export default function ExecutivePage() {
  return (
    <div className="surface-panel mx-auto my-3 flex w-[calc(100%-1.5rem)] max-w-6xl flex-col sm:my-8 sm:px-6 gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-primary-600 pb-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-primary-800 dark:text-primary-400">
            <LineChart aria-hidden="true" className="h-5 w-5 shrink-0" />
            รายงานสรุปสำหรับผู้บริหาร
          </h1>
          <p className="text-sm text-zinc-500">
            สรุปข้อมูล แนวโน้ม และเปรียบเทียบการใช้ไฟฟ้าทั้งระบบ
          </p>
        </div>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700 underline dark:text-primary-400"
        >
          <ArrowLeftRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          เปลี่ยนบทบาท
        </Link>
      </header>

      <ExecutiveSummaryView />
    </div>
  );
}
