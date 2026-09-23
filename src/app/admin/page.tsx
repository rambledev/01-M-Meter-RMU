"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { clearAdminSession, getAdminSession } from "@/lib/admin/adminSession";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminSummary from "@/components/admin/AdminSummary";
import BillingSettingsManagement from "@/components/admin/BillingSettingsManagement";
import FtRateManagement from "@/components/admin/FtRateManagement";
import MeterManagement from "@/components/admin/MeterManagement";
import ReadingHistoryManagement from "@/components/admin/ReadingHistoryManagement";
import UserManagement from "@/components/admin/UserManagement";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "summary", label: "สรุปข้อมูล", icon: "📊" },
  { id: "meters", label: "จัดการมิเตอร์", icon: "🔌" },
  { id: "history", label: "ประวัติการจดมิเตอร์", icon: "🕒" },
  { id: "users", label: "ข้อมูลผู้ใช้งาน", icon: "👤" },
  { id: "billing", label: "ตั้งค่าค่าไฟ", icon: "💰" },
  { id: "ft", label: "ค่า Ft", icon: "⚡" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DESKTOP_QUERY = "(min-width: 768px)";
function subscribeIsDesktop(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getIsDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}
// Mobile-safe default during SSR/first paint, corrected immediately on the client.
function getIsDesktopServerSnapshot() {
  return false;
}

// ผู้ดูแลระบบ (ADMIN role) — data management: Zone/Room/Meter hierarchy and
// User accounts, backed by real PostgreSQL via src/app/api/admin/**. Page
// itself still has no login gate (matches the rest of this MVP's posture —
// see src/lib/admin/requireAdmin.ts for the one place that DOES enforce
// real server-side auth, the Ft mutation endpoints) but now reads whatever
// adminSession exists (saved at Google-login time, src/app/page.tsx) to
// show who's logged in and to actually clear it on logout (2026-09-17).
export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [adminName, setAdminName] = useState<string | null>(null);
  const isDesktop = useSyncExternalStore(
    subscribeIsDesktop,
    getIsDesktopSnapshot,
    getIsDesktopServerSnapshot,
  );
  // null = no manual toggle yet, so the sidebar just follows the viewport
  // (open on desktop, closed on mobile); once the user toggles it, that
  // choice sticks until they toggle again.
  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const sidebarOpen = sidebarOverride ?? isDesktop;

  useEffect(() => {
    (async () => {
      setAdminName(getAdminSession()?.name ?? null);
    })();
  }, []);

  function handleLogout() {
    clearAdminSession();
    router.push("/");
  }

  function handleSelectTab(id: TabId) {
    setTab(id);
    if (!isDesktop) {
      setSidebarOverride(false);
    }
  }

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? "";

  return (
    <div className="flex min-h-dvh w-full">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          onClick={() => setSidebarOverride(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 md:static md:h-auto md:transition-[width] md:duration-200 md:ease-in-out ${
          sidebarOpen
            ? "translate-x-0 md:w-64"
            : "-translate-x-full md:w-0 md:min-w-0 md:translate-x-0 md:overflow-hidden md:border-r-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b-2 border-emerald-600 px-4 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-emerald-800 dark:text-emerald-400">
              ผู้ดูแลระบบ
            </h1>
            {adminName && <p className="truncate text-sm text-zinc-500">สวัสดี, {adminName}</p>}
          </div>
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setSidebarOverride(false)}
            className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-zinc-800"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            aria-label={sidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู"}
            onClick={() => setSidebarOverride(!sidebarOpen)}
            className="shrink-0 rounded-lg border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ☰
          </button>
          <h2 className="truncate text-base font-semibold text-zinc-800 dark:text-zinc-100">
            {activeLabel}
          </h2>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="flex w-full flex-col gap-6">
            {tab === "dashboard" && <AdminDashboard />}
            {tab === "summary" && <AdminSummary />}
            {tab === "meters" && <MeterManagement />}
            {tab === "history" && <ReadingHistoryManagement />}
            {tab === "users" && <UserManagement />}
            {tab === "billing" && <BillingSettingsManagement />}
            {tab === "ft" && <FtRateManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}
