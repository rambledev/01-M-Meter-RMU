"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BillingExplanation from "@/components/BillingExplanation";
import ExportExcelButton from "@/components/ExportExcelButton";
import ReadingHistoryList from "@/components/ReadingHistoryList";
import CheckerAuthGate from "@/components/checker/CheckerAuthGate";
import { fetchBillingConfig } from "@/lib/billing/billingConfigApi";
import type { BillingConfig } from "@/lib/billing/types";
import type { CheckerSession } from "@/lib/checker/types";
import { fetchMeters } from "@/lib/meters/meterApi";
import type { MeterInfo } from "@/lib/meters/types";
import type { LocalReading } from "@/lib/offline/db";
import { getReadings } from "@/lib/offline/readingRepository";
import { getPendingQueueItems } from "@/lib/offline/syncQueueRepository";

// ประวัติ / Export Excel / อธิบายค่าไฟ — moved off the checker dashboard
// (2026-09-06 redesign) into its own page, reached from a link on
// /checker, so the dashboard itself stays focused on "what do I still
// need to go read today".
export default function CheckerHistoryPage() {
  return (
    <CheckerAuthGate>
      {(session) => <HistoryPage session={session} />}
    </CheckerAuthGate>
  );
}

function HistoryPage({ session }: { session: CheckerSession }) {
  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [history, setHistory] = useState<LocalReading[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  useEffect(() => {
    fetchBillingConfig().then(setBillingConfig);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMeters().then((data) => {
      if (!cancelled) setMeters(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, pending] = await Promise.all([getReadings(), getPendingQueueItems()]);
      if (cancelled) return;
      setHistory([...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPendingCount(pending.length);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between border-b-2 border-emerald-600 pb-3">
        <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
          ประวัติ / รายงาน
        </h1>
        <Link
          href="/checker"
          className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400"
        >
          ← กลับหน้าหลัก
        </Link>
      </header>

      {pendingCount > 0 && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          มีข้อมูลรอส่ง {pendingCount} รายการ —{" "}
          <Link href="/checker" className="underline">
            กลับไปหน้าหลักเพื่อ Sync
          </Link>
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">ประวัติที่บันทึกในเครื่อง</h2>
        <ReadingHistoryList
          readings={history}
          billingConfig={billingConfig}
          meters={meters}
          session={session}
        />
      </section>

      {billingConfig && <BillingExplanation config={billingConfig} />}

      <ExportExcelButton billingConfig={billingConfig} />
    </div>
  );
}
