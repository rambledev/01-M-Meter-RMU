"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import CurrentReadingInput from "@/components/reading/CurrentReadingInput";
import EvidencePhotoCard from "@/components/reading/EvidencePhotoCard";
import ReadingVerificationSummary from "@/components/reading/ReadingVerificationSummary";
import UsageSummaryCard from "@/components/reading/UsageSummaryCard";
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
import { evaluateReading } from "@/lib/reading/meterReadingValidation";
import {
  currentMonthValue,
  formatMonthThai,
  isFutureMonth,
  toReadingMonth,
} from "@/lib/reading/readingMonth";
import {
  checkDuplicateReading,
  getUsageHistoryForMeter,
  lookupPreviousReading,
  saveOfflineReading,
} from "@/lib/reading/readingWorkflow";

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
  const [usageHistory, setUsageHistory] = useState<number[]>([]);

  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);

  // SOURCE OF TRUTH for the reading — always exactly what the checker
  // typed/pasted, byte for byte. Nothing in this file (or
  // meterReadingValidation.ts) ever rewrites it. OCR infrastructure is
  // intentionally not wired into this page at all anymore (kept for a
  // future OCR-assist mode — see components/meter/{MeterImageEditor,
  // MeterOcrDebugPanel}.tsx, lib/ocr/**, lib/image/{meterCrop,
  // meterPreprocess,roiEditor}.ts, all untouched and unused here).
  const [currentReadingInput, setCurrentReadingInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedReading, setSavedReading] = useState<LocalReading | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  // Usage is DERIVED — evaluateReading() is the one place that computes it
  // (via calculateUsage() from readingMonth.ts, reused as-is). No second
  // source of truth for usage anywhere else on this page.
  const evaluation = evaluateReading({
    rawInput: currentReadingInput,
    previousReading,
    historicalUsages: usageHistory,
  });

  useEffect(() => {
    if (!meter) return;
    let cancelled = false;
    (async () => {
      const [prev, dup, history] = await Promise.all([
        lookupPreviousReading(meter.id, readingMonth),
        checkDuplicateReading(meter.id, readingMonth),
        getUsageHistoryForMeter(meter.id, readingMonth),
      ]);
      if (cancelled) return;
      setPreviousReading(prev.value);
      setPreviousFound(prev.found);
      setDuplicateReading(dup);
      setUsageHistory(history);
    })();
    return () => {
      cancelled = true;
    };
  }, [meter, readingMonth]);

  function resetPhoto() {
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageBlob(null);
    setCapturedImageUrl(null);
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
    setCurrentReadingInput("");
  }

  // Evidence photo only — original full photo, never cropped (requirement
  // §3.3, decision-log.md). Compression re-encodes the same full frame
  // smaller, it does not crop it. Fires the same way whether the checker
  // used the camera shutter or "เลือกภาพจากเครื่อง" (EvidencePhotoCard.tsx
  // unifies both into one onCapture).
  async function handleImageCaptured(rawBlob: Blob) {
    const compressed = await compressImage(rawBlob);
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageBlob(compressed);
    setCapturedImageUrl(URL.createObjectURL(compressed));
  }

  const canSave =
    meter !== undefined &&
    evaluation.status !== "idle" &&
    evaluation.status !== "error" &&
    !isFutureMonth(monthValue) &&
    !duplicateReading &&
    !savedReading &&
    capturedImageBlob !== null &&
    !isSaving;

  // Save Safety (item 7): re-checks everything canSave already gates on —
  // this is the ONLY place saveOfflineReading() is called from, and it's
  // never reachable except through this button (no other UI action can
  // bypass validation to trigger a save).
  async function handleConfirmSave() {
    if (!canSave || !meter || evaluation.value === undefined || !capturedImageBlob) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    try {
      const { reading } = await saveOfflineReading({
        meterId: meter.id,
        readingMonth,
        recordedBy: session.id,
        previousReading,
        confirmedValue: evaluation.value,
        // OCR is not part of the active manual-reading-first flow — always
        // undefined here. saveOfflineReading()'s signature is unchanged;
        // this field simply has nothing to carry until a future OCR-assist
        // mode is wired back in.
        ocrValue: undefined,
        image: {
          blob: capturedImageBlob,
          mimeType: capturedImageBlob.type || "image/jpeg",
        },
      });
      setSavedReading(reading);
      setCurrentReadingInput("");
      resetPhoto();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
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
          value={monthValue}
          onChange={handleMonthChange}
          selectClassName="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="text-sm text-zinc-500">{formatMonthThai(monthValue)}</p>
        {saveError && <p className="text-sm font-medium text-red-600">{saveError}</p>}
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

          {/* Current reading — the main focus of the page, and the SOURCE
              OF TRUTH for what gets saved. Always editable, no OCR
              involved in this active flow. */}
          <CurrentReadingInput
            id="current-reading"
            value={currentReadingInput}
            onChange={setCurrentReadingInput}
            error={evaluation.formatError}
          />

          <UsageSummaryCard
            usage={evaluation.usage}
            status={evaluation.status}
            previousReadingError={evaluation.previousReadingError}
          />

          <EvidencePhotoCard
            imageBlob={capturedImageBlob}
            imageUrl={capturedImageUrl}
            onCapture={handleImageCaptured}
            onRetake={resetPhoto}
          />

          {evaluation.value !== undefined && (
            <ReadingVerificationSummary
              meter={meter}
              monthLabel={formatMonthThai(monthValue)}
              previousReading={previousFound ? previousReading : undefined}
              currentValue={evaluation.value}
              usage={evaluation.usage}
              hasEvidenceImage={capturedImageBlob !== null}
              billingConfig={billingConfig}
              errors={
                evaluation.previousReadingError ? [evaluation.previousReadingError] : []
              }
              warnings={evaluation.warnings}
              canSave={canSave}
              isSaving={isSaving}
              onConfirm={handleConfirmSave}
            />
          )}

          {saveError && <p className="text-sm font-medium text-red-600">{saveError}</p>}
        </>
      )}
    </div>
  );
}
