import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createFtRate, DuplicateFtMonthError, getFtByMonth } from "@/lib/billing/ftService";
import { validateFtNotes, validateFtRateValue, validateReadingMonthParam } from "@/lib/billing/ftValidation";

// GET /api/admin/ft?month=YYYY-MM — Ft (ถ้ามี) ของเดือนนั้นเดือนเดียว
// (ต่างจาก GET /api/admin/ft/list ที่คืนทุกเดือน) — read-only, ไม่ต้อง admin
// (ใช้แสดงผลในหน้าตั้งค่าได้ทั่วไป เหมือน GET /api/billing-config เดิม).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const readingMonth = validateReadingMonthParam(month);
  if (!month || !readingMonth) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุเดือนให้ถูกต้อง (YYYY-MM)");
  }

  const ft = await getFtByMonth(readingMonth);
  return NextResponse.json({ ok: true, data: ft });
}

// POST /api/admin/ft — สร้าง Ft ใหม่สำหรับเดือนหนึ่ง (Admin เท่านั้น). Duplicate
// month ถูกกันทั้งที่ชั้น application (ผ่าน getFtByMonth/DuplicateFtMonthError
// ใน ftService) และที่ database (@@unique([readingMonth]) — P2002 ถูกจับซ้ำ
// อีกชั้นด้านล่างเผื่อ race condition ระหว่างสองคำขอพร้อมกัน).
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  const body = await request.json().catch(() => null);
  const readingMonth = validateReadingMonthParam(body?.readingMonth);
  const ftRate = validateFtRateValue(body?.ftRate);
  const notes = validateFtNotes(body?.notes);

  if (!readingMonth) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุเดือนให้ถูกต้อง (YYYY-MM)");
  }
  if (ftRate === null) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุค่า Ft ให้ถูกต้อง (ต้องไม่ติดลบ)");
  }

  try {
    const created = await createFtRate({ readingMonth, ftRate, notes, createdBy: auth.adminId });
    return NextResponse.json({ ok: true, data: created });
  } catch (err) {
    if (err instanceof DuplicateFtMonthError) {
      return apiError(409, "DUPLICATE", "มี Ft ของเดือนนี้อยู่แล้ว");
    }
    // Real Prisma's DB-level @@unique([readingMonth]) as a second line of
    // defense against a race between two concurrent create requests for
    // the same month.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return apiError(409, "DUPLICATE", "มี Ft ของเดือนนี้อยู่แล้ว");
    }
    return apiError(500, "INTERNAL_ERROR", "บันทึก Ft ไม่สำเร็จ");
  }
}
