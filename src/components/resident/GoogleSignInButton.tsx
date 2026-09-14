"use client";

import { useEffect, useRef, useState } from "react";

// Minimal Google Identity Services ("Sign in with Google") button wrapper
// (2026-09-09) — loads Google's own script, renders their button, and
// hands the resulting ID token (a JWT Google signs) up to the caller.
// Verification of that token happens server-side only
// (src/lib/resident/googleAuth.ts) — this component never trusts anything
// about the token itself, it's just a plain string to POST onward.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("โหลดสคริปต์ Google ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({
  onCredential,
  onError,
}: {
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !buttonRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => onCredential(resp.credential),
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          width: 280,
        });
        setReady(true);
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : "โหลด Google Sign-In ไม่สำเร็จ");
      }
    })();
    return () => {
      cancelled = true;
    };
    // onCredential/onError are expected to be stable enough for this one-time init;
    // re-running on every render would re-initialize Google's own button unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) {
    return (
      <p className="rounded-lg bg-amber-100 px-3 py-2 text-center text-sm font-medium text-amber-800">
        ยังไม่ได้ตั้งค่า Google Client ID (NEXT_PUBLIC_GOOGLE_CLIENT_ID) — กรุณาติดต่อผู้ดูแลระบบ
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={buttonRef} />
      {!ready && <p className="text-xs text-zinc-500">กำลังโหลด...</p>}
    </div>
  );
}
