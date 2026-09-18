import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { prisma } from "@/lib/db/prisma";
import { verifyGoogleIdToken } from "@/lib/resident/googleAuth";

// Self-service signup from the role picker on /login (2026-09-16) — a
// brand-new @rmu.ac.th Google account picks its own desired role here, but
// never goes live immediately: created with isApproved=false, so an Admin
// must approve it at /admin (ข้อมูลผู้ใช้งาน) before /api/auth/login (or
// the checker/resident login routes) will let it in. ADMIN is
// intentionally not a selectable role here — self-service registration
// can never create an Admin account, only a checker or resident applies
// for approval.
const SELF_SERVICE_ROLES = new Set(["METER_READER", "RESIDENT"]);

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string")) return null;
  return value;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const zoneIds = toStringArray(body?.zoneIds) ?? [];

  if (!credential) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบข้อมูลการเข้าสู่ระบบจาก Google");
  }
  if (!SELF_SERVICE_ROLES.has(role)) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกบทบาทให้ถูกต้อง");
  }
  // (2026-09-18) A new resident picks their zone/room as part of this same
  // registration step — required here, not left for a later one-time
  // picker on /resident (src/app/api/resident/room/route.ts), which still
  // exists only as a fallback for accounts that somehow end up without one
  // (e.g. an Admin-created RESIDENT account).
  if (role === "RESIDENT" && !roomId) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกโซนและบ้านพัก/ห้องพัก");
  }
  // Same idea for a new METER_READER: which zone(s) they'll collect meter
  // readings for, picked now instead of assigned later by an Admin.
  if (role === "METER_READER" && zoneIds.length === 0) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกโซนที่รับผิดชอบในการเก็บมิเตอร์อย่างน้อย 1 โซน");
  }

  const verified = await verifyGoogleIdToken(credential);
  if (!verified) {
    return apiError(
      401,
      "VALIDATION_ERROR",
      "เข้าสู่ระบบไม่สำเร็จ — อนุญาตเฉพาะอีเมล @rmu.ac.th เท่านั้น",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: verified.email } });
  if (existing) {
    return apiError(409, "DUPLICATE", "มีบัญชีนี้อยู่แล้วในระบบ กรุณาเข้าสู่ระบบตามปกติ");
  }

  let room = null;
  if (role === "RESIDENT") {
    room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return apiError(400, "VALIDATION_ERROR", "ไม่พบโซนหรือบ้านพัก/ห้องพักที่เลือก");
    }
  }

  if (role === "METER_READER") {
    const zoneCount = await prisma.zone.count({ where: { id: { in: zoneIds } } });
    if (zoneCount !== zoneIds.length) {
      return apiError(400, "VALIDATION_ERROR", "ไม่พบโซนที่เลือกบางรายการ");
    }
  }

  await prisma.user.create({
    data: {
      name: verified.name,
      email: verified.email,
      role: role as "METER_READER" | "RESIDENT",
      isApproved: false,
      ...(room ? { residentRoom: { connect: { id: room.id } } } : {}),
      ...(role === "METER_READER"
        ? { responsibleZones: { connect: zoneIds.map((id) => ({ id })) } }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, data: { status: "pending" } });
}
