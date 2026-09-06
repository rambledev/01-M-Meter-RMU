// Reading period label — MM/BBBB (2-digit month / Buddhist year), e.g.
// "01/2569" for January 2026. Explicit request (2026-09-04): the admin
// history view identifies a reading round by this label, not by the Thai
// month name used elsewhere (src/lib/reading/readingMonth.ts's
// formatMonthThai, e.g. "มกราคม 2569") or the raw ISO readingMonth date.
export function formatReadingPeriod(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const buddhistYear = date.getUTCFullYear() + 543;
  return `${month}/${buddhistYear}`;
}
