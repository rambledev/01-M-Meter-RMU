import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import { hashPassword } from "@/lib/admin/password";
import type { UserDTO } from "@/lib/admin/types";
import {
  isValidRole,
  validateRequiredString,
  validateZoneIds,
} from "@/lib/admin/validation";

async function listUsers(): Promise<UserDTO[]> {
  const users = await prisma.user.findMany({
    include: {
      _count: { select: { readings: true } },
      responsibleZones: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    responsibleZones: u.responsibleZones,
    readingCount: u._count.readings,
  }));
}

// Password is optional here: a blank/absent value means "keep the current
// password" — the edit form never shows or requires the existing one.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  const username = validateRequiredString(body?.username);
  const zoneIds = validateZoneIds(body?.zoneIds);
  if (!name) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อ-สกุล");
  if (!username) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุ Username");
  if (!isValidRole(body?.role)) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกบทบาทให้ถูกต้อง");
  }
  if (!zoneIds) return apiError(400, "VALIDATION_ERROR", "โซนที่รับผิดชอบไม่ถูกต้อง");

  const newPassword = validateRequiredString(body?.password);

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        username,
        role: body.role,
        responsibleZones: { set: zoneIds.map((zid) => ({ id: zid })) },
        ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return apiError(404, "NOT_FOUND", "ไม่พบผู้ใช้งานนี้ (หรือไม่พบโซนที่เลือกบางรายการ)");
      }
      if (err.code === "P2002") {
        return apiError(409, "DUPLICATE", "มี Username นี้อยู่แล้วในระบบ");
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
