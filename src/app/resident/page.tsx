"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, History as HistoryIcon, Home, LogOut } from "lucide-react";
import BillingExplanation from "@/components/BillingExplanation";
import FtAnnouncements from "@/components/FtAnnouncements";
import MonthYearSelect from "@/components/MonthYearSelect";
import ResidentAuthGate from "@/components/resident/ResidentAuthGate";
import ResidentUsageHistory from "@/components/resident/ResidentUsageHistory";
import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import { fetchBillingConfig } from "@/lib/billing/billingConfigApi";
import { fetchFtForMonth } from "@/lib/billing/ftApi";
import type { BillingConfig } from "@/lib/billing/types";
import { getMockResidentHistory } from "@/lib/mock/mockData";
import { useMockMode } from "@/lib/mock/mockMode";
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
  const [mockMode] = useMockMode();
  const [room, setRoom] = useState<ResidentRoomRef | null>(session.room);

  // Mock data is a pure, synchronous computation — derived directly during
  // render via useMemo, never through setState-in-an-effect. Mock mode
  // skips fetchBillingConfig()/fetchFtForMonth()/fetchResidentHistory()
  // entirely below — none of them run, so nothing here ever touches the
  // database while it's on.
  const mockHistory = useMemo(() => (mockMode ? getMockResidentHistory() : null), [mockMode]);

  const [fetchedHistory, setFetchedHistory] = useState<ResidentHistoryDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  useEffect(() => {
    if (mockMode) return;
    fetchBillingConfig().then(setBillingConfig);
  }, [mockMode]);

  // Ft resolved for the selected month specifically (2026-09-17) — the
  // resident's own history table below already gets its per-reading Ft via
  // the server route (api/resident/history), this is only for the
  // recompute-on-the-client detail panel further down.
  const [resolvedFtRate, setResolvedFtRate] = useState<number | null>(null);

  useEffect(() => {
    if (mockMode) return;
    let cancelled = false;
    fetchFtForMonth(monthValue).then((rate) => {
      if (!cancelled) setResolvedFtRate(rate);
    });
    return () => {
      cancelled = true;
    };
  }, [monthValue, mockMode]);

  useEffect(() => {
    if (mockMode) return;
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
        if (!cancelled) setFetchedHistory(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, room, mockMode]);

  function handleRoomPicked(nextRoom: ResidentRoomRef) {
    setRoom(nextRoom);
    saveResidentSession({ ...session, room: nextRoom });
  }

  const history = mockMode ? mockHistory : fetchedHistory;
  const effectiveLoading = mockMode ? false : loading;
  const effectiveError = mockMode ? null : error;
  const displayRoom = mockMode ? (mockHistory?.room ?? null) : room;
  const showRoomPicker = !mockMode && !room;

  const selectedReading = useMemo(
    () => history?.readings.find((r) => r.readingMonth === monthValue) ?? null,
    [history, monthValue],
  );

  // "ประวัติการใช้งาน" below shows one calendar year at a time, by
  // explicit request — a long-term resident's full history (real or the
  // mock window) otherwise just keeps growing. Year options come from
  // whatever years actually appear in this resident's own data (not a
  // fixed/guessed range), newest first; defaults to the current year.
  // The month picker/detail panel above is unaffected — that's for
  // looking up one specific past bill, any year, not an overview list.
  const currentYearPrefix = useMemo(() => String(new Date().getFullYear()), []);
  const availableYears = useMemo(() => {
    const years = new Set((history?.readings ?? []).map((r) => r.readingMonth.slice(0, 4)));
    years.add(currentYearPrefix);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [history, currentYearPrefix]);
  const [selectedYear, setSelectedYear] = useState(currentYearPrefix);
  const yearReadings = useMemo(
    () => history?.readings.filter((r) => r.readingMonth.startsWith(selectedYear)) ?? [],
    [history, selectedYear],
  );

  return (
    <div className="surface-panel mx-auto my-3 flex w-[calc(100%-1.5rem)] max-w-md flex-col sm:my-8 gap-6 px-4 py-6">
      <header className="flex flex-col gap-1 border-b-2 border-primary-600 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-800 dark:text-primary-400">
            สวัสดี, {session.name}
          </h1>
          <button
            type="button"
            onClick={logout}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700 underline dark:text-primary-400"
          >
            <LogOut aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ออกจากระบบ
          </button>
        </div>
        <p className="text-xs text-zinc-400">{session.email}</p>
        <p className="flex items-center gap-1 text-sm text-zinc-500">
          <Home aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {displayRoom ? `ห้อง ${displayRoom.name} · โซน ${displayRoom.zoneName}` : "ยังไม่ได้เลือกห้องพัก"}
        </p>
      </header>

      <FtAnnouncements />

      {showRoomPicker && <RoomPicker userId={session.id} onPicked={handleRoomPicked} />}

      {!showRoomPicker && (
        <>
          {effectiveLoading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
          {effectiveError && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
              {effectiveError}
            </p>
          )}

          {!effectiveLoading && !effectiveError && history && (
            <>
              <section className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-600" />
                  เลือกเดือนดูค่าไฟ
                </p>
                <MonthYearSelect value={monthValue} onChange={setMonthValue} />
              </section>

              <section className="rounded-xl border border-primary-100 bg-primary-50/60 p-4 dark:border-primary-900 dark:bg-primary-950/20">
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
                    {mockMode && selectedReading.currentValue !== null ? (
                      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-primary-200 pt-2 text-sm dark:border-primary-900">
                        <span className="text-zinc-500">หน่วยที่ใช้</span>
                        <span>{selectedReading.usage ?? "-"}</span>
                        <span className="text-zinc-500">ค่าพื้นฐาน + FT</span>
                        <span>
                          {baht(
                            (selectedReading.billing.baseCharge ?? 0) +
                              (selectedReading.billing.ft ?? 0),
                          )}
                        </span>
                        <span className="text-zinc-500">VAT</span>
                        <span>{baht(selectedReading.billing.tax)}</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">ค่าไฟสุทธิ</span>
                        <span className="font-semibold">{baht(selectedReading.billing.total)}</span>
                      </div>
                    ) : (
                      billingConfig &&
                      selectedReading.currentValue !== null && (
                        <div className="mt-1 border-t border-primary-200 pt-2 dark:border-primary-900">
                          <BillingBreakdownPanel
                            confirmedValue={selectedReading.currentValue}
                            previousReading={selectedReading.previousValue}
                            config={billingConfig}
                            resolvedFtRate={resolvedFtRate}
                          />
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">ยังไม่มีข้อมูลการจดมิเตอร์สำหรับเดือนนี้</p>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <HistoryIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-600" />
                    ประวัติการใช้งาน
                  </p>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        ปี {Number(year) + 543}
                      </option>
                    ))}
                  </select>
                </div>
                <ResidentUsageHistory readings={yearReadings} />
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
    <section className="flex flex-col gap-2 rounded-xl border border-primary-300 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Home aria-hidden="true" className="h-4 w-4 shrink-0 text-primary-600" />
        เลือกห้องพักของตัวเอง
      </p>
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
        className="flex items-center gap-1.5 self-start rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary-700"
      >
        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
        {saving ? "กำลังบันทึก..." : "ยืนยันห้องนี้"}
      </button>
    </section>
  );
}
