import BillingBreakdownPanel from "@/components/BillingBreakdownPanel";
import type { BillingConfig } from "@/lib/billing/types";
import { resolveRecorderName } from "@/lib/checker/resolveRecorderName";
import type { CheckerSession } from "@/lib/checker/types";
import type { LocalReading } from "@/lib/offline/db";
import { findMeterById } from "@/lib/meters/meterLookup";
import type { MeterInfo } from "@/lib/meters/types";
import { toMonthValue } from "@/lib/reading/readingMonth";
import {
  READING_STATUS_COLOR as STATUS_COLOR,
  READING_STATUS_LABEL as STATUS_LABEL,
} from "@/lib/reading/readingStatusLabels";

export default function ReadingHistoryList({
  readings,
  billingConfig,
  meters,
  session,
}: {
  readings: LocalReading[];
  billingConfig: BillingConfig | null;
  meters: MeterInfo[];
  session: CheckerSession | null;
}) {
  if (readings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">ยังไม่มีรายการที่บันทึกในเครื่องนี้</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {readings.map((reading) => {
        const meter = findMeterById(meters, reading.meterId);
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
              {meter?.roomName ?? "-"} · {toMonthValue(reading.readingMonth)}
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              ครั้งก่อน {reading.previousReading ?? "-"} → ครั้งนี้{" "}
              {reading.confirmedValue ?? "-"} (ใช้ไป {reading.usage ?? "-"}{" "}
              หน่วย)
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              บันทึกโดย {resolveRecorderName(reading.recordedBy, session)}
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
