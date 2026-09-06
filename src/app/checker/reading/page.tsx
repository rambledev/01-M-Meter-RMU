"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import CameraCapture from "@/components/CameraCapture";
import MonthYearSelect from "@/components/MonthYearSelect";
import CheckerAuthGate from "@/components/checker/CheckerAuthGate";
import { fetchBillingConfig } from "@/lib/billing/billingConfigApi";
import type { BillingConfig } from "@/lib/billing/types";
import { resolveRecorderName } from "@/lib/checker/resolveRecorderName";
import type { CheckerSession } from "@/lib/checker/types";
import { compressImage } from "@/lib/image/compressImage";
import { fetchMeters } from "@/lib/meters/meterApi";
import { findMeterById } from "@/lib/meters/meterLookup";
import type { MeterInfo } from "@/lib/meters/types";
import type { LocalReading } from "@/lib/offline/db";
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

type OcrStatus = "idle" | "loading" | "done" | "error";

// The single-meter reading workflow (month -> previous reading -> photo +
// OCR in-frame -> confirm -> save) — was the whole of /checker before the
// 2026-09-06 dashboard-first redesign; now a drill-down page reached by
// tapping a meter or scanning its QR on the dashboard, taking `?meterId=`.
// useSearchParams() needs a Suspense boundary (Next.js requirement) hence
// the wrapper below.
export default function ReadingPage() {
  return (
    <CheckerAuthGate>
      {(session) => (
        <Suspense
          fallback={<p className="p-6 text-center text-sm text-zinc-500">กำลังโหลด...</p>}
        >
          <ReadingWorkflow session={session} />
        </Suspense>
      )}
    </CheckerAuthGate>
  );
}

function ReadingWorkflow({ session }: { session: CheckerSession }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meterId = searchParams.get("meterId");

  const [meters, setMeters] = useState<MeterInfo[]>([]);
  const [metersLoaded, setMetersLoaded] = useState(false);
  const meter = meterId ? findMeterById(meters, meterId) : undefined;

  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [previousReading, setPreviousReading] = useState<number | undefined>();
  const [previousFound, setPreviousFound] = useState(false);
  const [duplicateReading, setDuplicateReading] = useState<LocalReading | undefined>();

  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [ocrValue, setOcrValue] = useState("");
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [currentValueInput, setCurrentValueInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedReading, setSavedReading] = useState<LocalReading | null>(null);

  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  useEffect(() => {
    fetchBillingConfig().then(setBillingConfig);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMeters()
      .then((data) => {
        if (!cancelled) setMeters(data);
      })
      .finally(() => {
        if (!cancelled) setMetersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
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
    meter !== undefined &&
    hasValidCurrentValue &&
    !isFutureMonth(monthValue) &&
    !duplicateReading &&
    !savedReading &&
    capturedImageBlob !== null;

  async function handleConfirmSave() {
    if (!meter || currentValueNumber === undefined || !capturedImageBlob) return;
    setSaveError(null);
    try {
      const { reading } = await saveOfflineReading({
        meterId: meter.id,
        readingMonth,
        recordedBy: session.id,
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
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  function startAnotherMonth() {
    setSavedReading(null);
    setMonthValue(currentMonthValue());
  }

  if (!meterId) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10 text-center">
        <p className="text-sm text-zinc-500">ไม่พบมิเตอร์ที่เลือก</p>
        <Link href="/checker" className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400">
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  if (!meter) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10 text-center">
        <p className="text-sm text-zinc-500">
          {metersLoaded ? "ไม่พบมิเตอร์รหัสนี้" : "กำลังโหลด..."}
        </p>
        <Link href="/checker" className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400">
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/checker" className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400">
          ← กลับหน้าหลัก
        </Link>
      </header>

      {/* Meter info */}
      <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <p className="text-xl font-bold">{meter.code}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{meter.roomName}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{meter.zoneName}</p>
      </section>

      {/* Reading month */}
      <section className="flex flex-col gap-1">
        <label className="text-sm font-semibold" htmlFor="reading-month">
          เดือนอ่าน
        </label>
        <MonthYearSelect
          id="reading-month"
          max={currentMonthValue()}
          value={monthValue}
          onChange={handleMonthChange}
          selectClassName="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="text-sm text-zinc-500">{formatMonthThai(monthValue)}</p>
      </section>

      {savedReading ? (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="text-base font-semibold">บันทึกสำเร็จ — สถานะ {savedReading.status}</p>
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/checker")}
              className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white"
            >
              กลับหน้าหลัก
            </button>
            <button
              type="button"
              onClick={startAnotherMonth}
              className="flex-1 rounded-lg border border-emerald-700 px-4 py-3 font-semibold text-emerald-800"
            >
              จดเดือนอื่นของมิเตอร์นี้
            </button>
          </div>
        </section>
      ) : duplicateReading ? (
        <section className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">มีการบันทึกมิเตอร์นี้ในเดือนนี้แล้ว</p>
          <p className="mt-1">ค่าที่เคยบันทึก: {duplicateReading.confirmedValue ?? "-"}</p>
          <p>ผู้บันทึก: {resolveRecorderName(duplicateReading.recordedBy, session)}</p>
          <p>
            วันที่บันทึก:{" "}
            {duplicateReading.recordedAt
              ? new Date(duplicateReading.recordedAt).toLocaleString("th-TH")
              : "-"}
          </p>
          <Link
            href="/checker"
            className="mt-3 inline-block rounded-lg border border-amber-600 px-4 py-2 font-semibold text-amber-800"
          >
            กลับหน้าหลัก
          </Link>
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
                  className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
                >
                  {ocrStatus === "loading" ? "กำลังอ่านตัวเลข..." : "🔎 อ่านตัวเลข"}
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
                <label className="text-sm font-semibold" htmlFor="current-value">
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
                <p>ห้อง: {meter.roomName}</p>
                <p>Zone: {meter.zoneName}</p>
                <p>เดือน: {formatMonthThai(monthValue)}</p>
                <p>ค่าครั้งก่อน: {previousFound ? previousReading : "-"}</p>
                <p>ค่าครั้งนี้: {hasValidCurrentValue ? currentValueNumber : "-"}</p>
                <p>หน่วยที่ใช้: {usage ?? "-"}</p>
                <p>สถานะ: PENDING_SYNC (จนกว่าจะ sync สำเร็จ)</p>
                <p className="mt-1 text-zinc-500">ภาพ: แนบแล้ว ✓</p>
                {billingConfig && hasValidCurrentValue && (
                  <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                    <BillingBreakdownPanel
                      confirmedValue={currentValueNumber}
                      previousReading={previousFound ? (previousReading ?? null) : null}
                      config={billingConfig}
                    />
                  </div>
                )}
              </section>

              <button
                type="button"
                disabled={!canSave}
                onClick={handleConfirmSave}
                className="rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                ยืนยันและบันทึก
              </button>

              {saveError && <p className="text-sm font-medium text-red-600">{saveError}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
