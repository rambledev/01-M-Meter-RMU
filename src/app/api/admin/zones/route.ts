import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/admin/apiResponse";
import type { ZoneDTO } from "@/lib/admin/types";
import { validateRequiredString } from "@/lib/admin/validation";

async function listZones(): Promise<ZoneDTO[]> {
  const zones = await prisma.zone.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: "asc" },
  });
  return zones.map((z) => ({ id: z.id, name: z.name, roomCount: z._count.rooms }));
}

export async function GET() {
  return NextResponse.json({ ok: true, data: await listZones() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = validateRequiredString(body?.name);
  if (!name) {
    return apiError(400, "VALIDATION_ERROR", "กรุณาระบุชื่อโซน");
  }

  await prisma.zone.create({ data: { name } });
  return NextResponse.json({ ok: true, data: await listZones() }, { status: 201 });
}
