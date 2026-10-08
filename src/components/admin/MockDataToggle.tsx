"use client";

import { useMockMode } from "@/lib/mock/mockMode";

// "ใช้ข้อมูลตัวอย่าง" — Dashboard + "สรุปข้อมูล" tab (and /executive, since
// it's the same per-device flag) switch to 12 months of generated mock
// data (src/lib/mock/mockData.ts) instead of the real API. Purely a
// localStorage flag flip — no request, no loading state, nothing in the
// database ever touched.
export default function MockDataToggle() {
  const [enabled, setEnabled] = useMockMode();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            ใช้ข้อมูลตัวอย่าง
          </p>
          <p className="text-xs text-zinc-500">
            แสดงข้อมูลตัวอย่างย้อนหลัง 1 ปี (เฉพาะ Dashboard และสรุปข้อมูล) — ไม่บันทึกหรือกระทบฐานข้อมูลจริงแต่อย่างใด
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="ใช้ข้อมูลตัวอย่าง"
          onClick={() => setEnabled(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-primary-600" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
