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
// own floor and min(usage, maxUnit). This is the simplest general-purpose
// implementation — it is NOT tuned to reproduce any specific worked example
// from the source document exactly (Phase 6B kickoff §3: "อย่าฝืนแก้สูตรเพื่อ
// ให้ Test ผ่าน").
//
// The floor for tier i>0 is the PREVIOUS tier's maxUnit, not this tier's own
// minUnit (2026-09-22 fix). Tiers are configured inclusive on both ends
// (e.g. "0–15" then "16–25" — tierValidation.ts requires
// curr.minUnit > prev.maxUnit precisely to express that), so minUnit is
// already 1 past the previous tier's boundary. Subtracting minUnit directly
// silently dropped exactly 1 unit at every tier crossing (audit report,
// 2026-09-22) — using the previous tier's maxUnit as a continuous running
// boundary keeps sum(units) === usage at every crossing, including into the
// last, uncapped tier.
export function computeTierBreakdown(
  usage: number,
  tiers: BillingTier[],
): TierChargeLine[] {
  let prevCap = tiers.length > 0 ? tiers[0].minUnit : 0;
  return tiers.map((tier, index) => {
    const cap = tier.maxUnit ?? Infinity;
    const floor = index === 0 ? tier.minUnit : prevCap;
    const units = Math.max(0, Math.min(usage, cap) - floor);
    prevCap = tier.maxUnit ?? cap;
    return { tier, units, charge: units * tier.rate };
  });
}

// เลือกช่วงอัตราค่าไฟทั้งตาราง (ไม่ใช่ทีละ tier) ตามหน่วยที่ใช้ทั้งเดือน — usage
// <= highUsageThreshold ใช้ lowUsageTiers ทั้งตาราง, usage > highUsageThreshold
// ใช้ highUsageTiers ทั้งตาราง (2026-09-22, ตามคำสั่งผู้ใช้: "รองรับ 2 กรณี").
// จุดเดียวที่ตัดสินใจเรื่องนี้ — calculateBaseCharge() และ
// src/lib/billing/breakdown.ts (สำหรับแสดง tierLines ใน UI) เรียกจากที่นี่
// เหมือนกันทั้งคู่ ไม่มีการเช็ค threshold ซ้ำที่อื่น.
export function selectTiersForUsage(usage: number, config: BillingConfig): BillingTier[] {
  return usage <= config.highUsageThreshold ? config.lowUsageTiers : config.highUsageTiers;
}

// ค่าพื้นฐานรวม = ผลรวม(จำนวนหน่วยแต่ละช่วง × อัตราของช่วง) — 2026-09-22: ไม่รวม
// ค่าบริการ (config.baseCharge) อีกต่อไป (เดิมบวกไว้ตั้งแต่ขั้นนี้) ค่าบริการถูก
// เลื่อนไปบวกครั้งเดียวตอนท้ายสุดใน calculateTotal() แทน ตามสูตรที่ผู้ใช้กำหนด
// เลือกตารางช่วงอัตราตามหน่วยที่ใช้ทั้งเดือนก่อน ผ่าน selectTiersForUsage() — ใช้
// สูตรเดียวกันทั้งกรณีไม่เกิน 150 และเกิน 150 หน่วย (ต่างกันแค่ตารางที่เลือก)
export function calculateBaseCharge(
  usage: number | null,
  config: BillingConfig,
): number | null {
  if (usage === null) return null;
  return computeTierBreakdown(usage, selectTiersForUsage(usage, config)).reduce(
    (sum, line) => sum + line.charge,
    0,
  );
}

// ค่า FT = ค่าพื้นฐานรวม (บาท, ไม่รวมค่าบริการ) × ftRate
//
// ftRate is passed in explicitly — resolved per the Reading's own
// readingMonth by src/lib/billing/ftResolver.ts (2026-09-17: Ft became a
// Monthly Rate, no longer a field read off BillingConfig). `null` means the
// month has no configured Ft ("FT_NOT_CONFIGURED") — this function has no
// notion of "current"/"default"/"previous month" to fall back to; the
// caller (calculateBilling below) is responsible for withholding the whole
// bill rather than silently computing ft as 0.
export function calculateFT(
  baseCharge: number | null,
  ftRate: number | null,
): number | null {
  if (baseCharge === null || ftRate === null) return null;
  return baseCharge * ftRate;
}

// ค่าไฟก่อน VAT = ค่าพื้นฐานรวม + ค่า FT (2026-09-22) — named quantity from the
// user's formula, computed once here so calculateTax()/calculateTotal() (and
// the "ดูวิธีคำนวณ" breakdown, which displays it) never re-derive it separately.
export function calculatePreVatCharge(
  baseCharge: number | null,
  ft: number | null,
): number | null {
  if (baseCharge === null || ft === null) return null;
  return baseCharge + ft;
}

// VAT = ค่าไฟก่อน VAT × taxRatePercent
export function calculateTax(
  preVatCharge: number | null,
  config: BillingConfig,
): number | null {
  if (preVatCharge === null) return null;
  return preVatCharge * (config.taxRatePercent / 100);
}

// ค่าไฟสุทธิ = ค่าไฟก่อน VAT + VAT + ค่าบริการ (2026-09-22: ค่าบริการบวกเข้ามาที่นี่
// เป็นครั้งเดียว ไม่ถูกนำไปคิด FT/VAT — ต่างจากเดิมที่บวกไว้ตั้งแต่ calculateBaseCharge())
export function calculateTotal(
  preVatCharge: number | null,
  tax: number | null,
  config: BillingConfig,
): number | null {
  if (preVatCharge === null || tax === null) return null;
  return preVatCharge + tax + config.baseCharge;
}

export interface BillingCalculation {
  usage: number | null;
  baseCharge: number | null; // ค่าพื้นฐานรวม (ไม่รวมค่าบริการ)
  ft: number | null; // ค่า FT
  preVatCharge: number | null; // ค่าไฟก่อน VAT = baseCharge + ft
  tax: number | null; // VAT
  total: number | null; // ค่าไฟสุทธิ = preVatCharge + tax + ค่าบริการ
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
    return {
      usage: null,
      baseCharge: null,
      ft: null,
      preVatCharge: null,
      tax: null,
      total: null,
      ftNotConfigured: false,
    };
  }
  if (resolvedFtRate === null) {
    return {
      usage,
      baseCharge: null,
      ft: null,
      preVatCharge: null,
      tax: null,
      total: null,
      ftNotConfigured: true,
    };
  }

  const baseCharge = calculateBaseCharge(usage, config);
  const ft = calculateFT(baseCharge, resolvedFtRate);
  const preVatCharge = calculatePreVatCharge(baseCharge, ft);
  const tax = calculateTax(preVatCharge, config);
  const total = calculateTotal(preVatCharge, tax, config);
  return { usage, baseCharge, ft, preVatCharge, tax, total, ftNotConfigured: false };
}
