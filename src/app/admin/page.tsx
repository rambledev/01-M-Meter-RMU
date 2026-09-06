"use client";

import Link from "next/link";
import { useState } from "react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import BillingSettingsManagement from "@/components/admin/BillingSettingsManagement";
import MeterManagement from "@/components/admin/MeterManagement";
import ReadingHistoryManagement from "@/components/admin/ReadingHistoryManagement";
import UserManagement from "@/components/admin/UserManagement";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "meters", label: "จัดการมิเตอร์" },
  { id: "history", label: "ประวัติการจดมิเตอร์" },
  { id: "users", label: "ข้อมูลผู้ใช้งาน" },
  { id: "billing", label: "ตั้งค่าค่าไฟ" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ผู้ดูแลระบบ (ADMIN role) — data management: Zone/Room/Meter hierarchy and
// User accounts, backed by real PostgreSQL via src/app/api/admin/**. No
// auth/permission gate yet — matches the rest of this MVP (no real login).
export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between border-b-2 border-emerald-600 pb-3">
        <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">ผู้ดูแลระบบ</h1>
        <Link
          href="/"
          className="text-xs font-medium text-emerald-700 underline dark:text-emerald-400"
        >
          เปลี่ยนบทบาท
        </Link>
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
    </div>
  );
}
