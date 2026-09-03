import type { BillingConfig } from "@/lib/billing/types";

// The client sends its current (possibly user-edited) BillingConfig as a
// JSON query param so the SAME Calculation Service formula runs server-side
// with the SAME rates the user sees on screen (Phase 6B kickoff §10: "ห้ามมี
// สูตรค่าไฟอีกชุดหนึ่งใน Excel route"). A missing/malformed value is not a
// request error — the caller falls back to the default config instead.
export function parseBillingConfigParam(raw: string | null): BillingConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.ftRate !== "number" ||
      typeof parsed?.taxRatePercent !== "number" ||
      typeof parsed?.baseCharge !== "number" ||
      !Array.isArray(parsed?.tiers)
    ) {
      return null;
    }
    return parsed as BillingConfig;
  } catch {
    return null;
  }
}
