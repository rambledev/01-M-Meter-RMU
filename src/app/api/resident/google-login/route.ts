import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { prisma } from "@/lib/db/prisma";
import { verifyGoogleIdToken } from "@/lib/resident/googleAuth";

// ผู้พักอาศัย (Resident) login — Google Sign-In only, restricted to
// @rmu.ac.th (2026-09-09, replaces the earlier username/password login by
// explicit request: "ให้ login ด้วย gmail @rmu.ac.th เท่านั้น"). No
// admin-provisioned account needed beforehand — the first successful
// Google login for a given @rmu.ac.th email auto-creates its RESIDENT
// User row (with no room yet); an Admin can still pre-create one with a
// room already assigned via /admin, in which case this just finds it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";
  if (!credential) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบข้อมูลการเข้าสู่ระบบจาก Google");
  }

  const verified = await verifyGoogleIdToken(credential);
  if (!verified) {
    return apiError(401, "VALIDATION_ERROR", "เข้าสู่ระบบไม่สำเร็จ — อนุญาตเฉพาะอีเมล @rmu.ac.th เท่านั้น");
  }

  let user = await prisma.user.findUnique({
    where: { email: verified.email },
    include: { residentRoom: { include: { zone: { select: { name: true } } } } },
  });

  if (user && user.role !== "RESIDENT") {
    return apiError(401, "VALIDATION_ERROR", "อีเมลนี้ไม่ได้ลงทะเบียนเป็นผู้พักอาศัย");
  }

  if (!user) {
    const created = await prisma.user.create({
      data: { name: verified.name, email: verified.email, role: "RESIDENT" },
    });
    user = { ...created, residentRoom: null };
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: user.id,
      name: user.name,
      email: verified.email,
      room: user.residentRoom
        ? { id: user.residentRoom.id, name: user.residentRoom.name, zoneName: user.residentRoom.zone.name }
        : null,
    },
  });
}
