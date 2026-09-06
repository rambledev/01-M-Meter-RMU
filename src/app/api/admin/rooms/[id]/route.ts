import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import { cascadeDeleteRoom } from "@/lib/admin/cascadeDelete";
import type { RoomDTO } from "@/lib/admin/types";
import {
  validateOptionalString,
  validateRequiredString,
} from "@/lib/admin/validation";

async function listRooms(): Promise<RoomDTO[]> {
  const rooms = await prisma.room.findMany({
    include: { zone: true, _count: { select: { meters: true } } },
    orderBy: { name: "asc" },
  });
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    residentName: r.residentName,
    zoneId: r.zoneId,
    zoneName: r.zone.name,
    meterCount: r._count.meters,
  }));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  const zoneId = validateRequiredString(body?.zoneId);
  const residentName = validateOptionalString(body?.residentName);
  if (!name) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อห้องพัก");
  if (!zoneId) return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกโซน");

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return apiError(400, "VALIDATION_ERROR", "ไม่พบโซนที่เลือก");

  try {
    await prisma.room.update({ where: { id }, data: { name, residentName, zoneId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError(404, "NOT_FOUND", "ไม่พบห้องพักนี้");
    }
    return apiError(500, "INTERNAL_ERROR", "แก้ไขห้องพักไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listRooms() });
}

// By explicit request, this deletes the Room even when Meters/Reading
// history hang off it — cascadeDeleteRoom removes all of it (Reading,
// ReadingImage, SyncLog, Meter, Room) permanently. The client shows a
// count-based warning before calling this (src/components/admin/RoomManager.tsx).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return apiError(404, "NOT_FOUND", "ไม่พบห้องพักนี้");

  try {
    await cascadeDeleteRoom(id);
  } catch {
    return apiError(500, "INTERNAL_ERROR", "ลบห้องพักไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listRooms() });
}
