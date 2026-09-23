import { NextResponse } from "next/server";
import { listFtRates } from "@/lib/billing/ftService";

const MAX_ANNOUNCEMENTS = 5;

// GET /api/billing/ft/announcements — public, read-only: the most recent
// Ft rate months that have at least one announcement document attached,
// for the "ประกาศปรับค่า Ft" section on /resident and the home login page
// (2026-09-23). A month with no document is just a rate change with
// nothing to announce, so it's filtered out here rather than left for
// every caller to skip.
export async function GET() {
  const list = await listFtRates();
  const withDocuments = list.filter((ft) => ft.documents.length > 0).slice(0, MAX_ANNOUNCEMENTS);
  return NextResponse.json({ ok: true, data: withDocuments });
}
