"use client";

import Link from "next/link";
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
        <Link
          href="/"
          className="shrink-0 text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          เปลี่ยนบทบาท
        </Link>
      </header>

      <ExecutiveSummaryView />
    </div>
  );
}
