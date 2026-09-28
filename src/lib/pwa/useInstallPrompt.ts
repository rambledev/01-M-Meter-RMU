"use client";

import { useEffect, useState } from "react";

// Not in lib.dom.d.ts yet (still a draft spec) — declared by hand, same as
// every project that uses this event has to do.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Captures Chrome's `beforeinstallprompt` (2026-09-25, for the home page's
// "เพิ่มทางลัดไปยังหน้าจอ" button) — the browser fires this once, whenever
// it decides the site is installable (valid manifest + HTTPS, see
// src/app/manifest.ts), and only if the page called preventDefault() does
// it let us replay it later via `.prompt()` on our own button's click
// instead of showing its own mini-infobar immediately. Never fires at all
// on iOS (no such API there — Add to Home Screen is manual, via the
// system share sheet) or once a PWA is already installed.
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  }

  return { canInstall: deferredPrompt !== null, promptInstall };
}
