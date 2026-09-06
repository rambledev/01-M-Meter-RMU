import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import { cascadeDeleteZone } from "@/lib/admin/cascadeDelete";
import type { ZoneDTO } from "@/lib/admin/types";
import { validateRequiredString } from "@/lib/admin/validation";

async function listZones(): Promise<ZoneDTO[]> {
  const zones = await prisma.zone.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: "asc" },
  });
  return zones.map((z) => ({ id: z.id, name: z.name, roomCount: z._count.rooms }));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  if (!name) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อโซน");
  }

  try {
    await prisma.zone.update({ where: { id }, data: { name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError(404, "NOT_FOUND", "ไม่พบโซนนี้");
    }
    return apiError(500, "INTERNAL_ERROR", "แก้ไขโซนไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listZones() });
}

// By explicit request, this deletes the Zone even when Rooms/Meters/Reading
// history hang off it — cascadeDeleteZone removes all of it (Reading,
// ReadingImage, SyncLog, Meter, Room, Zone) permanently. The client shows a
// count-based warning before calling this (src/components/admin/ZoneManager.tsx).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await cascadeDeleteZone(id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError(404, "NOT_FOUND", "ไม่พบโซนนี้");
    }
    return apiError(500, "INTERNAL_ERROR", "ลบโซนไม่สำเร็จ");
  }

  return NextResponse.json({ ok: true, data: await listZones() });
}
