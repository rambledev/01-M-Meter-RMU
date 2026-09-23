"use client";

import { useEffect, useMemo, useState } from "react";
import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import BillingExplanation from "@/components/BillingExplanation";
import FtAnnouncements from "@/components/FtAnnouncements";
import MonthYearSelect from "@/components/MonthYearSelect";
import ResidentAuthGate from "@/components/resident/ResidentAuthGate";
import { fetchBillingConfig } from "@/lib/billing/billingConfigApi";
import { fetchFtForMonth } from "@/lib/billing/ftApi";
import type { BillingConfig } from "@/lib/billing/types";
import { currentMonthValue } from "@/lib/reading/readingMonth";
import { fetchResidentHistory } from "@/lib/resident/residentHistoryApi";
import { fetchRoomOptions, setResidentRoom } from "@/lib/resident/residentRoomApi";
import { saveResidentSession } from "@/lib/resident/residentSession";
import type {
  ResidentHistoryDTO,
  ResidentRoomRef,
  ResidentSession,
  RoomOption,
} from "@/lib/resident/types";
import {
  READING_STATUS_COLOR,
  READING_STATUS_LABEL,
  type ReadingStatusValue,
} from "@/lib/reading/readingStatusLabels";

function baht(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ผู้พักอาศัย (Resident role, 2026-09-09) — read-only: their own room's
// reading history + bill amount, month-selectable. Strictly scoped
// server-side to their own residentRoomId (src/app/api/resident/history) —
// this page never asks for/accepts any other room's data. Google login
// alone doesn't know which room is theirs yet on the very first login (no
// prior data linked email to room), so a one-time self-service room picker
// sits in front of the history view — but ONLY for that first pick.
// Residents can never re-pick their own room afterwards (2026-09-10, both
// here and enforced server-side in src/app/api/resident/room) — allowing
// that would let anyone browse any other room's data at will. Only an
// Admin can change the User↔Room link once set (src/components/admin/UserManagement.tsx).
export default function ResidentPage() {
  return (
    <ResidentAuthGate>
      {(session, logout) => <ResidentHome session={session} logout={logout} />}
    </ResidentAuthGate>
  );
}

function ResidentHome({ session, logout }: { session: ResidentSession; logout: () => void }) {
  const [room, setRoom] = useState<ResidentRoomRef | null>(session.room);

  const [history, setHistory] = useState<ResidentHistoryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  useEffect(() => {
    fetchBillingConfig().then(setBillingConfig);
  }, []);

  // Ft resolved for the selected month specifically (2026-09-17) — the
  // resident's own history table below already gets its per-reading Ft via
  // the server route (api/resident/history), this is only for the
  // recompute-on-the-client detail panel further down.
  const [resolvedFtRate, setResolvedFtRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFtForMonth(monthValue).then((rate) => {
      if (!cancelled) setResolvedFtRate(rate);
    });
    return () => {
      cancelled = true;
    };
  }, [monthValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!room) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchResidentHistory(session.id);
        if (!cancelled) setHistory(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, room]);

  function handleRoomPicked(nextRoom: ResidentRoomRef) {
    setRoom(nextRoom);
    saveResidentSession({ ...session, room: nextRoom });
  }

  const selectedReading = useMemo(
    () => history?.readings.find((r) => r.readingMonth === monthValue) ?? null,
    [history, monthValue],
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1 border-b-2 border-emerald-600 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
            สวัสดี, {session.name}
          </h1>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            ออกจากระบบ
          </button>
        </div>
        <p className="text-xs text-zinc-400">{session.email}</p>
        <p className="text-sm text-zinc-500">
          {room ? `ห้อง ${room.name} · โซน ${room.zoneName}` : "ยังไม่ได้เลือกห้องพัก"}
        </p>
      </header>

      <FtAnnouncements />

      {!room && <RoomPicker userId={session.id} onPicked={handleRoomPicked} />}

      {room && (
        <>
          {loading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
          {error && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">{error}</p>
          )}

          {!loading && !error && history && (
            <>
              <section className="flex flex-col gap-2">
                <p className="text-sm font-semibold">เลือกเดือนดูค่าไฟ</p>
                <MonthYearSelect value={monthValue} onChange={setMonthValue} />
              </section>

              <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                {selectedReading ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">
                      มิเตอร์ {selectedReading.meterCode} · รอบ {selectedReading.period}
                    </p>
                    <p>
                      ค่าครั้งก่อน: {selectedReading.previousValue ?? "-"} → ค่าครั้งนี้:{" "}
                      {selectedReading.currentValue ?? "-"}
                    </p>
                    <span
                      className={`self-start rounded-full px-2 py-0.5 text-xs font-semibold ${
                        READING_STATUS_COLOR[selectedReading.status as ReadingStatusValue]
                      }`}
                    >
                      {READING_STATUS_LABEL[selectedReading.status as ReadingStatusValue] ??
                        selectedReading.status}
                    </span>
                    {billingConfig && selectedReading.currentValue !== null && (
                      <div className="mt-1 border-t border-emerald-200 pt-2 dark:border-emerald-900">
                        <BillingBreakdownPanel
                          confirmedValue={selectedReading.currentValue}
                          previousReading={selectedReading.previousValue}
                          config={billingConfig}
                          resolvedFtRate={resolvedFtRate}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">ยังไม่มีข้อมูลการจดมิเตอร์สำหรับเดือนนี้</p>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <p className="text-sm font-semibold">ประวัติทั้งหมด</p>
                {history.readings.length === 0 ? (
                  <p className="text-sm text-zinc-500">ยังไม่มีประวัติการจดมิเตอร์</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead className="bg-zinc-100 dark:bg-zinc-900">
                        <tr className="text-left">
                          <th className="p-2">รอบ</th>
                          <th className="p-2">มิเตอร์</th>
                          <th className="p-2">หน่วยที่ใช้</th>
                          <th className="p-2">ค่าไฟ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.readings.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10"
                          >
                            <td className="p-2 font-semibold">{r.period}</td>
                            <td className="p-2">{r.currentValue ?? "-"}</td>
                            <td className="p-2">{r.usage ?? "-"}</td>
                            <td className="p-2">{baht(r.billing.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {billingConfig && (
                <BillingExplanation config={billingConfig} label="สูตรการคำนวณค่าไฟ" />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function RoomPicker({
  userId,
  onPicked,
}: {
  userId: string;
  onPicked: (room: ResidentRoomRef) => void;
}) {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRoomOptions();
        if (!cancelled) setRooms(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดรายชื่อห้องไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConfirm() {
    if (!selectedRoomId) return;
    setSaving(true);
    setError(null);
    try {
      const room = await setResidentRoom(userId, selectedRoomId);
      onPicked(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกห้องไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
      <p className="text-sm font-semibold">เลือกห้องพักของตัวเอง</p>
      <p className="text-xs text-zinc-500">
        ระบบยังไม่ทราบว่าอีเมลนี้พักห้องใด — กรุณาเลือกห้องของตัวเองเพื่อดูประวัติและค่าไฟ
        เลือกได้ครั้งเดียวเท่านั้น หากต้องการเปลี่ยนภายหลังกรุณาติดต่อผู้ดูแลระบบ
      </p>
      {loading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
      {!loading && rooms.length === 0 && (
        <p className="text-sm text-zinc-500">ยังไม่มีข้อมูลห้องพักในระบบ</p>
      )}
      {!loading && rooms.length > 0 && (
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">— เลือกห้อง —</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name} ({room.zoneName})
            </option>
          ))}
        </select>
      )}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selectedRoomId || saving}
        className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
      >
        {saving ? "กำลังบันทึก..." : "ยืนยันห้องนี้"}
      </button>
    </section>
  );
}
