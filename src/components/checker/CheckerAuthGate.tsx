"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { loginChecker } from "@/lib/checker/checkerAuthApi";
import {
  clearCheckerSession,
  getCheckerSession,
  saveCheckerSession,
} from "@/lib/checker/checkerSession";
import type { CheckerSession } from "@/lib/checker/types";

// Field Calibration testing convenience (2026-09-14): when both are set,
// auto-logs in as a fixed test account instead of showing the login
// screen, so a tester can jump straight to /checker/reading without typing
// credentials every time. Must be NEXT_PUBLIC_ to reach the client bundle
// at all (same lesson as NEXT_PUBLIC_GOOGLE_CLIENT_ID elsewhere in this
// app — see docs/decision-log.md). Goes through the REAL loginChecker()
// call below, not a fabricated session, so the account still has to exist
// for real — see prisma/ensureCheckerBypassUser.cjs for the matching
// "checker-01" account this is meant to pair with. Leave unset in
// production; only meaningful while this phase's real-device testing is
// ongoing.
const BYPASS_USERNAME = process.env.NEXT_PUBLIC_CHECKER_BYPASS_USERNAME;
const BYPASS_PASSWORD = process.env.NEXT_PUBLIC_CHECKER_BYPASS_PASSWORD;

// Gates every /checker/** page behind a login screen (2026-09-06's login
// feature) — a render-prop rather than a Context provider since there are
// only 3 consumers (dashboard/reading/history), each already client
// components; each page reads its own session/logout straight from here.
export default function CheckerAuthGate({
  children,
}: {
  children: (session: CheckerSession, logout: () => void) => ReactNode;
}) {
  const [session, setSession] = useState<CheckerSession | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getCheckerSession();
      if (stored) {
        if (!cancelled) setSession(stored);
        return;
      }

      if (BYPASS_USERNAME && BYPASS_PASSWORD) {
        try {
          const result = await loginChecker(BYPASS_USERNAME, BYPASS_PASSWORD);
          saveCheckerSession(result);
          if (!cancelled) setSession(result);
          return;
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? `Bypass login (${BYPASS_USERNAME}) ไม่สำเร็จ: ${err.message}`
                : "Bypass login ไม่สำเร็จ",
            );
          }
        }
      }

      if (!cancelled) setSession(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    clearCheckerSession();
    setSession(null);
  }

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      const result = await loginChecker(username, password);
      saveCheckerSession(result);
      setSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // undefined = still checking localStorage — avoids a login-form flash
  // for the common case (already logged in on this device).
  if (session === undefined) {
    return null;
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-emerald-50 to-white px-4 py-12 dark:from-zinc-950 dark:to-zinc-950">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl shadow-sm">
              ⚡
            </span>
            <h1 className="text-center text-lg font-bold text-zinc-900 dark:text-zinc-100">
              เข้าสู่ระบบผู้จดมิเตอร์
            </h1>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold" htmlFor="checker-username">
              Username
            </label>
            <input
              id="checker-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="rounded-lg border border-zinc-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold" htmlFor="checker-password">
              Password
            </label>
            <input
              id="checker-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="rounded-lg border border-zinc-300 px-3 py-3 text-base focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-lg font-bold text-white disabled:opacity-50 hover:bg-emerald-700"
          >
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
          <Link
            href="/"
            className="text-center text-sm font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            ยังไม่มีบัญชี? สมัครสมาชิกใหม่ด้วย Google
          </Link>
        </div>
      </div>
    );
  }

  return <>{children(session, logout)}</>;
}
