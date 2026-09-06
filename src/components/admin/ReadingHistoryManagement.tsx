"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { listReadingHistory, listZones } from "@/lib/admin/adminApi";
import type { ReadingHistoryDTO, ZoneDTO } from "@/lib/admin/types";
import {
  READING_STATUS_COLOR,
  READING_STATUS_LABEL,
  type ReadingStatusValue,
} from "@/lib/reading/readingStatusLabels";

function statusLabel(status: string): string {
  return READING_STATUS_LABEL[status as ReadingStatusValue] ?? status;
}
function statusColor(status: string): string {
  return (
    READING_STATUS_COLOR[status as ReadingStatusValue] ??
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
  );
}
function fmt(value: number | null): string {
  return value === null ? "-" : String(value);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH");
}

interface MeterSummary {
  meterId: string;
  meterCode: string;
  roomName: string;
  zoneName: string;
  count: number;
  latestReadingMonth: string;
  latestPeriod: string;
  latestCurrentValue: number | null;
  latestStatus: string;
}

// ประวัติการจดมิเตอร์ (admin) — one summary row per Meter (latest reading +
// count), with a per-row "ดูประวัติทั้งหมด" button that expands the full
// reading history for just that meter (Phase kickoff, 2026-09-04). Data
// comes from PostgreSQL only, read-only (no edit/delete here).
export default function ReadingHistoryManagement() {
  const [readings, setReadings] = useState<ReadingHistoryDTO[]>([]);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zoneFilter, setZoneFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedMeterId, setExpandedMeterId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [readingData, zoneData] = await Promise.all([listReadingHistory(), listZones()]);
        if (!cancelled) {
          setReadings(readingData);
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
  }, []);

  // readings are already sorted newest-first by the API (orderBy readingMonth desc)
  const summaries = useMemo<MeterSummary[]>(() => {
    const byMeter = new Map<string, ReadingHistoryDTO[]>();
    for (const r of readings) {
      const list = byMeter.get(r.meterId) ?? [];
      list.push(r);
      byMeter.set(r.meterId, list);
    }
    return Array.from(byMeter.values()).map((list) => {
      const latest = list[0];
      return {
        meterId: latest.meterId,
        meterCode: latest.meterCode,
        roomName: latest.roomName,
        zoneName: latest.zoneName,
        count: list.length,
        latestReadingMonth: latest.readingMonth,
        latestPeriod: latest.period,
        latestCurrentValue: latest.currentValue,
        latestStatus: latest.status,
      };
    });
  }, [readings]);

  const filteredSummaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return summaries
      .filter((s) => {
        if (zoneFilter && s.zoneName !== zoneFilter) return false;
        if (!query) return true;
        return (
          s.roomName.toLowerCase().includes(query) ||
          s.meterCode.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.latestReadingMonth.localeCompare(a.latestReadingMonth));
  }, [summaries, zoneFilter, search]);

  if (error) {
    return <p className="text-sm font-medium text-red-600">{error}</p>;
  }
  if (loading) {
    return <p className="text-sm text-zinc-500">กำลังโหลด...</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">ประวัติการจดมิเตอร์</h3>
      <p className="text-xs text-zinc-500">รูปแบบรอบ: เดือน (2 หลัก)/ปี พ.ศ. เช่น 01/2569 = มกราคม 2569</p>

      <div className="flex flex-col gap-2 sm:flex-row">
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

      <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="p-2">มิเตอร์</th>
              <th className="p-2">ห้องพัก</th>
              <th className="p-2">โซน</th>
              <th className="p-2">จำนวนรอบที่บันทึก</th>
              <th className="p-2">รอบล่าสุด</th>
              <th className="p-2">ค่าล่าสุด</th>
              <th className="p-2">สถานะล่าสุด</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredSummaries.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3 text-center text-zinc-500">
                  {readings.length === 0 ? "ยังไม่มีประวัติการจดมิเตอร์" : "ไม่พบรายการที่ตรงกับเงื่อนไข"}
                </td>
              </tr>
            )}
            {filteredSummaries.map((s) => {
              const isExpanded = expandedMeterId === s.meterId;
              const history = readings
                .filter((r) => r.meterId === s.meterId)
                .sort((a, b) => b.readingMonth.localeCompare(a.readingMonth));
              return (
                <Fragment key={s.meterId}>
                  <tr className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                    <td className="p-2 font-semibold">{s.meterCode}</td>
                    <td className="p-2">{s.roomName}</td>
                    <td className="p-2">{s.zoneName}</td>
                    <td className="p-2">{s.count}</td>
                    <td className="p-2">{s.latestPeriod}</td>
                    <td className="p-2">{fmt(s.latestCurrentValue)}</td>
                    <td className="p-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${statusColor(s.latestStatus)}`}
                      >
                        {statusLabel(s.latestStatus)}
                      </span>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpandedMeterId(isExpanded ? null : s.meterId)}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      >
                        {isExpanded ? "ซ่อนประวัติ" : "ดูประวัติทั้งหมด"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <td colSpan={8} className="p-2">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[600px] text-xs">
                            <thead>
                              <tr className="text-left text-zinc-500">
                                <th className="p-1">รอบ</th>
                                <th className="p-1">ครั้งก่อน</th>
                                <th className="p-1">ครั้งนี้</th>
                                <th className="p-1">หน่วยที่ใช้</th>
                                <th className="p-1">สถานะ</th>
                                <th className="p-1">ผู้บันทึก</th>
                                <th className="p-1">วันที่บันทึก</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map((r) => (
                                <tr key={r.id} className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                                  <td className="p-1 font-semibold">{r.period}</td>
                                  <td className="p-1">{fmt(r.previousValue)}</td>
                                  <td className="p-1">{fmt(r.currentValue)}</td>
                                  <td className="p-1">{fmt(r.usage)}</td>
                                  <td className="p-1">
                                    <span
                                      className={`rounded-full px-2 py-0.5 ${statusColor(r.status)}`}
                                    >
                                      {statusLabel(r.status)}
                                    </span>
                                  </td>
                                  <td className="p-1">{r.recordedByName}</td>
                                  <td className="p-1">{fmtDate(r.recordedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
