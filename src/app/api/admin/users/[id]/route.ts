import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import { hashPassword } from "@/lib/admin/password";
import type { UserDTO } from "@/lib/admin/types";
import {
  isValidRole,
  validateOptionalString,
  validateRequiredString,
  validateResidentEmail,
  validateZoneIds,
} from "@/lib/admin/validation";

async function listUsers(): Promise<UserDTO[]> {
  const users = await prisma.user.findMany({
    include: {
      _count: { select: { readings: true } },
      responsibleZones: { select: { id: true, name: true } },
      residentRoom: { include: { zone: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role,
    responsibleZones: u.responsibleZones,
    residentRoom: u.residentRoom
      ? { id: u.residentRoom.id, name: u.residentRoom.name, zoneName: u.residentRoom.zone.name }
      : null,
    readingCount: u._count.readings,
  }));
}

// Password is optional here: a blank/absent value means "keep the current
// password" — the edit form never shows or requires the existing one.
// RESIDENT accounts have no password at all (Google login) — username/
// password are only required for every other role.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  const zoneIds = validateZoneIds(body?.zoneIds);
  const roomId = validateOptionalString(body?.roomId);
  if (!name) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อ-สกุล");
  if (!isValidRole(body?.role)) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกบทบาทให้ถูกต้อง");
  }
  if (!zoneIds) return apiError(400, "VALIDATION_ERROR", "โซนที่รับผิดชอบไม่ถูกต้อง");

  const isResident = body.role === "RESIDENT";
  const email = isResident ? validateResidentEmail(body?.email) : null;
  const username = isResident ? null : validateRequiredString(body?.username);
  if (isResident && !email) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุอีเมล @rmu.ac.th ให้ถูกต้อง");
  }
  if (!isResident && !username) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุ Username");

  const newPassword = isResident ? null : validateRequiredString(body?.password);

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        username,
        email,
        role: body.role,
        responsibleZones: { set: zoneIds.map((zid) => ({ id: zid })) },
        residentRoom: roomId ? { connect: { id: roomId } } : { disconnect: true },
        ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return apiError(404, "NOT_FOUND", "ไม่พบผู้ใช้งานนี้ (หรือไม่พบโซน/ห้องพักที่เลือกบางรายการ)");
      }
      if (err.code === "P2002") {
        return apiError(409, "DUPLICATE", isResident ? "มีอีเมลนี้อยู่แล้วในระบบ" : "มี Username นี้อยู่แล้วในระบบ");
      }
    }
    return apiError(500, "INTERNAL_ERROR", "แก้ไขผู้ใช้งานไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listUsers() });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const readingCount = await prisma.reading.count({ where: { recordedBy: id } });
  if (readingCount > 0) {
    return apiError(
      409,
      "HAS_DEPENDENTS",
      `ไม่สามารถลบผู้ใช้งานนี้ได้ เนื่องจากมีประวัติการบันทึกผูกอยู่ ${readingCount} รายการ`,
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError(404, "NOT_FOUND", "ไม่พบผู้ใช้งานนี้");
    }
    return apiError(500, "INTERNAL_ERROR", "ลบผู้ใช้งานไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listUsers() });
}
