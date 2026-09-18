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
//
// ftRate is passed in explicitly — resolved per the Reading's own
// readingMonth by src/lib/billing/ftResolver.ts (2026-09-17: Ft became a
// Monthly Rate, no longer a field read off BillingConfig). `null` means the
// month has no configured Ft ("FT_NOT_CONFIGURED") — this function has no
// notion of "current"/"default"/"previous month" to fall back to; the
// caller (calculateBilling below) is responsible for withholding the whole
// bill rather than silently computing ft as 0.
export function calculateFT(
  usage: number | null,
  ftRate: number | null,
): number | null {
  if (usage === null || ftRate === null) return null;
  return usage * ftRate;
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
  // true เมื่อรู้ usage แล้วแต่ยังไม่มี Ft ของเดือนนั้น (FT_NOT_CONFIGURED) —
  // ต่างจาก usage === null (ยังไม่รู้ usage เลย) ธงนี้บอกสาเหตุที่บิลทั้งชุด
  // ถูกงดแสดงว่าเป็นเพราะ "ไม่มี Ft" ไม่ใช่ "ไม่มี previousReading"
  ftNotConfigured: boolean;
}

// No previousReading -> calculateUsage returns null -> the whole bill is
// null (Phase 6B kickoff §4: "ห้ามเดาค่า previous"; a partial bill built on
// an unknown usage would be misleading, so it is withheld entirely rather
// than only zeroing the usage-dependent fields). Same principle applied
// 2026-09-17 to a month with no configured Ft: `resolvedFtRate` is
// whatever src/lib/billing/ftResolver.ts resolved for THIS reading's own
// readingMonth (never "current"/"latest"/any other month) — null means not
// configured, and the whole bill is withheld (ftNotConfigured: true)
// instead of silently computing a partial/misleading total.
//
// Values are returned at full precision — round only when displaying
// (Phase 6B kickoff §5: "อย่าปัดค่ากลางโดยไม่จำเป็น").
export function calculateBilling(
  confirmedValue: number | null,
  previousReading: number | null,
  config: BillingConfig,
  resolvedFtRate: number | null,
): BillingCalculation {
  const usage =
    confirmedValue !== null ? calculateUsage(confirmedValue, previousReading) : null;
  if (usage === null) {
    return { usage: null, baseCharge: null, ft: null, tax: null, total: null, ftNotConfigured: false };
  }
  if (resolvedFtRate === null) {
    return { usage, baseCharge: null, ft: null, tax: null, total: null, ftNotConfigured: true };
  }

  const baseCharge = calculateBaseCharge(usage, config);
  const ft = calculateFT(usage, resolvedFtRate);
  const tax = calculateTax(baseCharge, ft, config);
  const total = calculateTotal(baseCharge, ft, tax);
  return { usage, baseCharge, ft, tax, total, ftNotConfigured: false };
}
