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
  // Explicit field-by-field mapping — passwordHash must never reach the client.
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

export async function GET() {
  return NextResponse.json({ ok: true, data: await listUsers() });
}

// RESIDENT accounts log in via Google (@rmu.ac.th only — no username/
// password at all, src/app/api/resident/google-login), so an Admin
// pre-creating one needs an email instead; every other role still needs
// username+password as before.
export async function POST(request: Request) {
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
  const password = isResident ? null : validateRequiredString(body?.password);
  if (isResident && !email) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุอีเมล @rmu.ac.th ให้ถูกต้อง");
  }
  if (!isResident && !username) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุ Username");
  if (!isResident && !password) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุ Password");

  const passwordHash = password ? await hashPassword(password) : null;
  try {
    await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role: body.role,
        responsibleZones: { connect: zoneIds.map((id) => ({ id })) },
        ...(roomId ? { residentRoom: { connect: { id: roomId } } } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return apiError(409, "DUPLICATE", isResident ? "มีอีเมลนี้อยู่แล้วในระบบ" : "มี Username นี้อยู่แล้วในระบบ");
      }
      if (err.code === "P2025") {
        return apiError(400, "VALIDATION_ERROR", "ไม่พบโซนหรือห้องพักที่เลือกบางรายการ");
      }
    }
    return apiError(500, "INTERNAL_ERROR", "เพิ่มผู้ใช้งานไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listUsers() }, { status: 201 });
}
