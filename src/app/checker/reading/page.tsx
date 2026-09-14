"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import MonthYearSelect from "@/components/MonthYearSelect";
import CheckerAuthGate from "@/components/checker/CheckerAuthGate";
import MeterCamera from "@/components/meter/MeterCamera";
import MeterImageEditor from "@/components/meter/MeterImageEditor";
import MeterOcrDebugPanel from "@/components/meter/MeterOcrDebugPanel";
import MeterPreview from "@/components/meter/MeterPreview";
import { fetchBillingConfig } from "@/lib/billing/billingConfigApi";
import type { BillingConfig } from "@/lib/billing/types";
import { resolveRecorderName } from "@/lib/checker/resolveRecorderName";
import type { CheckerSession } from "@/lib/checker/types";
import { compressImage } from "@/lib/image/compressImage";
import { cropToRegion } from "@/lib/image/meterCrop";
import { preprocessForOcr } from "@/lib/image/meterPreprocess";
import { fetchMeters } from "@/lib/meters/meterApi";
import { findMeterById } from "@/lib/meters/meterLookup";
import type { MeterInfo } from "@/lib/meters/types";
import type { LocalReading } from "@/lib/offline/db";
import { DEFAULT_OCR_REGION, type OcrRegion } from "@/lib/ocr/ocrRegion";
import { recognizeMeterValue } from "@/lib/ocr/ocrProvider";
import { validateOcrResult } from "@/lib/ocr/ocrValidation";
import type { LiveOcrState, OcrDebugSnapshot } from "@/lib/ocr/useLiveOcr";
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

  const [pendingUploadFile, setPendingUploadFile] = useState<Blob | null>(null);
  const [ocrRegion, setOcrRegion] = useState<OcrRegion>(DEFAULT_OCR_REGION);
  const [debugSnapshot, setDebugSnapshot] = useState<OcrDebugSnapshot | null>(null);

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
    setOcrRegion(DEFAULT_OCR_REGION);
  }

  // A stable live-OCR read (Real-time OCR Preview) is only ever a
  // SUGGESTION prefilled into the editable input below — it never saves
  // anything by itself. The checker still must review it and press
  // "ยืนยันและบันทึก" through the same confirmation card as always.
  function applyLiveResultIfStable(liveResult: LiveOcrState) {
    if (liveResult.status !== "stable") return;
    setOcrValue(liveResult.value);
    setCurrentValueInput(liveResult.value);
    setOcrStatus("done");
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
  // it does not crop it. `liveResult` (from MeterCamera's real-time
  // preview) is optional and only ever used to prefill — never to skip the
  // manual confirm step.
  async function handleImageCaptured(rawBlob: Blob, liveResult?: LiveOcrState) {
    const compressed = await compressImage(rawBlob);
    if (capturedImageUrl) URL.revokeObjectURL(capturedImageUrl);
    setCapturedImageBlob(compressed);
    setCapturedImageUrl(URL.createObjectURL(compressed));
    setOcrValue("");
    setOcrStatus("idle");
    setOcrError(null);
    setCurrentValueInput("");
    if (liveResult) applyLiveResultIfStable(liveResult);
  }

  function handleFileSelectedForEdit(file: Blob) {
    setPendingUploadFile(file);
  }

  function handleEditorCancel() {
    setPendingUploadFile(null);
  }

  // Upload Image Mode confirm: same downstream state as a camera capture
  // (original file compressed, never the zoomed/panned/cropped editor
  // view) — the only difference is `region` may now be the one the checker
  // adjusted in the editor instead of DEFAULT_OCR_REGION, remembered so a
  // manual "อ่านตัวเลข" re-run below still targets the right area.
  async function handleEditorConfirm(
    file: Blob,
    region: OcrRegion,
    liveResult: LiveOcrState,
  ) {
    setOcrRegion(region);
    setPendingUploadFile(null);
    await handleImageCaptured(file, liveResult);
  }

  async function handleRunOcr() {
    if (!capturedImageBlob) return;
    setOcrStatus("loading");
    setOcrError(null);
    try {
      const cropped = await cropToRegion(capturedImageBlob, ocrRegion);
      const preprocessed = await preprocessForOcr(cropped);
      const result = await recognizeMeterValue(preprocessed);
      const validation = validateOcrResult(result);
      if (!validation.valid) {
        setOcrStatus("error");
        setOcrError("กรุณาถ่ายภาพใหม่ ตัวเลขไม่ชัดเจน");
        return;
      }
      setOcrValue(result.value);
      setCurrentValueInput(result.value);
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

          {/* Camera */}
          <section className="flex flex-col gap-2">
            <p className="text-sm font-semibold">ภาพมิเตอร์</p>
            {pendingUploadFile ? (
              <MeterImageEditor
                file={pendingUploadFile}
                onConfirm={handleEditorConfirm}
                onCancel={handleEditorCancel}
                onDebugSnapshot={setDebugSnapshot}
              />
            ) : !capturedImageBlob ? (
              <MeterCamera
                onCapture={handleImageCaptured}
                onFileSelected={handleFileSelectedForEdit}
                onDebugSnapshot={setDebugSnapshot}
              />
            ) : (
              <MeterPreview
                imageUrl={capturedImageUrl ?? ""}
                onRetake={resetPhoto}
                onRunOcr={handleRunOcr}
                ocrStatus={ocrStatus}
                ocrValue={ocrValue}
                ocrError={ocrError}
              />
            )}
          </section>

          {process.env.NODE_ENV === "development" && (
            <MeterOcrDebugPanel snapshot={debugSnapshot} />
          )}

          {/* Current reading — always editable: type it in yourself, or take
              a photo above and let "อ่านตัวเลข" (OCR) fill it in for you;
              either way you can still adjust the value here before saving. */}
          <section className="flex flex-col gap-1">
            <label className="text-sm font-semibold" htmlFor="current-value">
              ค่ามิเตอร์ครั้งนี้
            </label>
            <input
              id="current-value"
              type="number"
              inputMode="decimal"
              step="any"
              value={currentValueInput}
              onChange={(e) => setCurrentValueInput(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-3 text-xl dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="พิมพ์ค่ามิเตอร์เอง หรือถ่ายภาพแล้วกด อ่านตัวเลข"
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

          {hasValidCurrentValue && (
            <>
              {/* Confirmation card */}
              <section className="flex flex-col gap-1 rounded-xl border border-zinc-300 p-4 text-sm dark:border-zinc-700">
                <p className="mb-1 font-semibold">ตรวจสอบก่อนบันทึก</p>
                <p>Meter: {meter.code}</p>
                <p>ห้อง: {meter.roomName}</p>
                <p>Zone: {meter.zoneName}</p>
                <p>เดือน: {formatMonthThai(monthValue)}</p>
                <p>ค่าครั้งก่อน: {previousFound ? previousReading : "-"}</p>
                <p>ค่าครั้งนี้: {currentValueNumber}</p>
                <p>หน่วยที่ใช้: {usage ?? "-"}</p>
                <p>สถานะ: PENDING_SYNC (จนกว่าจะ sync สำเร็จ)</p>
                <p
                  className={`mt-1 ${capturedImageBlob ? "text-zinc-500" : "font-medium text-amber-700 dark:text-amber-400"}`}
                >
                  ภาพ: {capturedImageBlob ? "แนบแล้ว ✓" : "ยังไม่ได้ถ่ายภาพ — ต้องถ่ายภาพก่อนจึงจะบันทึกได้"}
                </p>
                {billingConfig && (
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
