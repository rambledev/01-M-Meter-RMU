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
  // Explicit field-by-field mapping — passwordHash must never reach the client.
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    responsibleZones: u.responsibleZones,
    readingCount: u._count.readings,
  }));
}

export async function GET() {
  return NextResponse.json({ ok: true, data: await listUsers() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  const username = validateRequiredString(body?.username);
  const password = validateRequiredString(body?.password);
  const zoneIds = validateZoneIds(body?.zoneIds);
  if (!name) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อ-สกุล");
  if (!username) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุ Username");
  if (!password) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุ Password");
  if (!isValidRole(body?.role)) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกบทบาทให้ถูกต้อง");
  }
  if (!zoneIds) return apiError(400, "VALIDATION_ERROR", "โซนที่รับผิดชอบไม่ถูกต้อง");

  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role: body.role,
        responsibleZones: { connect: zoneIds.map((id) => ({ id })) },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return apiError(409, "DUPLICATE", "มี Username นี้อยู่แล้วในระบบ");
      }
      if (err.code === "P2025") {
        return apiError(400, "VALIDATION_ERROR", "ไม่พบโซนที่เลือกบางรายการ");
      }
    }
    return apiError(500, "INTERNAL_ERROR", "เพิ่มผู้ใช้งานไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listUsers() }, { status: 201 });
}
