import type { CheckerSession } from "./types";

export async function loginChecker(username: string, password: string): Promise<CheckerSession> {
  const res = await fetch("/api/checker/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
  }
  return body.data as CheckerSession;
}
