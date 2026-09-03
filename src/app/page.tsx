"use client";

import { useEffect, useState } from "react";
import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import BillingExplanation from "@/components/BillingExplanation";
import BillingSettingsPanel from "@/components/BillingSettingsPanel";
import CameraCapture from "@/components/CameraCapture";
import ExportExcelButton from "@/components/ExportExcelButton";
import OnlineStatusBadge from "@/components/OnlineStatusBadge";
import ReadingHistoryList from "@/components/ReadingHistoryList";
import type { BillingConfig } from "@/lib/billing/types";
import { compressImage } from "@/lib/image/compressImage";
import { demoMeters, demoUser } from "@/lib/meters/demoData";
import { lookupMeter, type DemoMeter } from "@/lib/meters/meterLookup";
import { getBillingConfig } from "@/lib/offline/billingConfigRepository";
import type { LocalReading } from "@/lib/offline/db";
import { getReadings } from "@/lib/offline/readingRepository";
import { getPendingQueueItems } from "@/lib/offline/syncQueueRepository";
import { recognizeMeterValue } from "@/lib/ocr/ocrProvider";
import {
  currentMonthValue,
  formatMonthThai,
  isFutureMonth,
  toReadingMonth,
} from "@/lib/reading/readingMonth";
import {
  checkDuplicateReading,
  lookupPreviousReading,
  saveOfflineReading,
} from "@/lib/reading/readingWorkflow";
import { syncPendingReadings } from "@/lib/sync/syncService";

type OcrStatus = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [meterCodeInput, setMeterCodeInput] = useState("");
  const [meter, setMeter] = useState<DemoMeter | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [previousReading, setPreviousReading] = useState<number | undefined>();
  const [previousFound, setPreviousFound] = useState(false);
  const [duplicateReading, setDuplicateReading] = useState<
    LocalReading | undefined
  >();

  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(
    null,
  );
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(
    null,
  );
  const [ocrValue, setOcrValue] = useState("");
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [currentValueInput, setCurrentValueInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedReading, setSavedReading] = useState<LocalReading | null>(null);

  const [history, setHistory] = useState<LocalReading[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  useEffect(() => {
    getBillingConfig().then(setBillingConfig);
  }, []);

  const readingMonth = toReadingMonth(monthValue);
  const currentValueNumber =
    currentValueInput.trim() === "" ? undefined : Number(currentValueInput);
  const hasValidCurrentValue =
    currentValueNumber !== undefined && !Number.isNaN(currentValueNumber);
  const usage = hasValidCurrentValue
    ? previousReading !== undefined
      ? currentValueNumber - previousReading
      : undefined
    : undefined;
  const showLowerThanPreviousWarning =
    hasValidCurrentValue &&
    previousReading !== undefined &&
    currentValueNumber < previousReading;

  async function refreshHistory() {
    const all = await getReadings();
    setHistory(
      [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async function refreshPendingCount() {
    const pending = await getPendingQueueItems();
    setPendingCount(pending.length);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, pending] = await Promise.all([
        getReadings(),
        getPendingQueueItems(),
      ]);
      if (cancelled) return;
      setHistory([...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPendingCount(pending.length);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      await Promise.all([refreshHistory(), refreshPendingCount()]);
    } finally {
      setIsSyncing(false);
    }
  }

  // Reload Previous Reading + best-effort duplicate check whenever the
  // selected meter or month changes (requirement.md §3.1, §3.2). Nothing
  // downstream reads these values while `meter` is null (all guarded by
  // `{meter && (...)}` below), so there is nothing to reset synchronously.
  useEffect(() => {
    if (!meter) return;
    let cancelled = false;
    (async () => {
      const [prev, dup] = await Promise.all([
        lookupPreviousReading(meter.id, readingMonth),
        checkDuplicateReading(meter.id, readingMonth),
      ]);
      if (cancelled) return;
      setPreviousReading(prev.value);
      setPreviousFound(prev.found);
      setDuplicateReading(dup);
    })();
    return () => {
      cancelled = true;
    };
  }, [meter, readingMonth]);

  function resetPhoto() {
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageBlob(null);
    setCapturedImageUrl(null);
    setOcrValue("");
    setOcrStatus("idle");
    setOcrError(null);
  }

  function selectMeter(next: DemoMeter) {
    setMeter(next);
    setMeterCodeInput(next.code);
    setLookupError(null);
    setMonthValue(currentMonthValue());
    setCurrentValueInput("");
    setSaveError(null);
    setSavedReading(null);
    resetPhoto();
  }

  function handleLookup() {
    const found = lookupMeter(meterCodeInput);
    if (!found) {
      setMeter(null);
      setLookupError("ไม่พบมิเตอร์รหัสนี้");
      return;
    }
    selectMeter(found);
  }

  function handleMonthChange(value: string) {
    if (isFutureMonth(value)) {
      setSaveError("ห้ามเลือกเดือนอนาคต");
      return;
    }
    setSaveError(null);
    setSavedReading(null);
    setMonthValue(value);
    resetPhoto();
    setCurrentValueInput("");
  }

  // Original full photo only — never an OCR crop (requirement.md §3.3,
  // decision-log.md). Compression re-encodes the same full frame smaller,
  // it does not crop it.
  async function handleImageCaptured(rawBlob: Blob) {
    const compressed = await compressImage(rawBlob);
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageBlob(compressed);
    setCapturedImageUrl(URL.createObjectURL(compressed));
    setOcrValue("");
    setOcrStatus("idle");
    setOcrError(null);
    setCurrentValueInput("");
  }

  async function handleRunOcr() {
    if (!capturedImageBlob) return;
    setOcrStatus("loading");
    setOcrError(null);
    try {
      const text = await recognizeMeterValue(capturedImageBlob);
      setOcrValue(text);
      setCurrentValueInput(text);
      setOcrStatus("done");
    } catch {
      setOcrStatus("error");
      setOcrError(
        "อ่านค่าอัตโนมัติไม่สำเร็จ (ครั้งแรกต้องต่ออินเทอร์เน็ตเพื่อโหลด OCR) กรุณากรอกค่าด้วยตนเอง",
      );
    }
  }

  const canSave =
    meter !== null &&
    hasValidCurrentValue &&
    !isFutureMonth(monthValue) &&
    !duplicateReading &&
    !savedReading &&
    capturedImageBlob !== null;

  async function handleConfirmSave() {
    if (!meter || currentValueNumber === undefined || !capturedImageBlob)
      return;
    setSaveError(null);
    try {
      const { reading } = await saveOfflineReading({
        meterId: meter.id,
        readingMonth,
        recordedBy: demoUser.id,
        previousReading,
        confirmedValue: currentValueNumber,
        ocrValue: ocrValue || undefined,
        image: {
          blob: capturedImageBlob,
          mimeType: capturedImageBlob.type || "image/jpeg",
        },
      });
      setSavedReading(reading);
      setCurrentValueInput("");
      resetPhoto();
      await Promise.all([refreshHistory(), refreshPendingCount()]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">RMU Meter Collection</h1>
        <OnlineStatusBadge />
      </header>

      {/* Sync */}
      {(pendingCount > 0 || syncMessage) && (
        <section className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
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
              className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
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

      {/* Meter lookup */}
      <section className="flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="meter-code">
          Meter Code / Scan
        </label>
        <div className="flex gap-2">
          <input
            id="meter-code"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="เช่น ME-001 หรือ METER:ME-001"
            value={meterCodeInput}
            onChange={(e) => setMeterCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
          />
          <button
            type="button"
            onClick={handleLookup}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            ค้นหา
          </button>
        </div>
        {lookupError && (
          <p className="text-sm font-medium text-red-600">{lookupError}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-zinc-500">
            เลือกจาก Demo:
          </span>
          {demoMeters.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => selectMeter(m)}
              className={`rounded-full border px-3 py-1 text-sm ${
                meter?.id === m.id
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {m.code}
            </button>
          ))}
        </div>
      </section>

      {meter && (
        <>
          {/* Meter info */}
          <section className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <p className="text-xl font-bold">{meter.code}</p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {meter.room.name}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {meter.room.zone.name}
            </p>
          </section>

          {/* Reading month */}
          <section className="flex flex-col gap-1">
            <label className="text-sm font-semibold" htmlFor="reading-month">
              เดือนอ่าน
            </label>
            <input
              id="reading-month"
              type="month"
              max={currentMonthValue()}
              value={monthValue}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="text-sm text-zinc-500">{formatMonthThai(monthValue)}</p>
          </section>

          {savedReading ? (
            <section className="flex flex-col gap-3 rounded-xl border border-green-400 bg-green-50 p-4 text-sm text-green-900">
              <p className="text-base font-semibold">
                บันทึกสำเร็จ — สถานะ {savedReading.status}
              </p>
              <p>ครั้งก่อน: {savedReading.previousReading ?? "-"}</p>
              <p>ครั้งนี้: {savedReading.confirmedValue ?? "-"}</p>
              <p>ใช้ไป: {savedReading.usage ?? "-"} หน่วย</p>
              {billingConfig && savedReading.confirmedValue !== undefined && (
                <BillingBreakdownPanel
                  confirmedValue={savedReading.confirmedValue}
                  previousReading={savedReading.previousReading ?? null}
                  config={billingConfig}
                />
              )}
              <button
                type="button"
                onClick={() => setSavedReading(null)}
                className="self-start rounded-lg bg-green-700 px-4 py-2 font-semibold text-white"
              >
                ปิด
              </button>
            </section>
          ) : duplicateReading ? (
            <section className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                มีการบันทึกมิเตอร์นี้ในเดือนนี้แล้ว
              </p>
              <p className="mt-1">
                ค่าที่เคยบันทึก: {duplicateReading.confirmedValue ?? "-"}
              </p>
              <p>
                ผู้บันทึก:{" "}
                {duplicateReading.recordedBy === demoUser.id
                  ? demoUser.name
                  : duplicateReading.recordedBy}
              </p>
              <p>
                วันที่บันทึก:{" "}
                {duplicateReading.recordedAt
                  ? new Date(duplicateReading.recordedAt).toLocaleString(
                      "th-TH",
                    )
                  : "-"}
              </p>
            </section>
          ) : (
            <>
              {/* Previous reading */}
              <section className="flex flex-col gap-1">
                <p className="text-sm font-semibold">ครั้งก่อน</p>
                <p className="text-2xl font-bold">
                  {previousFound ? previousReading : "ไม่พบค่าครั้งก่อน"}
                </p>
              </section>

              {/* Camera */}
              <section className="flex flex-col gap-2">
                <p className="text-sm font-semibold">ภาพมิเตอร์</p>
                {!capturedImageBlob ? (
                  <CameraCapture onCapture={handleImageCaptured} />
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturedImageUrl ?? undefined}
                      alt="ภาพมิเตอร์ที่ถ่าย"
                      className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={resetPhoto}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
                    >
                      ถ่ายใหม่
                    </button>

                    <button
                      type="button"
                      onClick={handleRunOcr}
                      disabled={ocrStatus === "loading"}
                      className="rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {ocrStatus === "loading"
                        ? "กำลังอ่านตัวเลข..."
                        : "🔎 อ่านตัวเลข"}
                    </button>

                    {ocrStatus === "done" && (
                      <p className="text-sm text-zinc-500">
                        OCR: <span className="font-semibold">{ocrValue || "(ว่าง)"}</span>
                      </p>
                    )}
                    {ocrError && (
                      <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
                        {ocrError}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {capturedImageBlob && (
                <>
                  {/* Current reading */}
                  <section className="flex flex-col gap-1">
                    <label
                      className="text-sm font-semibold"
                      htmlFor="current-value"
                    >
                      แก้ไขค่าที่อ่านได้ / ครั้งนี้
                    </label>
                    <input
                      id="current-value"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={currentValueInput}
                      onChange={(e) => setCurrentValueInput(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-3 text-xl dark:border-zinc-700 dark:bg-zinc-900"
                      placeholder="กรอกค่ามิเตอร์ปัจจุบัน"
                    />
                  </section>

                  {showLowerThanPreviousWarning && (
                    <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
                      ค่าที่กรอกน้อยกว่าค่าครั้งก่อน โปรดตรวจสอบอีกครั้ง
                    </p>
                  )}

                  {usage !== undefined && (
                    <p className="text-lg">
                      ใช้ไป <span className="font-bold">{usage}</span> หน่วย
                    </p>
                  )}

                  {/* Confirmation card */}
                  <section className="flex flex-col gap-1 rounded-xl border border-zinc-300 p-4 text-sm dark:border-zinc-700">
                    <p className="mb-1 font-semibold">ตรวจสอบก่อนบันทึก</p>
                    <p>Meter: {meter.code}</p>
                    <p>ห้อง: {meter.room.name}</p>
                    <p>Zone: {meter.room.zone.name}</p>
                    <p>เดือน: {formatMonthThai(monthValue)}</p>
                    <p>ค่าครั้งก่อน: {previousFound ? previousReading : "-"}</p>
                    <p>
                      ค่าครั้งนี้: {hasValidCurrentValue ? currentValueNumber : "-"}
                    </p>
                    <p>หน่วยที่ใช้: {usage ?? "-"}</p>
                    <p>สถานะ: PENDING_SYNC (จนกว่าจะ sync สำเร็จ)</p>
                    <p className="mt-1 text-zinc-500">ภาพ: แนบแล้ว ✓</p>
                  </section>

                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={handleConfirmSave}
                    className="rounded-lg bg-green-600 px-4 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
                  >
                    ยืนยันและบันทึก
                  </button>

                  {saveError && (
                    <p className="text-sm font-medium text-red-600">
                      {saveError}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* History */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">ประวัติที่บันทึกในเครื่อง</h2>
        <ReadingHistoryList readings={history} billingConfig={billingConfig} />
      </section>

      {billingConfig && <BillingExplanation config={billingConfig} />}

      <BillingSettingsPanel onSaved={setBillingConfig} />

      <ExportExcelButton billingConfig={billingConfig} />
    </div>
  );
}
