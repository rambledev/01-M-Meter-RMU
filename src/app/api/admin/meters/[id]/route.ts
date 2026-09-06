import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import type { MeterDTO } from "@/lib/admin/types";
import { validateRequiredString } from "@/lib/admin/validation";

async function listMeters(): Promise<MeterDTO[]> {
  const meters = await prisma.meter.findMany({
    include: { room: { include: { zone: true } }, _count: { select: { readings: true } } },
    orderBy: { code: "asc" },
  });
  return meters.map((m) => ({
    id: m.id,
    code: m.code,
    roomId: m.roomId,
    roomName: m.room.name,
    zoneName: m.room.zone.name,
    readingCount: m._count.readings,
  }));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const code = validateRequiredString(body?.code);
  const roomId = validateRequiredString(body?.roomId);
  if (!code) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุรหัสมิเตอร์");
  if (!roomId) return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกห้องพัก");

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return apiError(400, "VALIDATION_ERROR", "ไม่พบห้องพักที่เลือก");

  try {
    await prisma.meter.update({ where: { id }, data: { code, roomId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return apiError(409, "DUPLICATE", "มีรหัสมิเตอร์นี้อยู่แล้วในระบบ");
      }
      if (err.code === "P2025") {
        return apiError(404, "NOT_FOUND", "ไม่พบมิเตอร์นี้");
      }
    }
    return apiError(500, "INTERNAL_ERROR", "แก้ไขมิเตอร์ไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listMeters() });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const readingCount = await prisma.reading.count({ where: { meterId: id } });
  if (readingCount > 0) {
    return apiError(
      409,
      "HAS_DEPENDENTS",
      `ไม่สามารถลบมิเตอร์นี้ได้ เนื่องจากมีประวัติการอ่านมิเตอร์ผูกอยู่ ${readingCount} รายการ`,
    );
  }

  try {
    await prisma.meter.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError(404, "NOT_FOUND", "ไม่พบมิเตอร์นี้");
    }
    return apiError(500, "INTERNAL_ERROR", "ลบมิเตอร์ไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listMeters() });
}
