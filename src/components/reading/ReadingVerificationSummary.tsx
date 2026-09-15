import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import type { BillingConfig } from "@/lib/billing/types";
import type { MeterInfo } from "@/lib/meters/types";

interface ReadingVerificationSummaryProps {
  meter: MeterInfo;
  monthLabel: string;
  previousReading?: number;
  currentValue: number;
  usage?: number;
  hasEvidenceImage: boolean;
  billingConfig: BillingConfig | null;
  errors: string[];
  warnings: string[];
  canSave: boolean;
  isSaving: boolean;
  onConfirm: () => void;
}

// Pre-save confirmation card — shown once the current reading has a valid
// FORMAT (evaluateReading().value is defined), even if it's still blocked
// by an error (e.g. current < previous): the checker should see exactly
// what's wrong in context, with the save button visibly disabled, rather
// than the card disappearing entirely.
export default function ReadingVerificationSummary({
  meter,
  monthLabel,
  previousReading,
  currentValue,
  usage,
  hasEvidenceImage,
  billingConfig,
  errors,
  warnings,
  canSave,
  isSaving,
  onConfirm,
}: ReadingVerificationSummaryProps) {
  return (
    <>
      <section className="flex flex-col gap-1 rounded-xl border border-zinc-300 p-4 text-sm dark:border-zinc-700">
        <p className="mb-1 font-semibold">ตรวจสอบก่อนบันทึก</p>
        <p>มิเตอร์: {meter.code}</p>
        <p>ห้อง: {meter.roomName}</p>
        <p>Zone: {meter.zoneName}</p>
        <p>เดือน: {monthLabel}</p>
        <p>ค่าครั้งก่อน: {previousReading !== undefined ? previousReading : "-"}</p>
        <p>ค่าครั้งนี้: {currentValue}</p>
        <p>หน่วยที่ใช้: {usage ?? "-"}</p>
        <p>สถานะ: PENDING_SYNC (จนกว่าจะ sync สำเร็จ)</p>
        <p
          className={`mt-1 ${hasEvidenceImage ? "text-zinc-500" : "font-medium text-amber-700 dark:text-amber-400"}`}
        >
          หลักฐาน: {hasEvidenceImage ? "แนบแล้ว ✓" : "ยังไม่ได้ถ่ายภาพ — ต้องถ่ายภาพก่อนจึงจะบันทึกได้"}
        </p>

        {errors.map((error) => (
          <p key={error} className="mt-1 font-semibold text-red-600">
            ✕ {error}
          </p>
        ))}
        {warnings.map((warning) => (
          <p key={warning} className="mt-1 font-medium text-amber-700 dark:text-amber-400">
            ⚠ {warning}
          </p>
        ))}

        {billingConfig && (
          <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <BillingBreakdownPanel
              confirmedValue={currentValue}
              previousReading={previousReading ?? null}
              config={billingConfig}
            />
          </div>
        )}
      </section>

      <button
        type="button"
        disabled={!canSave}
        onClick={onConfirm}
        className="rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
      >
        {isSaving ? "กำลังบันทึก..." : "ยืนยันและบันทึก"}
      </button>
    </>
  );
}
