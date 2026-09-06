import { NextResponse } from "next/server";
import { getOrSeedBillingConfig } from "@/lib/billing/billingConfigServer";

// Public read — the ONE shared Billing Configuration, edited by Admin
// (/admin, tab "ตั้งค่าค่าไฟ") and read by every /checker device (with an
// offline-cached fallback — src/lib/offline/billingConfigRepository.ts).
// Was per-device IndexedDB config; moved server-side 2026-09-06 so every
// device sees the same rate.
export async function GET() {
  const config = await getOrSeedBillingConfig();
  return NextResponse.json({ ok: true, data: config });
}
