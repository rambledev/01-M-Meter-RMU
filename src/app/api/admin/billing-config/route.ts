import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { saveBillingConfig } from "@/lib/billing/billingConfigServer";
import { validateTiers } from "@/lib/billing/tierValidation";
import type { BillingConfig, BillingTier } from "@/lib/billing/types";

function parseTiers(raw: unknown): BillingTier[] | null {
  if (!Array.isArray(raw)) return null;
  const tiers: BillingTier[] = [];
  for (const item of raw) {
    if (
      typeof item?.minUnit !== "number" ||
      (item.maxUnit !== null && typeof item.maxUnit !== "number") ||
      typeof item?.rate !== "number"
    ) {
      return null;
    }
    tiers.push({ minUnit: item.minUnit, maxUnit: item.maxUnit, rate: item.rate });
  }
  return tiers;
}

// Admin-only write for the one shared Billing Configuration — read is
// public (GET /api/billing-config), used by /checker too.
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  const ftRate = Number(body?.ftRate);
  const taxRatePercent = Number(body?.taxRatePercent);
  const baseCharge = Number(body?.baseCharge);
  const highUsageThreshold = Number(body?.highUsageThreshold);
  const lowUsageTiers = parseTiers(body?.lowUsageTiers);
  const highUsageTiers = parseTiers(body?.highUsageTiers);

  if (
    !Number.isFinite(ftRate) ||
    ftRate < 0 ||
    !Number.isFinite(taxRatePercent) ||
    taxRatePercent < 0 ||
    !Number.isFinite(baseCharge) ||
    baseCharge < 0 ||
    !Number.isFinite(highUsageThreshold) ||
    highUsageThreshold <= 0 ||
    lowUsageTiers === null ||
    highUsageTiers === null
  ) {
    return apiError(400, "VALIDATION_ERROR", "ข้อมูลตั้งค่าค่าไฟไม่ถูกต้อง");
  }

  for (const [label, tiers] of [
    ["ช่วงอัตราค่าไฟ (ไม่เกิน)", lowUsageTiers],
    ["ช่วงอัตราค่าไฟ (มากกว่า)", highUsageTiers],
  ] as const) {
    const tierResult = validateTiers(tiers);
    if (!tierResult.valid) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        `${label}: ${tierResult.errors[0]?.message ?? "ไม่ถูกต้อง"}`,
      );
    }
  }

  const config: BillingConfig = {
    ftRate,
    taxRatePercent,
    baseCharge,
    highUsageThreshold,
    lowUsageTiers,
    highUsageTiers,
  };
  const saved = await saveBillingConfig(config);
  return NextResponse.json({ ok: true, data: saved });
}
