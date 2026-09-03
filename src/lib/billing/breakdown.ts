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
}

// Per-reading breakdown for the "ดูวิธีคำนวณ" panel — composed entirely from
// the Calculation Service's own functions, no separate formula here.
export function buildBillingBreakdown(
  confirmedValue: number,
  previousReading: number | null,
  config: BillingConfig,
): BillingBreakdown {
  const billing = calculateBilling(confirmedValue, previousReading, config);
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
  };
}
