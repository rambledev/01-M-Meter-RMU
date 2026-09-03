"use client";

import { useState } from "react";
import type { BillingConfig } from "@/lib/billing/types";
import { buildExportFilename } from "@/lib/export/filename";
import { currentMonthValue, formatMonthThai } from "@/lib/reading/readingMonth";

// Item 6 of the Phase 6 spec: pick a month, then export — no separate
// dashboard/report page.
export default function ExportExcelButton({
  billingConfig,
}: {
  billingConfig: BillingConfig | null;
}) {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setMessage(null);
    try {
      // Phase 6B: pass the current (possibly user-edited) billing config so
      // Excel uses the exact same rates the Reading detail/breakdown panels
      // just showed on screen — the server falls back to its own default
      // config if this is missing (Calculation Service stays the single
      // source of truth either way).
      const params = new URLSearchParams({ month: monthValue });
      if (billingConfig) {
        params.set("config", JSON.stringify(billingConfig));
      }
      const res = await fetch(`/api/export?${params.toString()}`);
      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const body = (await res.json()) as { message?: string };
        setMessage(body.message ?? "Export ไม่สำเร็จ");
        return;
      }
      if (!res.ok) {
        setMessage("Export ไม่สำเร็จ");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildExportFilename(monthValue);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("เชื่อมต่อเครือข่ายไม่สำเร็จ");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
      <p className="text-sm font-semibold">Export Excel</p>
      <label className="flex flex-col gap-1 text-sm" htmlFor="export-month">
        เดือน
        <input
          id="export-month"
          type="month"
          value={monthValue}
          onChange={(e) => {
            setMonthValue(e.target.value);
            setMessage(null);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <p className="text-xs text-zinc-500">{formatMonthThai(monthValue)}</p>
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isExporting ? "กำลัง Export..." : "Export Excel"}
      </button>
      {message && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          {message}
        </p>
      )}
    </section>
  );
}
