import type { ResidentSession } from "./types";

// `credential` is the ID token Google Identity Services hands back from
// the "Sign in with Google" button (src/components/resident/
// ResidentAuthGate.tsx) — verified server-side (google-auth-library,
// domain-restricted to @rmu.ac.th) in src/app/api/resident/google-login.
export async function loginResidentWithGoogle(credential: string): Promise<ResidentSession> {
  const res = await fetch("/api/resident/google-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
  }
  return body.data as ResidentSession;
}
