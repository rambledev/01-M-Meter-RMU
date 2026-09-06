import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { MeterInfo } from "@/lib/meters/types";

// Public read-only meter directory for the checker workflow (QR scan,
// manual code entry, and the quick-select list all resolve against this —
// see src/lib/meters/meterLookup.ts). Replaces the static demo list that
// used to live in src/lib/meters/demoData.ts (2026-09-04).
export async function GET() {
  const meters = await prisma.meter.findMany({
    include: { room: { include: { zone: true } } },
    orderBy: { code: "asc" },
  });

  const data: MeterInfo[] = meters.map((m) => ({
    id: m.id,
    code: m.code,
    roomId: m.roomId,
    roomName: m.room.name,
    zoneId: m.room.zoneId,
    zoneName: m.room.zone.name,
  }));

  return NextResponse.json({ ok: true, data });
}
