"use client";

import { useSyncExternalStore } from "react";
import { buildOpenInChromeUrl, isGoogleChrome } from "@/lib/browser/detectChrome";

// The browser never changes mid-session, so there's nothing to subscribe
// to — this no-op subscribe just satisfies useSyncExternalStore's shape.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return !isGoogleChrome(navigator.userAgent);
}
// SSR-safe: `navigator` doesn't exist on the server, and rendering the
// dialog into the server HTML would show it for a flash on Chrome too —
// so the server (and first client render, to match it) always says
// "don't show it," and useSyncExternalStore corrects to the real answer
// as soon as the client can check.
function getServerSnapshot() {
  return false;
}

// Blocks the home page behind a non-dismissible notice when the browser
// isn't Google Chrome (2026-09-25, explicit product requirement — this
// app is Chrome-only). No close/backdrop-dismiss on purpose: the only way
// past this is the button, which hands off to Chrome directly.
export default function ChromeRequiredDialog() {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!open) return null;

  function handleOpenChrome() {
    window.location.href = buildOpenInChromeUrl(window.location.href, navigator.userAgent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-lg dark:bg-zinc-900">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl dark:bg-amber-950/40">
          ⚠️
        </span>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          กรุณาใช้ Google Chrome
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ระบบนี้รองรับเฉพาะเบราว์เซอร์ Google Chrome เท่านั้น กรุณาเปิดด้วย Google Chrome
          เพื่อใช้งานระบบได้อย่างถูกต้อง
        </p>
        <button
          type="button"
          onClick={handleOpenChrome}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-700"
        >
          ใช้ Google Chrome
        </button>
      </div>
    </div>
  );
}
