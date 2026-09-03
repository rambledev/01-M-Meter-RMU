# src/lib/export

Excel export (Phase 6) + billing Calculation Service (Phase 6B) — kept in
separate modules from Excel layout/formatting on purpose, so the billing
formula never blocks layout work and vice versa:

- `calculation.ts` — the Calculation Service: `calculateUsage`,
  `calculateBaseCharge`, `calculateFT`, `calculateTax`, `calculateTotal`,
  `calculateBilling`. Takes a `BillingConfig` (see `src/lib/billing/`) as a
  parameter — no rates are hard-coded here.
- `mapReadingToRow.ts` — maps a Prisma `Reading` (+ Meter/Room) to one Excel
  row, calling the Calculation Service for every derived value.
- `excel.ts` — ExcelJS workbook layout only (merge cells, borders, number
  format) — no billing math.
- `filename.ts` / `monthParam.ts` / `parseBillingConfigParam.ts` — small
  parsing/formatting helpers for the export API route.

See `docs/export-format.md` for the full design and current status (the
default billing rates are a "สูตรเบื้องต้นจากเอกสารตัวอย่าง", not an
officially confirmed tariff).
