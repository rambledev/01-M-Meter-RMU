"use client";

import { useEffect, useState } from "react";
import { fetchFtAnnouncements } from "@/lib/billing/ftApi";
import type { FtRateDTO } from "@/lib/admin/types";
import { formatMonthThai, toMonthValue } from "@/lib/reading/readingMonth";

function formatDateTimeThai(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

// ประกาศปรับค่า Ft (2026-09-23) — shows the most recent Ft rate months
// that have an admin-uploaded announcement document (src/components/admin/
// FtRateManagement.tsx), on /resident (after login) and the home login
// page (before login, everyone). Supplementary info, not page-critical:
// stays invisible (no skeleton/error state) until there's something real
// to show, so a slow/failed fetch never leaves a blank box on screen.
export default function FtAnnouncements() {
  const [items, setItems] = useState<FtRateDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchFtAnnouncements();
      if (!cancelled) setItems(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-400">
        📢 ประกาศปรับค่า Ft
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((ft) => (
          <li
            key={ft.id}
            className="flex flex-col gap-1 border-t border-amber-200 pt-3 first:border-t-0 first:pt-0 dark:border-amber-900/50"
          >
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              รอบ {formatMonthThai(toMonthValue(ft.readingMonth))} — ค่า Ft {ft.ftRate} บาท/หน่วย
            </p>
            {ft.notes && <p className="text-xs text-zinc-600 dark:text-zinc-400">{ft.notes}</p>}
            <div className="flex flex-col gap-1">
              {ft.documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center gap-2">
                  <a
                    href={doc.storagePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
                  >
                    📎 {doc.originalName}
                  </a>
                  <span className="text-xs text-zinc-500">
                    อัปโหลดโดย {doc.uploadedByName} · {formatDateTimeThai(doc.uploadedAt)}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
