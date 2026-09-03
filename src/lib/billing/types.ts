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
  tiers: BillingTier[]; // ordered ascending by minUnit, non-overlapping
}
