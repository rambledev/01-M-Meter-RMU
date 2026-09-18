import type { AdminSession } from "@/lib/admin/types";
import type { CheckerSession } from "@/lib/checker/types";
import type { ResidentSession } from "@/lib/resident/types";

export type SelfServiceRole = "METER_READER" | "RESIDENT";

export type LoginResult =
  | { status: "new" }
  | { status: "pending" }
  | { status: "resident"; session: ResidentSession }
  | { status: "checker"; session: CheckerSession }
  | { status: "admin"; session: AdminSession };

// `credential` is the ID token Google Identity Services hands back —
// verified server-side (google-auth-library, @rmu.ac.th only) in
// src/app/api/auth/login/route.ts.
export async function loginWithGoogle(credential: string): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
  }
  return body.data as LoginResult;
}

// `roomId` is required when role is "RESIDENT" (2026-09-18: a new resident
// picks their zone/room as part of registration itself, instead of after
// Admin approval) — meaningless for "METER_READER", which instead requires
// `zoneIds` (their responsible zone(s) for meter collection, picked the
// same way, same day).
export async function registerWithGoogle(
  credential: string,
  role: SelfServiceRole,
  options?: { roomId?: string; zoneIds?: string[] },
): Promise<void> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      role,
      roomId: options?.roomId,
      zoneIds: options?.zoneIds,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "สมัครสมาชิกไม่สำเร็จ");
  }
}
