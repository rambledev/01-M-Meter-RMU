"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminSession, getAdminSession } from "@/lib/admin/adminSession";
import AdminDashboard from "@/components/admin/AdminDashboard";
import BillingSettingsManagement from "@/components/admin/BillingSettingsManagement";
import FtRateManagement from "@/components/admin/FtRateManagement";
import MeterManagement from "@/components/admin/MeterManagement";
import ReadingHistoryManagement from "@/components/admin/ReadingHistoryManagement";
import UserManagement from "@/components/admin/UserManagement";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "meters", label: "จัดการมิเตอร์" },
  { id: "history", label: "ประวัติการจดมิเตอร์" },
  { id: "users", label: "ข้อมูลผู้ใช้งาน" },
  { id: "billing", label: "ตั้งค่าค่าไฟ" },
  { id: "ft", label: "ค่า Ft" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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

  useEffect(() => {
    (async () => {
      setAdminName(getAdminSession()?.name ?? null);
    })();
  }, []);

  function handleLogout() {
    clearAdminSession();
    router.push("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between border-b-2 border-emerald-600 pb-3">
        <div>
          <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">ผู้ดูแลระบบ</h1>
          {adminName && <p className="text-sm text-zinc-500">สวัสดี, {adminName}</p>}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="shrink-0 text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          ออกจากระบบ
        </button>
      </header>

      <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "text-zinc-500 hover:text-emerald-700 dark:hover:text-emerald-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <AdminDashboard />}
      {tab === "meters" && <MeterManagement />}
      {tab === "history" && <ReadingHistoryManagement />}
      {tab === "users" && <UserManagement />}
      {tab === "billing" && <BillingSettingsManagement />}
      {tab === "ft" && <FtRateManagement />}
    </div>
  );
}
