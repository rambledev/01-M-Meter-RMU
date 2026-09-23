"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import { loginResidentWithGoogle } from "@/lib/resident/residentAuthApi";
import {
  clearResidentSession,
  getResidentSession,
  saveResidentSession,
} from "@/lib/resident/residentSession";
import type { ResidentSession } from "@/lib/resident/types";
import GoogleSignInButton from "./GoogleSignInButton";

// Gates /resident behind Google Sign-In (2026-09-09, replaces the earlier
// username/password login by explicit request — Google only, @rmu.ac.th
// domain enforced server-side). Render-prop, mirrors
// src/components/checker/CheckerAuthGate.tsx's structure.
export default function ResidentAuthGate({
  children,
}: {
  children: (session: ResidentSession, logout: () => void) => ReactNode;
}) {
  const [session, setSession] = useState<ResidentSession | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getResidentSession();
      if (!cancelled) setSession(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    clearResidentSession();
    setSession(null);
  }

  async function handleCredential(credential: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await loginResidentWithGoogle(credential);
      saveResidentSession(result);
      setSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) {
    return null;
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-emerald-50 to-white px-4 py-12 dark:from-zinc-950 dark:to-zinc-950">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-600 shadow-sm">
            <Image
              src="/meter.png"
              alt="โลโก้ระบบ"
              width={48}
              height={48}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <h1 className="text-center text-lg font-bold text-zinc-900 dark:text-zinc-100">
            เข้าสู่ระบบผู้พักอาศัย
          </h1>
          <p className="text-center text-sm text-zinc-500">
            เข้าสู่ระบบด้วยอีเมล @rmu.ac.th เท่านั้น
          </p>
          {busy ? (
            <p className="text-sm text-zinc-500">กำลังเข้าสู่ระบบ...</p>
          ) : (
            <GoogleSignInButton onCredential={handleCredential} onError={setError} />
          )}
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return <>{children(session, logout)}</>;
}
