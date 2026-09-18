import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { enableFtRate, FtRateNotFoundError } from "@/lib/billing/ftService";
import { validateFtReason } from "@/lib/billing/ftValidation";

// POST /api/admin/ft/:id/enable — Admin เท่านั้น เปลี่ยนสถานะกลับเป็น ACTIVE.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = validateFtReason(body?.reason);

  try {
    const updated = await enableFtRate(id, auth.adminId, reason);
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    if (err instanceof FtRateNotFoundError) {
      return apiError(404, "NOT_FOUND", "ไม่พบข้อมูล Ft นี้");
    }
    return apiError(500, "INTERNAL_ERROR", "เปิดใช้งาน Ft ไม่สำเร็จ");
  }
}
