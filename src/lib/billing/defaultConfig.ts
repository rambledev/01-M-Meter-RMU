import type { BillingConfig } from "./types";

// Rates transcribed from a sample billing document at Phase 6B kickoff.
// EXPLICITLY NOT an officially confirmed tariff — the base-charge tier rates
// are still pending confirmation from RMU staff (see docs/decision-log.md,
// Phase 6B section). Never present this as "สูตรทางการ" in the UI/Excel —
// always "สูตรเบื้องต้นจากเอกสารตัวอย่าง".
export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  ftRate: 0.0972,
  taxRatePercent: 7,
  baseCharge: 8.19,
  tiers: [
    { minUnit: 0, maxUnit: 20, rate: 1.142 },
    { minUnit: 21, maxUnit: 55, rate: 2.0 },
    { minUnit: 56, maxUnit: 90, rate: 2.18 },
    { minUnit: 91, maxUnit: 400, rate: 2.273333 },
    { minUnit: 401, maxUnit: null, rate: 2.978 },
  ],
};
