// Pure date-math helpers for the Reading Month field.
//
// No date library needed: "YYYY-MM" strings compare lexicographically the
// same as they compare chronologically, and "YYYY-MM-01" is the storage
// convention already established in offline-strategy.md / data-model.md.

// "YYYY-MM", matches the value of an <input type="month">.
export function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isFutureMonth(monthValue: string): boolean {
  return monthValue > currentMonthValue();
}

// "YYYY-MM" -> "YYYY-MM-01"
export function toReadingMonth(monthValue: string): string {
  return `${monthValue}-01`;
}

// "YYYY-MM-01" -> "YYYY-MM"
export function toMonthValue(readingMonth: string): string {
  return readingMonth.slice(0, 7);
}

// "YYYY-MM-01" -> the "YYYY-MM-01" of the calendar month right before it
// (never "the last recorded reading" — see requirement.md §3.1).
export function previousReadingMonth(readingMonth: string): string {
  const [year, month] = readingMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  const prevYear = date.getUTCFullYear();
  const prevMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${prevYear}-${prevMonth}-01`;
}

export function calculateUsage(
  current: number,
  previous: number | undefined,
): number | undefined {
  if (previous === undefined) return undefined;
  return current - previous;
}
