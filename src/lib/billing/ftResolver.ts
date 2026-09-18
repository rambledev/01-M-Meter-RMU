import { prisma } from "@/lib/db/prisma";

// Resolves the Ft (ค่า Ft) rate for a given Reading.readingMonth — the ONLY
// place production code should ever read Ft from (2026-09-17). Deliberately
// NOT a date-range query: FtRate is a Monthly Rate, exactly one row per
// calendar month (FtRate.readingMonth is @@unique), so this is always an
// exact equality lookup — never "closest", "latest", or "current month" as
// a stand-in for a different month. No fallback of any kind: a month with
// no ACTIVE FtRate row resolves to `{ found: false }`, which callers must
// surface as "ยังไม่ได้กำหนดค่า Ft สำหรับเดือนนี้", never a computed total.
export type FtResolution = { found: true; id: string; ftRate: number } | { found: false };

// Same "1st of month, UTC midnight" convention as Reading.readingMonth
// (data-model.md §3.1) — normalized defensively here so a caller passing a
// Date with a non-zero day/time still resolves correctly instead of
// silently missing every month.
export function normalizeToMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function resolveFtForMonth(readingMonth: Date): Promise<FtResolution> {
  const normalized = normalizeToMonthStart(readingMonth);
  const row = await prisma.ftRate.findFirst({
    where: { readingMonth: normalized, status: "ACTIVE" },
  });
  if (!row) return { found: false };

  // Decimal -> number happens at exactly this one point (per the confirmed
  // implementation decision) — DB keeps the exact Decimal(10,4) value; the
  // rest of the calculation engine keeps using plain `number` as it always
  // has (src/lib/export/calculation.ts, unchanged rounding policy). Number()
  // rather than .toNumber() so this also works against
  // src/lib/db/mockPrisma.ts's plain-number stand-in (MOCK_DATA=true) — the
  // same convention src/lib/export/mapReadingToRow.ts already established.
  return { found: true, id: row.id, ftRate: Number(row.ftRate) };
}
