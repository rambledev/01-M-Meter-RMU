import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { FtRateNotFoundError, updateFtRate } from "@/lib/billing/ftService";
import { validateFtNotes, validateFtRateValue } from "@/lib/billing/ftValidation";

// PUT /api/admin/ft/:id — แก้ไขค่า Ft ของเดือนเดิม (in-place — ไม่สร้าง record
// เดือนใหม่) Admin เท่านั้น เขียน FtRateHistory action "UPDATE" เสมอ
// (ftService.updateFtRate ทำใน transaction เดียวกัน — ถ้า history insert fail
// การแก้ไขค่า Ft จะ rollback ทั้งหมดด้วย).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const ftRate = validateFtRateValue(body?.ftRate);
  const notes = validateFtNotes(body?.notes);

  if (ftRate === null) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุค่า Ft ให้ถูกต้อง (ต้องไม่ติดลบ)");
  }

  try {
    const updated = await updateFtRate(id, { ftRate, notes, performedBy: auth.adminId });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    if (err instanceof FtRateNotFoundError) {
      return apiError(404, "NOT_FOUND", "ไม่พบข้อมูล Ft นี้");
    }
    return apiError(500, "INTERNAL_ERROR", "แก้ไข Ft ไม่สำเร็จ");
  }
}
