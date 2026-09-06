"use client";

// Replaces the native <input type="month"> picker with two <select>s (Thai
// month name + Buddhist year) — some mobile browsers render the native
// month picker inconsistently, and the user asked for an explicit dropdown
// of all 12 Thai month names instead. Value/onChange stay "YYYY-MM"
// (Gregorian) so every existing caller (currentMonthValue/isFutureMonth/
// handleMonthChange/etc.) keeps working unchanged.
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
  max,
  yearsBack = 5,
  wrapperClassName = "flex gap-2",
  selectClassName = DEFAULT_SELECT_CLASS,
}: {
  id?: string;
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
  max?: string; // "YYYY-MM" — latest selectable month, if any
  yearsBack?: number;
  wrapperClassName?: string;
  selectClassName?: string;
}) {
  const { year, month } = parseMonthValue(value);
  const maxParsed = max ? parseMonthValue(max) : null;
  const latestYear = maxParsed?.year ?? new Date().getFullYear();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => latestYear - i);

  const monthOptionCount = maxParsed && year === maxParsed.year ? maxParsed.month : 12;

  function handleMonthChange(nextMonth: number) {
    onChange(buildMonthValue(year, nextMonth));
  }

  function handleYearChange(nextYear: number) {
    const cappedMonth =
      maxParsed && nextYear === maxParsed.year ? Math.min(month, maxParsed.month) : month;
    onChange(buildMonthValue(nextYear, cappedMonth));
  }

  return (
    <div className={wrapperClassName}>
      <select
        id={id}
        value={month}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
        className={selectClassName}
      >
        {THAI_MONTHS.slice(0, monthOptionCount).map((name, i) => (
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
