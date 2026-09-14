import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Public read-only room directory — used by the resident room-picker
// (2026-09-09) so a resident can self-select which room is theirs.
// Mirrors the existing public GET /api/meters pattern exactly.
export async function GET() {
  const rooms = await prisma.room.findMany({
    include: { zone: true },
    orderBy: { name: "asc" },
  });

  const data = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    zoneId: r.zoneId,
    zoneName: r.zone.name,
  }));

  return NextResponse.json({ ok: true, data });
}
