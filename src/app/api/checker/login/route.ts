import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { verifyPassword } from "@/lib/admin/password";
import { prisma } from "@/lib/db/prisma";

// Checker (ผู้จดมิเตอร์) login — the first real credential check in this
// MVP (2026-09-06). Restricted to METER_READER accounts only: an Admin
// account authenticating here would otherwise see a dashboard scoped to
// zones the Admin role has no meaning for. No session/cookie — the client
// just persists the returned {id,name,zones} in localStorage indefinitely
// (src/lib/checker/checkerSession.ts), matching this app's no-real-auth-
// server MVP posture everywhere else (Admin has no login gate either).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return apiError(400, "VALIDATION_ERROR", "กรุณากรอก Username และ Password");
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: { responsibleZones: true },
  });

  if (!user || !user.passwordHash || user.role !== "METER_READER") {
    return apiError(401, "VALIDATION_ERROR", "Username หรือ Password ไม่ถูกต้อง");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return apiError(401, "VALIDATION_ERROR", "Username หรือ Password ไม่ถูกต้อง");
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: user.id,
      name: user.name,
      zones: user.responsibleZones.map((z) => ({ id: z.id, name: z.name })),
    },
  });
}
