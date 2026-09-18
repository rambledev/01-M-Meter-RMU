import { NextResponse } from "next/server";
import { listFtRates } from "@/lib/billing/ftService";

// GET /api/admin/ft/list — every Ft record (ทุกเดือน ทุกสถานะ) เรียงล่าสุดก่อน,
// สำหรับตาราง "ประวัติ Ft" ในหน้า Admin — read-only, ไม่ต้อง admin.
export async function GET() {
  const list = await listFtRates();
  return NextResponse.json({ ok: true, data: list });
}
