// Billing Configuration (Phase 6B) — the ONLY place billing rates live.
// Calculation Service (src/lib/export/calculation.ts) takes a BillingConfig
// as a parameter and never embeds these numbers itself (export-format.md §3,
// decision-log.md Phase 6B).

export interface BillingTier {
  minUnit: number; // inclusive
  maxUnit: number | null; // inclusive; null = unbounded (last tier only)
  rate: number; // baht per unit within this tier
}

export interface BillingConfig {
  ftRate: number; // baht per unit
  taxRatePercent: number; // e.g. 7 means 7%
  baseCharge: number; // fixed baht, charged once regardless of usage
  // Two separate rate tables (2026-09-22), chosen by the Reading's total
  // usage for the whole month — never mixed/blended within one bill. This
  // mirrors how the real PEA/MEA residential tariff works: a household using
  // <=150 units/month is billed entirely under one tariff category, one
  // using >150 units/month entirely under a different one — NOT the same
  // progressive table extended further. src/lib/export/calculation.ts's
  // selectTiersForUsage() is the one place that decides which table applies.
  highUsageThreshold: number; // หน่วย — usage <= this uses lowUsageTiers, usage > this uses highUsageTiers
  lowUsageTiers: BillingTier[]; // ใช้เมื่อ usage <= highUsageThreshold — ordered ascending by minUnit, non-overlapping
  highUsageTiers: BillingTier[]; // ใช้เมื่อ usage > highUsageThreshold — ordered ascending by minUnit, non-overlapping
  // Supporting evidence for the current rate settings (2026-09-16) —
  // optional, display-only fields. Never read by calculation logic
  // (src/lib/billing/breakdown.ts) — purely documentation for Admin/audit.
  documentPath?: string | null; // e.g. "/upload/doc/xxx.pdf" — see src/app/api/admin/billing-config/document
  documentName?: string | null; // original filename, for display
}
