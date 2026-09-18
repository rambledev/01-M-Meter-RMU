"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  createFt,
  deleteFtDocument,
  disableFt,
  enableFt,
  fetchFtByMonth,
  fetchFtHistory,
  updateFt,
  uploadFtDocument,
} from "@/lib/admin/ftApi";
import type { FtHistoryEntryDTO, FtRateDTO } from "@/lib/admin/types";
import { currentMonthValue, formatMonthThai } from "@/lib/reading/readingMonth";
import MonthYearSelect from "@/components/MonthYearSelect";

const ACTION_LABEL: Record<FtHistoryEntryDTO["action"], string> = {
  CREATE: "สร้าง",
  UPDATE: "แก้ไข",
  DISABLE: "ปิดใช้งาน",
  ENABLE: "เปิดใช้งาน",
};

function formatDateTimeThai(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

// Admin tab "ค่า Ft" (2026-09-17) — Monthly Ft management: select a month,
// see/create/edit/disable/enable that month's Ft, attach announcement
// document(s), and view its append-only change history. A separate
// component from BillingSettingsManagement.tsx on purpose: Ft is now keyed
// by readingMonth (one record per calendar month, never an effective-date
// range) — a fundamentally different shape from the tariff tiers/service
// charge settings that component still owns.
export default function FtRateManagement() {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [ft, setFt] = useState<FtRateDTO | null | undefined>(undefined); // undefined = loading
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ftRateInput, setFtRateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<FtHistoryEntryDTO[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFt(undefined);
      setLoadError(null);
      setSavedMessage(null);
      setFormError(null);
      setHistoryOpen(false);
      setHistory(null);
      try {
        const result = await fetchFtByMonth(monthValue);
        if (cancelled) return;
        setFt(result);
        setFtRateInput(result ? String(result.ftRate) : "");
        setNotesInput(result?.notes ?? "");
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthValue]);

  async function reload() {
    const result = await fetchFtByMonth(monthValue);
    setFt(result);
    return result;
  }

  async function handleSave() {
    setFormError(null);
    setSavedMessage(null);
    const rate = Number(ftRateInput);
    if (!Number.isFinite(rate) || rate < 0) {
      setFormError("กรุณาระบุค่า Ft ให้ถูกต้อง (ต้องไม่ติดลบ)");
      return;
    }
    setBusy(true);
    try {
      if (ft) {
        await updateFt(ft.id, { ftRate: rate, notes: notesInput.trim() || null });
        setSavedMessage("บันทึกการแก้ไข Ft แล้ว");
      } else {
        await createFt({ readingMonth: monthValue, ftRate: rate, notes: notesInput.trim() || null });
        setSavedMessage("สร้าง Ft เดือนนี้แล้ว");
      }
      await reload();
      setHistory(null); // ต้องโหลดประวัติใหม่ถ้าเปิดดูอยู่
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus() {
    if (!ft) return;
    setBusy(true);
    setFormError(null);
    setSavedMessage(null);
    try {
      if (ft.status === "ACTIVE") {
        await disableFt(ft.id);
        setSavedMessage("ปิดใช้งาน Ft เดือนนี้แล้ว");
      } else {
        await enableFt(ft.id);
        setSavedMessage("เปิดใช้งาน Ft เดือนนี้แล้ว");
      }
      await reload();
      setHistory(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadDocument(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ft) return;
    setDocumentBusy(true);
    setDocumentError(null);
    try {
      const updated = await uploadFtDocument(ft.id, file);
      setFt(updated);
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!ft) return;
    if (!window.confirm("ลบเอกสารนี้ใช่หรือไม่?")) return;
    setDocumentBusy(true);
    setDocumentError(null);
    try {
      const updated = await deleteFtDocument(ft.id, docId);
      setFt(updated);
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleToggleHistory() {
    if (!ft) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history === null) {
      setHistoryLoading(true);
      try {
        setHistory(await fetchFtHistory(ft.id));
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">ค่า Ft รายเดือน</h3>
      <p className="text-xs text-zinc-500">
        Ft ผูกกับเดือนโดยตรง (1 เดือน = 1 ค่า) — ไม่ใช่ช่วงวันที่มีผล การคำนวณค่าไฟของแต่ละเดือนจะใช้ Ft ของเดือนนั้นเสมอ
        เดือนที่ยังไม่ได้กำหนดค่าจะไม่คำนวณยอดค่าไฟ
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold" htmlFor="ft-month">
          เดือน
        </label>
        <MonthYearSelect id="ft-month" value={monthValue} onChange={setMonthValue} />
        <p className="text-sm text-zinc-500">{formatMonthThai(monthValue)}</p>
      </div>

      {loadError && <p className="text-sm font-medium text-red-600">{loadError}</p>}

      {ft === undefined ? (
        <p className="text-sm text-zinc-500">กำลังโหลด...</p>
      ) : (
        <>
          {!ft && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
              ยังไม่ได้กำหนดค่า Ft สำหรับเดือนนี้
            </p>
          )}
          {ft && (
            <p className="text-sm">
              สถานะ:{" "}
              <span className={ft.status === "ACTIVE" ? "font-semibold text-emerald-700" : "font-semibold text-zinc-500"}>
                {ft.status === "ACTIVE" ? "ใช้งานอยู่" : "ปิดใช้งาน"}
              </span>{" "}
              · สร้างโดย {ft.createdByName}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="ft-rate-value">
              Ft (บาท/หน่วย)
            </label>
            <input
              id="ft-rate-value"
              type="number"
              step="any"
              value={ftRateInput}
              onChange={(e) => {
                setSavedMessage(null);
                setFtRateInput(e.target.value);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="ft-notes">
              หมายเหตุ
            </label>
            <textarea
              id="ft-notes"
              value={notesInput}
              onChange={(e) => {
                setSavedMessage(null);
                setNotesInput(e.target.value);
              }}
              rows={2}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
          {savedMessage && (
            <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">
              {savedMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
            >
              {ft ? "บันทึกการแก้ไข" : "สร้าง Ft เดือนนี้"}
            </button>
            {ft && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={busy}
                className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50 dark:border-zinc-700"
              >
                {ft.status === "ACTIVE" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            )}
          </div>

          {/* Documents */}
          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="text-sm font-semibold">เอกสารประกาศ Ft เดือนนี้</p>
            {!ft && (
              <p className="text-xs text-zinc-500">ต้องสร้าง Ft ของเดือนนี้ก่อน จึงจะแนบเอกสารได้</p>
            )}
            {ft && (
              <>
                {ft.documents.length === 0 ? (
                  <p className="text-sm text-zinc-500">ยังไม่ได้แนบเอกสาร</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {ft.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                      >
                        <a
                          href={doc.storagePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-700 underline dark:text-emerald-400"
                        >
                          📎 {doc.originalName}
                        </a>
                        <span className="text-xs text-zinc-500">
                          อัปโหลดโดย {doc.uploadedByName} · {formatDateTimeThai(doc.uploadedAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={documentBusy}
                          className="ml-auto rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
                        >
                          ลบ
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleUploadDocument}
                  disabled={documentBusy}
                  className="text-sm"
                />
                {documentBusy && <p className="text-xs text-zinc-500">กำลังดำเนินการ...</p>}
                {documentError && <p className="text-sm font-medium text-red-600">{documentError}</p>}
              </>
            )}
          </div>

          {/* History */}
          {ft && (
            <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <button
                type="button"
                onClick={handleToggleHistory}
                className="self-start rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-700"
              >
                {historyOpen ? "ซ่อนประวัติ Ft" : "ดูประวัติ Ft"}
              </button>
              {historyOpen && (
                <div className="overflow-x-auto">
                  {historyLoading ? (
                    <p className="text-sm text-zinc-500">กำลังโหลด...</p>
                  ) : (
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500">
                          <th className="pb-1 pr-2">วันที่</th>
                          <th className="pb-1 pr-2">Action</th>
                          <th className="pb-1 pr-2">ค่าเดิม</th>
                          <th className="pb-1 pr-2">ค่าใหม่</th>
                          <th className="pb-1 pr-2">ผู้ดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(history ?? []).map((entry) => (
                          <tr key={entry.id} className="border-t border-zinc-200 dark:border-zinc-800">
                            <td className="py-1 pr-2">{formatDateTimeThai(entry.performedAt)}</td>
                            <td className="py-1 pr-2">{ACTION_LABEL[entry.action]}</td>
                            <td className="py-1 pr-2">{entry.oldValue ?? "-"}</td>
                            <td className="py-1 pr-2">{entry.newValue ?? "-"}</td>
                            <td className="py-1 pr-2">{entry.performedByName}</td>
                          </tr>
                        ))}
                        {(history ?? []).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-2 text-center text-zinc-500">
                              ไม่มีประวัติ
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
