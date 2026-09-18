import { prisma } from "@/lib/db/prisma";
import type { ApiErrorBody } from "./types";

// Server-side authorization for Ft mutation endpoints (2026-09-17) — the
// FIRST server-side auth check anywhere in this app (every other route,
// admin included, is still client-gated only; out of scope here per the
// implementation decision to not refactor authorization outside Ft). The
// client sends only an opaque user id (header "x-admin-id", from
// src/lib/admin/adminSession.ts / src/lib/admin/ftApi.ts) — never a role
// string — and this function re-resolves the real role from the database
// itself, so a tampered client can never talk its way into ADMIN access.
export type AdminAuthResult =
  | { ok: true; adminId: string }
  | { ok: false; status: 401 | 403; error: ApiErrorBody["error"]; message: string };

export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const adminId = request.headers.get("x-admin-id");
  if (!adminId) {
    return {
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ",
    };
  }

  const user = await prisma.user.findUnique({ where: { id: adminId } });
  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ",
    };
  }
  if (user.role !== "ADMIN") {
    return {
      ok: false,
      status: 403,
      error: "FORBIDDEN",
      message: "เฉพาะผู้ดูแลระบบเท่านั้นที่ดำเนินการนี้ได้",
    };
  }

  return { ok: true, adminId: user.id };
}
