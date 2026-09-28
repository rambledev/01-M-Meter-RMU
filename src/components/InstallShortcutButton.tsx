"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/lib/pwa/useInstallPrompt";

function isIOS(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

// "เพิ่มทางลัดไปยังหน้าจอ" (2026-09-25) — on the home page, for adding this
// site to the phone's home screen. Three outcomes depending on what the
// browser actually supports:
//   1. Chrome (Android/desktop) already fired `beforeinstallprompt` ->
//      replay it for a real native "Add to Home Screen" dialog.
//   2. iOS -> there's no API for this at all (Apple restricts it to a
//      manual step via the system share sheet), so show instructions
//      instead of pretending to trigger anything.
//   3. Anything else (prompt hasn't fired yet, or truly unsupported) ->
//      a plain fallback message. this can't tell those two apart, so it
//      always assumes the more common case (browser support exists, just
//      not ready/fired yet) rather than asserting it's unsupported.
export default function InstallShortcutButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [note, setNote] = useState<string | null>(null);

  async function handleClick() {
    if (canInstall) {
      const outcome = await promptInstall();
      setNote(outcome === "accepted" ? "เพิ่มทางลัดเรียบร้อยแล้ว" : null);
      return;
    }
    if (isIOS(navigator.userAgent)) {
      setNote('กดปุ่มแชร์ (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างของเบราว์เซอร์ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"');
      return;
    }
    setNote("เบราว์เซอร์นี้ยังไม่พร้อมเพิ่มทางลัดอัตโนมัติ กรุณาลองใหม่อีกครั้ง หรือเพิ่มผ่านเมนูของเบราว์เซอร์ด้วยตนเอง");
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="w-full rounded-lg border border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
      >
        ➕ เพิ่มทางลัดไปยังหน้าจอ
      </button>
      {note && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {note}
        </p>
      )}
    </div>
  );
}
