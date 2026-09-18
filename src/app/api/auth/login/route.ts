import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { prisma } from "@/lib/db/prisma";
import { verifyGoogleIdToken } from "@/lib/resident/googleAuth";

// Unified Google login (2026-09-16, src/app/login/page.tsx) — the shared
// entry point for every role, replacing the old assumption that Google
// login only ever means RESIDENT. Resolves to one of:
//   "new"      — no account with this email yet -> client shows the role
//                picker, then POSTs to /api/auth/register.
//   "pending"  — account exists but an Admin hasn't approved it yet
//                (self-service signups always start this way).
//   "resident" / "checker" / "admin" — approved account, session data
//                shaped for whichever client-side session store applies.
// src/app/api/resident/google-login/route.ts (the original resident-only
// route, still used directly by /resident's own inline Google button) is
// unchanged in shape — this is a new, separate, more general endpoint.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";
  if (!credential) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบข้อมูลการเข้าสู่ระบบจาก Google");
  }

  const verified = await verifyGoogleIdToken(credential);
  if (!verified) {
    return apiError(
      401,
      "VALIDATION_ERROR",
      "เข้าสู่ระบบไม่สำเร็จ — อนุญาตเฉพาะอีเมล @rmu.ac.th เท่านั้น",
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: verified.email },
    include: {
      responsibleZones: { select: { id: true, name: true } },
      residentRoom: { include: { zone: { select: { name: true } } } },
    },
  });

  if (!user) {
    return NextResponse.json({ ok: true, data: { status: "new" } });
  }

  if (!user.isApproved) {
    return NextResponse.json({ ok: true, data: { status: "pending" } });
  }

  if (user.role === "RESIDENT") {
    return NextResponse.json({
      ok: true,
      data: {
        status: "resident",
        session: {
          id: user.id,
          name: user.name,
          email: verified.email,
          room: user.residentRoom
            ? {
                id: user.residentRoom.id,
                name: user.residentRoom.name,
                zoneName: user.residentRoom.zone.name,
              }
            : null,
        },
      },
    });
  }

  if (user.role === "METER_READER") {
    return NextResponse.json({
      ok: true,
      data: {
        status: "checker",
        session: {
          id: user.id,
          name: user.name,
          zones: user.responsibleZones.map((z) => ({ id: z.id, name: z.name })),
        },
      },
    });
  }

  // (2026-09-17) session data added so the client can persist an opaque
  // admin id (src/lib/admin/adminSession.ts) — required for the new Ft
  // mutation endpoints' server-side authorization (src/lib/admin/
  // requireAdmin.ts) to have anything to check; the id is looked up fresh
  // from the DB server-side on every Ft mutation, never trusted as a role.
  return NextResponse.json({
    ok: true,
    data: { status: "admin", session: { id: user.id, name: user.name } },
  });
}
