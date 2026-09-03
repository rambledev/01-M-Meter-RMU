import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import type { BillingConfig } from "@/lib/billing/types";
import type { LocalReading } from "@/lib/offline/db";
import { findMeterById } from "@/lib/meters/meterLookup";
import { resolveRecorderName } from "@/lib/meters/demoData";
import { toMonthValue } from "@/lib/reading/readingMonth";

const STATUS_LABEL: Record<LocalReading["status"], string> = {
  DRAFT: "แบบร่าง",
  PENDING_SYNC: "รอ Sync",
  SYNCING: "กำลัง Sync",
  SYNCED: "Sync แล้ว",
  SYNC_ERROR: "Sync ผิดพลาด",
};

// Phase 7 polish: status must read clearly at a glance (item 2/10 of the
// kickoff), not just as plain text next to the meter code.
const STATUS_COLOR: Record<LocalReading["status"], string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  PENDING_SYNC: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  SYNCING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  SYNCED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  SYNC_ERROR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function ReadingHistoryList({
  readings,
  billingConfig,
}: {
  readings: LocalReading[];
  billingConfig: BillingConfig | null;
}) {
  if (readings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">ยังไม่มีรายการที่บันทึกในเครื่องนี้</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {readings.map((reading) => {
        const meter = findMeterById(reading.meterId);
        return (
          <li
            key={reading.localId}
            className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <div className="flex items-center justify-between font-semibold">
              <span>{meter?.code ?? reading.meterId}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-normal ${STATUS_COLOR[reading.status]}`}
              >
                {STATUS_LABEL[reading.status]}
              </span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              {meter?.room.name ?? "-"} · {toMonthValue(reading.readingMonth)}
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              ครั้งก่อน {reading.previousReading ?? "-"} → ครั้งนี้{" "}
              {reading.confirmedValue ?? "-"} (ใช้ไป {reading.usage ?? "-"}{" "}
              หน่วย)
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              บันทึกโดย {resolveRecorderName(reading.recordedBy)}
            </p>
            {billingConfig && reading.confirmedValue !== undefined && (
              <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                <BillingBreakdownPanel
                  confirmedValue={reading.confirmedValue}
                  previousReading={reading.previousReading ?? null}
                  config={billingConfig}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
