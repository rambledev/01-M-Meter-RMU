import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Public read-only zone directory (2026-09-18) — same purpose/shape as the
// existing public GET /api/rooms: used by the self-service signup flow on
// "/" (src/app/page.tsx) so a new METER_READER can pick which zone(s)
// they're responsible for before the account is even created, i.e. before
// there is any session to call an /api/admin/** route as. Read-only on
// purpose — creating a zone stays exclusively at POST /api/admin/zones.
export async function GET() {
  const zones = await prisma.zone.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, data: zones });
}
