import { NextResponse } from "next/server";
import { getFtHistory } from "@/lib/billing/ftService";

// GET /api/admin/ft/:id/history — ประวัติการเปลี่ยนแปลง Ft ของเดือนนี้ทั้งหมด
// (append-only, เรียงเก่า->ใหม่) — read-only, ไม่ต้อง admin.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await getFtHistory(id);
  return NextResponse.json({ ok: true, data: history });
}
