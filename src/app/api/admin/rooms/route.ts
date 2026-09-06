import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
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

export async function GET() {
  return NextResponse.json({ ok: true, data: await listRooms() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  const zoneId = validateRequiredString(body?.zoneId);
  const residentName = validateOptionalString(body?.residentName);
  if (!name) return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อห้องพัก");
  if (!zoneId) return apiError(400, "VALIDATION_ERROR", "กรุณาเลือกโซน");

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return apiError(400, "VALIDATION_ERROR", "ไม่พบโซนที่เลือก");

  await prisma.room.create({ data: { name, residentName, zoneId } });
  return NextResponse.json({ ok: true, data: await listRooms() }, { status: 201 });
}
