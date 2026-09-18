import {
  calculateBilling,
  computeTierBreakdown,
  type TierChargeLine,
} from "@/lib/export/calculation";
import type { BillingConfig } from "./types";

export interface BillingBreakdown {
  previousReading: number | null;
  confirmedValue: number;
  usage: number | null;
  tierLines: TierChargeLine[];
  baseChargeFixed: number;
  baseCharge: number | null;
  ft: number | null;
  tax: number | null;
  total: number | null;
  ftNotConfigured: boolean; // see BillingCalculation in @/lib/export/calculation
}

// Per-reading breakdown for the "ดูวิธีคำนวณ" panel — composed entirely from
// the Calculation Service's own functions, no separate formula here.
//
// `resolvedFtRate` is whatever src/lib/billing/ftResolver.ts resolved for
// THIS reading's own readingMonth (2026-09-17) — the caller resolves it
// (server routes call resolveFtForMonth() directly; client UI fetches
// GET /api/billing/ft/current?month=...), never guessed here. `null` means
// FT_NOT_CONFIGURED for that month.
export function buildBillingBreakdown(
  confirmedValue: number,
  previousReading: number | null,
  config: BillingConfig,
  resolvedFtRate: number | null,
): BillingBreakdown {
  const billing = calculateBilling(confirmedValue, previousReading, config, resolvedFtRate);
  const tierLines =
    billing.usage !== null ? computeTierBreakdown(billing.usage, config.tiers) : [];

  return {
    previousReading,
    confirmedValue,
    usage: billing.usage,
    tierLines,
    baseChargeFixed: config.baseCharge,
    baseCharge: billing.baseCharge,
    ft: billing.ft,
    tax: billing.tax,
    total: billing.total,
    ftNotConfigured: billing.ftNotConfigured,
  };
}
