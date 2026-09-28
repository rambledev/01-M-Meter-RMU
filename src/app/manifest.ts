import type { MetadataRoute } from "next";

// Web app manifest (2026-09-25) — the prerequisite for the browser to
// consider this site "installable" at all: without one, Chrome never
// fires `beforeinstallprompt` (see src/lib/pwa/useInstallPrompt.ts /
// src/components/InstallShortcutButton.tsx, home page's "เพิ่มทางลัดไปยัง
// หน้าจอ" button), no matter what the button code does. Served at
// /manifest.webmanifest; Next.js injects the <link rel="manifest"> tag
// automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RMU Meter Collection",
    short_name: "RMU Meter",
    description: "ระบบบันทึกค่ามิเตอร์ไฟฟ้า RMU",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      {
        src: "/meter.png",
        sizes: "1254x1254",
        type: "image/png",
      },
    ],
  };
}
