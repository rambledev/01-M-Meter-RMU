// Parses the "?month=YYYY-MM" query param into the exact Date used to
// filter Reading.readingMonth (a @db.Date column, always the 1st of the
// month — see data-model.md §3.1). Returns null for anything invalid so the
// API route can respond with a clear validation error instead of querying
// with a garbage date.
export function parseMonthParam(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;

  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;

  const date = new Date(`${month}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
