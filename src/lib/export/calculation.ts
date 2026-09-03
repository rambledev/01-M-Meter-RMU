// Calculation Service (export-format.md §3) — kept separate from Excel
// generation on purpose, and separate from Billing Configuration storage
// (src/lib/billing/) too: every rate/threshold used here arrives as a
// `BillingConfig` parameter, nothing is hard-coded in this file (Phase 6B
// kickoff item 3). Both the reading workflow UI and the Excel export route
// call these same functions with the same config — never two formulas.
//
// IMPORTANT (Phase 6B): the base-charge tier rates in the default config
// (src/lib/billing/defaultConfig.ts) are a "สูตรเบื้องต้นจากเอกสารตัวอย่าง"
// (a preliminary formula transcribed from a sample document), NOT an
// officially confirmed tariff — never present it as "สูตรทางการ" anywhere
// this Calculation Service's output is shown.

import type { BillingConfig, BillingTier } from "@/lib/billing/types";
import { calculateUsage as calculateUsageShared } from "@/lib/reading/readingMonth";

// Thin null-friendly wrapper around the single shared implementation of the
// locked formula — the reading workflow (client) and this export service
// (server) both call the same formula, never two copies of it.
export function calculateUsage(
  confirmedValue: number,
  previousReading: number | null,
): number | null {
  const usage = calculateUsageShared(confirmedValue, previousReading ?? undefined);
  return usage ?? null;
}

export interface TierChargeLine {
  tier: BillingTier;
  units: number; // portion of usage billed at this tier's rate
  charge: number; // units * tier.rate
}

// Standard graduated/progressive-bracket calculation (like income tax
// brackets): each tier bills the portion of `usage` that falls between its
// own minUnit and min(usage, maxUnit). This is the simplest general-purpose
// implementation — it is NOT tuned to reproduce any specific worked example
// from the source document exactly (Phase 6B kickoff §3: "อย่าฝืนแก้สูตรเพื่อ
// ให้ Test ผ่าน").
export function computeTierBreakdown(
  usage: number,
  tiers: BillingTier[],
): TierChargeLine[] {
  return tiers.map((tier) => {
    const cap = tier.maxUnit ?? Infinity;
    const units = Math.max(0, Math.min(usage, cap) - tier.minUnit);
    return { tier, units, charge: units * tier.rate };
  });
}

// ค่าไฟพื้นฐาน = ค่าบริการคงที่ (config.baseCharge) + ผลรวมค่าไฟตามช่วงอัตรา
export function calculateBaseCharge(
  usage: number | null,
  config: BillingConfig,
): number | null {
  if (usage === null) return null;
  const tiered = computeTierBreakdown(usage, config.tiers).reduce(
    (sum, line) => sum + line.charge,
    0,
  );
  return config.baseCharge + tiered;
}

// ค่า FT = หน่วยที่ใช้ × ftRate
export function calculateFT(
  usage: number | null,
  config: BillingConfig,
): number | null {
  if (usage === null) return null;
  return usage * config.ftRate;
}

// ภาษี = (ค่าไฟพื้นฐาน + ค่า FT) × taxRatePercent
export function calculateTax(
  baseCharge: number | null,
  ft: number | null,
  config: BillingConfig,
): number | null {
  if (baseCharge === null || ft === null) return null;
  return (baseCharge + ft) * (config.taxRatePercent / 100);
}

// รวมทั้งสิ้น = ค่าไฟพื้นฐาน + ค่า FT + ภาษี
export function calculateTotal(
  baseCharge: number | null,
  ft: number | null,
  tax: number | null,
): number | null {
  if (baseCharge === null || ft === null || tax === null) return null;
  return baseCharge + ft + tax;
}

export interface BillingCalculation {
  usage: number | null;
  baseCharge: number | null; // ค่าไฟพื้นฐาน
  ft: number | null; // ค่า FT
  tax: number | null; // ภาษี
  total: number | null; // รวมทั้งสิ้น
}

// No previousReading -> calculateUsage returns null -> the whole bill is
// null (Phase 6B kickoff §4: "ห้ามเดาค่า previous"; a partial bill built on
// an unknown usage would be misleading, so it is withheld entirely rather
// than only zeroing the usage-dependent fields).
//
// Values are returned at full precision — round only when displaying
// (Phase 6B kickoff §5: "อย่าปัดค่ากลางโดยไม่จำเป็น").
export function calculateBilling(
  confirmedValue: number | null,
  previousReading: number | null,
  config: BillingConfig,
): BillingCalculation {
  const usage =
    confirmedValue !== null ? calculateUsage(confirmedValue, previousReading) : null;
  if (usage === null) {
    return { usage: null, baseCharge: null, ft: null, tax: null, total: null };
  }

  const baseCharge = calculateBaseCharge(usage, config);
  const ft = calculateFT(usage, config);
  const tax = calculateTax(baseCharge, ft, config);
  const total = calculateTotal(baseCharge, ft, tax);
  return { usage, baseCharge, ft, tax, total };
}
