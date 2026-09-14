"use client";

// Replaces the native <input type="month"> picker with two <select>s (Thai
// month name + Buddhist year) — some mobile browsers render the native
// month picker inconsistently, and the user asked for an explicit dropdown
// of all 12 Thai month names instead. Value/onChange stay "YYYY-MM"
// (Gregorian) so every existing caller (currentMonthValue/isFutureMonth/
// handleMonthChange/etc.) keeps working unchanged.
//
// Always shows all 12 months for whichever year is selected, in every
// caller (2026-09-07 — previously some callers passed a `max` to hide
// months later than the current one; the user asked for every month
// picker, everywhere, to always list the full 12, defaulting to the
// current month but never restricting what can be picked). Anywhere a
// future month is genuinely invalid to select (e.g. entering a new meter
// reading), that is enforced separately by the caller's own business-rule
// check (isFutureMonth), not by hiding options here.
const THAI_MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date(2000, i, 1)),
);

const DEFAULT_SELECT_CLASS =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function parseMonthValue(value: string): { year: number; month: number } {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

function buildMonthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function MonthYearSelect({
  id,
  value,
  onChange,
  yearsBack = 5,
  wrapperClassName = "flex gap-2",
  selectClassName = DEFAULT_SELECT_CLASS,
}: {
  id?: string;
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
  yearsBack?: number;
  wrapperClassName?: string;
  selectClassName?: string;
}) {
  const { year, month } = parseMonthValue(value);
  const latestYear = new Date().getFullYear();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => latestYear - i);

  function handleMonthChange(nextMonth: number) {
    onChange(buildMonthValue(year, nextMonth));
  }

  function handleYearChange(nextYear: number) {
    onChange(buildMonthValue(nextYear, month));
  }

  return (
    <div className={wrapperClassName}>
      <select
        id={id}
        value={month}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
        className={selectClassName}
      >
        {THAI_MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        className={selectClassName}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y + 543}
          </option>
        ))}
      </select>
    </div>
  );
}
