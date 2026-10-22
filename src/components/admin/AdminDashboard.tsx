"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  Gauge,
  Home,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react";
import MonthYearSelect from "@/components/MonthYearSelect";
import MockDataToggle from "@/components/admin/MockDataToggle";
import { fetchDashboard, listMissingReadings, listZones } from "@/lib/admin/adminApi";
import type { AdminDashboardSummary, MissingReadingDTO, ZoneDTO } from "@/lib/admin/types";
import { getMockDashboardSummary } from "@/lib/mock/mockData";
import { useMockMode } from "@/lib/mock/mockMode";
import { currentMonthValue } from "@/lib/reading/readingMonth";
import { formatReadingPeriod } from "@/lib/admin/period";

const CARDS: { key: keyof AdminDashboardSummary; label: string; icon: LucideIcon }[] = [
  { key: "zoneCount", label: "โซน", icon: MapPin },
  { key: "roomCount", label: "ห้องพัก", icon: Home },
  { key: "meterCount", label: "มิเตอร์", icon: Gauge },
  { key: "userCount", label: "ผู้ใช้งาน", icon: Users },
  { key: "readingCount", label: "รายการอ่านมิเตอร์ทั้งหมด", icon: ClipboardList },
  { key: "readingCountThisMonth", label: "รายการอ่านมิเตอร์เดือนนี้", icon: CalendarCheck },
  { key: "syncErrorCount", label: "Sync ผิดพลาด", icon: AlertTriangle },
];

export default function AdminDashboard() {
  const [mockMode] = useMockMode();
  // Mock data is a pure, synchronous computation — derived directly during
  // render via useMemo, never through setState-in-an-effect, so turning
  // the toggle on/off never needs a render-then-fetch round trip.
  const mockSummary = useMemo(
    () => (mockMode ? getMockDashboardSummary() : null),
    [mockMode],
  );
  const [fetchedSummary, setFetchedSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mockMode) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboard();
        if (!cancelled) setFetchedSummary(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mockMode]);

  const summary = mockMode ? mockSummary : fetchedSummary;

  if (error && !mockMode) {
    return <p className="text-sm font-medium text-red-600">{error}</p>;
  }
  if (!summary) {
    return <p className="text-sm text-zinc-500">กำลังโหลด...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <MockDataToggle />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CARDS.map((card) => {
          const isAlert = card.key === "syncErrorCount" && summary[card.key] > 0;
          return (
            <div
              key={card.key}
              className={`flex flex-col gap-2 rounded-xl border-t-4 border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
                isAlert
                  ? "border-t-red-500 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                  : "border-t-primary-500 border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  isAlert
                    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                    : "bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400"
                }`}
              >
                <card.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {summary[card.key]}
              </span>
              <span className="text-xs text-zinc-500">{card.label}</span>
            </div>
          );
        })}
      </div>

      {mockMode ? (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800">
          ปิดใช้งาน &quot;ห้องที่ยังไม่จดมิเตอร์ประจำเดือน&quot; ชั่วคราวขณะแสดงข้อมูลตัวอย่าง
        </p>
      ) : (
        <MissingReadingsPanel />
      )}
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
      <h3 className="text-base font-semibold text-primary-800 dark:text-primary-400">ห้องที่ยังไม่จดมิเตอร์ประจำเดือน</h3>

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
                <tr key={m.meterId} className="border-t border-zinc-200 transition-colors hover:bg-primary-50/60 dark:border-zinc-800 dark:hover:bg-primary-950/10">
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
