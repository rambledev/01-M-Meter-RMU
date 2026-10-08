"use client";

import { useSyncExternalStore } from "react";

// "ใช้ข้อมูลตัวอย่าง" toggle state (2026-10-08) — a per-device, client-only
// flag. No API call, no database involvement whatsoever (replaces the
// previous version of this feature, src/lib/admin/seedDataService.ts,
// which actually wrote/deleted real Reading rows — removed by explicit
// request so it can never touch real data again). localStorage persists
// it across reloads; a same-tab "change" event plus the "storage" event
// (cross-tab) keep every component using useMockMode() in sync, following
// the same useSyncExternalStore pattern as src/lib/pwa/useInstallPrompt.ts
// and src/components/OnlineStatusBadge.tsx.
const STORAGE_KEY = "rmu-admin-mock-mode";
const CHANGE_EVENT = "rmu-mock-mode-change";

export function isMockModeEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMockModeEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Best-effort only — a failed write just means the toggle doesn't
    // persist across reloads this time.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// SSR-safe: mock mode is never on for the server-rendered HTML.
function getServerSnapshot(): boolean {
  return false;
}

export function useMockMode(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, isMockModeEnabled, getServerSnapshot);
  return [enabled, setMockModeEnabled];
}
