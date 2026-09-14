"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CheckerAuthGate from "@/components/checker/CheckerAuthGate";
import MonthYearSelect from "@/components/MonthYearSelect";
import OnlineStatusBadge from "@/components/OnlineStatusBadge";
import QrScanner from "@/components/QrScanner";
import { fetchCheckerDashboard } from "@/lib/checker/checkerDashboardApi";
import type { CheckerDashboardMeter, CheckerSession } from "@/lib/checker/types";
import { fetchMeters } from "@/lib/meters/meterApi";
import { lookupMeter } from "@/lib/meters/meterLookup";
import type { MeterInfo } from "@/lib/meters/types";
import { getReadings } from "@/lib/offline/readingRepository";
import { getPendingQueueItems } from "@/lib/offline/syncQueueRepository";
import { currentMonthValue, toReadingMonth } from "@/lib/reading/readingMonth";
import { syncPendingReadings } from "@/lib/sync/syncService";

// ผู้จดมิเตอร์ (METER_READER role) — mobile-first landing page (2026-09-06
// redesign): a dashboard of the logged-in checker's own responsible-zone
// meters (assigned by Admin), gated behind a real login (there was none
// before). Tapping "เก็บมิเตอร์" (scan) or any meter row hands off to
// /checker/reading for the single-meter workflow that used to live
// directly on this page; history/export/billing explanation moved to
// /checker/history.
export default function CheckerPage() {
  return (
    <CheckerAuthGate>
      {(session, logout) => <Dashboard session={session} logout={logout} />}
    </CheckerAuthGate>
  );
}

function Dashboard({ session, logout }: { session: CheckerSession; logout: () => void }) {
  const router = useRouter();
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [meters, setMeters] = useState<CheckerDashboardMeter[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allMeters, setAllMeters] = useState<MeterInfo[]>([]);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Full meter directory (not zone-scoped) — QR scan / manual code entry
  // must resolve any meter, since the QR payload identifies one directly.
  useEffect(() => {
    let cancelled = false;
    fetchMeters()
      .then((data) => {
        if (!cancelled) setAllMeters(data);
      })
      .catch(() => {
        // Dashboard tiles below still work from their own fetch; QR/manual
        // lookup just won't resolve until this succeeds.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshPendingCount() {
    const pending = await getPendingQueueItems();
    setPendingCount(pending.length);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await getPendingQueueItems();
      if (!cancelled) setPendingCount(pending.length);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Server-scoped dashboard (this checker's responsibleZones only), merged
  // with any local-but-not-yet-synced reading for the same month — a
  // reading just saved offline must show as "จดแล้ว" immediately, not wait
  // for the next successful Sync (server can't know about it yet).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashboard, localReadings] = await Promise.all([
          fetchCheckerDashboard(session.id, monthValue),
          getReadings(),
        ]);
        if (cancelled) return;
        const readingMonth = toReadingMonth(monthValue);
        const localSet = new Set(
          localReadings
            .filter((r) => r.readingMonth === readingMonth)
            .map((r) => r.meterId),
        );
        setZones(dashboard.zones);
        setMeters(
          dashboard.meters.map((m) => ({
            ...m,
            readThisMonth: m.readThisMonth || localSet.has(m.id),
          })),
        );
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
  }, [session.id, monthValue]);

  async function handleSync() {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const { succeeded, failed } = await syncPendingReadings();
      if (failed === 0) {
        setSyncMessage(`Sync สำเร็จ ${succeeded} รายการ`);
      } else if (succeeded === 0) {
        setSyncMessage(`Sync ไม่สำเร็จ ${failed} รายการ`);
      } else {
        setSyncMessage(`Sync สำเร็จ ${succeeded} รายการ, ไม่สำเร็จ ${failed} รายการ`);
      }
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }

  function goToMeter(meterId: string) {
    router.push(`/checker/reading?meterId=${meterId}`);
  }

  function handleQrScanned(payload: string) {
    setShowQrScanner(false);
    const found = lookupMeter(allMeters, payload);
    if (!found) {
      setLookupError("ไม่พบมิเตอร์ที่ QR นี้อ้างถึง");
      return;
    }
    setLookupError(null);
    goToMeter(found.id);
  }

  function handleManualLookup() {
    const found = lookupMeter(allMeters, manualCode);
    if (!found) {
      setLookupError("ไม่พบมิเตอร์รหัสนี้");
      return;
    }
    setLookupError(null);
    goToMeter(found.id);
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, CheckerDashboardMeter[]>();
    for (const m of meters) {
      const list = groups.get(m.zoneName) ?? [];
      list.push(m);
      groups.set(m.zoneName, list);
    }
    const orderedNames = zones.map((z) => z.name).filter((name) => groups.has(name));
    return orderedNames.map((name) => ({ zoneName: name, meters: groups.get(name)! }));
  }, [meters, zones]);

  const readCount = meters.filter((m) => m.readThisMonth).length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1 border-b-2 border-emerald-600 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
            สวัสดี, {session.name}
          </h1>
          <OnlineStatusBadge />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            โซนที่รับผิดชอบ: {session.zones.map((z) => z.name).join(", ") || "-"}
          </p>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {/* Sync */}
      {(pendingCount > 0 || syncMessage) && (
        <section className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
          {pendingCount > 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              มีข้อมูลรอส่ง {pendingCount} รายการ
            </p>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
            >
              {isSyncing ? "กำลัง Sync..." : "Sync ข้อมูล"}
            </button>
          )}
          {syncMessage && (
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {syncMessage}
            </p>
          )}
        </section>
      )}

      {/* Collect a meter — QR scan is the primary action */}
      <section className="flex flex-col gap-2">
        {showQrScanner ? (
          <QrScanner onScan={handleQrScanned} onCancel={() => setShowQrScanner(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setShowQrScanner(true)}
            className="rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white hover:bg-emerald-700"
          >
            📷 เก็บมิเตอร์ (แสกน QR)
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleManualLookup();
            }}
            placeholder="หรือกรอกรหัสมิเตอร์เอง"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleManualLookup}
            className="shrink-0 rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            ค้นหา
          </button>
        </div>
        {lookupError && <p className="text-sm font-medium text-red-600">{lookupError}</p>}
      </section>

      {/* Month + summary */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">มิเตอร์ที่รับผิดชอบ</p>
          <MonthYearSelect
            value={monthValue}
            onChange={setMonthValue}
            selectClassName="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        {!loading && !error && (
          <p className="text-sm text-zinc-500">
            จดแล้ว {readCount} / {meters.length} เครื่อง
          </p>
        )}
      </section>

      {loading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
      {error && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          {error}
        </p>
      )}

      {!loading && !error && meters.length === 0 && (
        <p className="rounded-xl border border-zinc-300 p-3 text-center text-sm text-zinc-500 dark:border-zinc-700">
          ยังไม่มีมิเตอร์ในโซนที่รับผิดชอบ — ติดต่อผู้ดูแลระบบ
        </p>
      )}

      {grouped.map((group) => (
        <section key={group.zoneName} className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            โซน: {group.zoneName}
          </p>
          <div className="flex flex-col gap-2">
            {group.meters.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => goToMeter(m.id)}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span>
                  <span className="block text-sm font-semibold">{m.code}</span>
                  <span className="block text-xs text-zinc-500">{m.roomName}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    m.readThisMonth
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {m.readThisMonth ? "จดแล้ว" : "ยังไม่จด"}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <Link
        href="/checker/history"
        className="text-center text-sm font-semibold text-emerald-700 underline dark:text-emerald-400"
      >
        ดูประวัติ / Export Excel / อธิบายค่าไฟ
      </Link>
      <Link href="/" className="text-center text-xs text-zinc-500 underline">
        เปลี่ยนบทบาท
      </Link>
    </div>
  );
}
