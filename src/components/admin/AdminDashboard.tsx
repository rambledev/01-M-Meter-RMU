"use client";

import { useEffect, useMemo, useState } from "react";
import MonthYearSelect from "@/components/MonthYearSelect";
import { fetchDashboard, listMissingReadings, listZones } from "@/lib/admin/adminApi";
import type { AdminDashboardSummary, MissingReadingDTO, ZoneDTO } from "@/lib/admin/types";
import { currentMonthValue } from "@/lib/reading/readingMonth";
import { formatReadingPeriod } from "@/lib/admin/period";

const CARDS: { key: keyof AdminDashboardSummary; label: string }[] = [
  { key: "zoneCount", label: "โซน" },
  { key: "roomCount", label: "ห้องพัก" },
  { key: "meterCount", label: "มิเตอร์" },
  { key: "userCount", label: "ผู้ใช้งาน" },
  { key: "readingCount", label: "รายการอ่านมิเตอร์ทั้งหมด" },
  { key: "readingCountThisMonth", label: "รายการอ่านมิเตอร์เดือนนี้" },
  { key: "syncErrorCount", label: "Sync ผิดพลาด" },
];

export default function AdminDashboard() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboard();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm font-medium text-red-600">{error}</p>;
  }
  if (!summary) {
    return <p className="text-sm text-zinc-500">กำลังโหลด...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className={`flex flex-col gap-1 rounded-xl border-t-4 border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
              card.key === "syncErrorCount" && summary[card.key] > 0
                ? "border-t-red-500 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                : "border-t-emerald-500 border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {summary[card.key]}
            </span>
            <span className="text-xs text-zinc-500">{card.label}</span>
          </div>
        ))}
      </div>

      <MissingReadingsPanel />
    </div>
  );
}

function MissingReadingsPanel() {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [missing, setMissing] = useState<MissingReadingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zoneFilter, setZoneFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [missingData, zoneData] = await Promise.all([
          listMissingReadings(monthValue),
          listZones(),
        ]);
        if (!cancelled) {
          setMissing(missingData);
          setZones(zoneData);
        }
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
  }, [monthValue]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return missing.filter((m) => {
      if (zoneFilter && m.zoneName !== zoneFilter) return false;
      if (!query) return true;
      return (
        m.roomName.toLowerCase().includes(query) || m.meterCode.toLowerCase().includes(query)
      );
    });
  }, [missing, zoneFilter, search]);

  const periodLabel = formatReadingPeriod(new Date(`${monthValue}-01T00:00:00.000Z`));

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">ห้องที่ยังไม่จดมิเตอร์ประจำเดือน</h3>

      <div className="flex flex-col gap-2 sm:flex-row">
        <MonthYearSelect value={monthValue} onChange={setMonthValue} />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">ทุกโซน</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.name}>
              {zone.name}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาห้องพักหรือรหัสมิเตอร์"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <p className="text-xs text-zinc-500">
        รอบ {periodLabel} — {loading ? "กำลังโหลด..." : `ยังไม่จดมิเตอร์ ${filtered.length} ห้อง`}
      </p>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr className="text-left">
                <th className="p-2">ห้องพัก</th>
                <th className="p-2">โซน</th>
                <th className="p-2">มิเตอร์</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-zinc-500">
                    {missing.length === 0
                      ? "จดมิเตอร์ครบทุกห้องแล้วสำหรับเดือนนี้"
                      : "ไม่พบรายการที่ตรงกับเงื่อนไข"}
                  </td>
                </tr>
              )}
              {filtered.map((m) => (
                <tr key={m.meterId} className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                  <td className="p-2">{m.roomName}</td>
                  <td className="p-2">{m.zoneName}</td>
                  <td className="p-2 font-semibold">{m.meterCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
