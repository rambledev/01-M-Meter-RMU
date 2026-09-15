import type { ValidationSeverity } from "@/lib/reading/meterReadingValidation";

interface UsageSummaryCardProps {
  usage?: number;
  status: ValidationSeverity;
  previousReadingError?: string;
}

// Usage is a DERIVED value (calculateUsage() in meterReadingValidation.ts's
// evaluateReading(), reused from readingMonth.ts) — never computed twice.
// Renders nothing while the current reading isn't valid yet, so an
// invalid/incomplete input never shows a misleading usage number.
export default function UsageSummaryCard({
  usage,
  status,
  previousReadingError,
}: UsageSummaryCardProps) {
  if (previousReadingError) {
    return (
      <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700">
        ✕ {previousReadingError}
      </p>
    );
  }

  if (usage === undefined) return null;

  const isWarning = status === "warning";

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
        isWarning
          ? "bg-amber-50 dark:bg-amber-950/20"
          : "bg-emerald-50 dark:bg-emerald-950/20"
      }`}
    >
      <span className="text-sm font-semibold">การใช้ไฟ</span>
      <span className="text-lg font-bold">+{usage} หน่วย</span>
    </div>
  );
}
