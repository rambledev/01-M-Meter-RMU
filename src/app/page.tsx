"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import GoogleSignInButton from "@/components/resident/GoogleSignInButton";
import { saveAdminSession } from "@/lib/admin/adminSession";
import { loginWithGoogle, registerWithGoogle, type SelfServiceRole } from "@/lib/auth/authApi";
import { saveCheckerSession } from "@/lib/checker/checkerSession";
import { fetchRoomOptions } from "@/lib/resident/residentRoomApi";
import { saveResidentSession } from "@/lib/resident/residentSession";
import type { RoomOption } from "@/lib/resident/types";
import { fetchZoneOptions, type ZoneOption } from "@/lib/zones/zoneApi";

type Phase =
  | "idle"
  | "checking"
  | "pick-role"
  | "pick-room"
  | "pick-zones"
  | "registering"
  | "pending"
  | "error";

const ROLE_OPTIONS: { value: SelfServiceRole; label: string }[] = [
  { value: "METER_READER", label: "ผู้จดมิเตอร์" },
  { value: "RESIDENT", label: "ผู้พักอาศัย (ห้องพัก/บ้านพัก)" },
];

// Home page (2026-09-16 redesign) — was a role-select landing page with no
// real login (4 static links, see decision-log.md); now the single entry
// point for everyone: Google Sign-In (@rmu.ac.th only) lives directly
// here instead of a separate /login page (removed — this replaces it, and
// is what CheckerAuthGate.tsx's "สมัครสมาชิกใหม่" link points back to now).
// A brand-new email picks its desired role and waits for Admin approval;
// an already-approved account is routed straight to its own role's page.
export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [credential, setCredential] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Zone/room picker for a new RESIDENT signup (2026-09-18) — picked as
  // part of registration itself now, not left for the later one-time
  // picker on /resident (that one still exists as a fallback for accounts
  // that somehow end up without a room, e.g. Admin-created ones).
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const zoneOptions = Array.from(
    new Map(rooms.map((r) => [r.zoneId, { id: r.zoneId, name: r.zoneName }])).values(),
  );
  const roomOptionsInZone = rooms.filter((r) => r.zoneId === selectedZoneId);

  // Zone picker for a new METER_READER signup (2026-09-18) — same idea as
  // the room picker above, but for the zone(s) they'll be responsible for
  // collecting meter readings in (multi-select, same as Admin's own
  // zoneIds checkbox list in src/components/admin/UserManagement.tsx).
  const [checkerZones, setCheckerZones] = useState<ZoneOption[]>([]);
  const [checkerZonesLoading, setCheckerZonesLoading] = useState(false);
  const [checkerZonesError, setCheckerZonesError] = useState<string | null>(null);
  const [selectedCheckerZoneIds, setSelectedCheckerZoneIds] = useState<string[]>([]);

  function toggleCheckerZone(zoneId: string) {
    setSelectedCheckerZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  }

  async function handleCredential(cred: string) {
    setPhase("checking");
    setError(null);
    try {
      const result = await loginWithGoogle(cred);
      switch (result.status) {
        case "new":
          setCredential(cred);
          setPhase("pick-role");
          return;
        case "pending":
          setPhase("pending");
          return;
        case "resident":
          saveResidentSession(result.session);
          router.push("/resident");
          return;
        case "checker":
          saveCheckerSession(result.session);
          router.push("/checker");
          return;
        case "admin":
          saveAdminSession(result.session);
          router.push("/admin");
          return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setPhase("error");
    }
  }

  async function handlePickRole(role: SelfServiceRole) {
    if (!credential) return;
    // Both roles now need a follow-up pick before actually registering:
    // RESIDENT picks a zone/room, METER_READER picks their responsible
    // zone(s) — neither registers immediately anymore.
    if (role === "RESIDENT") {
      setError(null);
      setPhase("pick-room");
      setRoomsLoading(true);
      setRoomsError(null);
      try {
        setRooms(await fetchRoomOptions());
      } catch (err) {
        setRoomsError(err instanceof Error ? err.message : "โหลดรายชื่อโซน/ห้องพักไม่สำเร็จ");
      } finally {
        setRoomsLoading(false);
      }
      return;
    }

    setError(null);
    setPhase("pick-zones");
    setCheckerZonesLoading(true);
    setCheckerZonesError(null);
    try {
      setCheckerZones(await fetchZoneOptions());
    } catch (err) {
      setCheckerZonesError(err instanceof Error ? err.message : "โหลดรายชื่อโซนไม่สำเร็จ");
    } finally {
      setCheckerZonesLoading(false);
    }
  }

  function handleZoneChange(zoneId: string) {
    setSelectedZoneId(zoneId);
    setSelectedRoomId(""); // ห้องที่เคยเลือกไว้อาจไม่ได้อยู่ในโซนใหม่
  }

  function handleBackToRolePick() {
    setPhase("pick-role");
    setSelectedZoneId("");
    setSelectedRoomId("");
    setSelectedCheckerZoneIds([]);
    setError(null);
  }

  async function handleConfirmResident() {
    if (!credential || !selectedRoomId) return;
    setPhase("registering");
    setError(null);
    try {
      await registerWithGoogle(credential, "RESIDENT", { roomId: selectedRoomId });
      setPhase("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สมัครสมาชิกไม่สำเร็จ");
      setPhase("error");
    }
  }

  async function handleConfirmChecker() {
    if (!credential || selectedCheckerZoneIds.length === 0) return;
    setPhase("registering");
    setError(null);
    try {
      await registerWithGoogle(credential, "METER_READER", { zoneIds: selectedCheckerZoneIds });
      setPhase("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "สมัครสมาชิกไม่สำเร็จ");
      setPhase("error");
    }
  }

  function handleGoogleError(message: string) {
    setError(message);
    setPhase("error");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-linear-to-b from-emerald-50 to-white px-4 py-12 dark:from-zinc-950 dark:to-zinc-950">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <header className="flex flex-col items-center gap-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl shadow-sm">
            ⚡
          </span>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            ระบบบริหารจัดการค่าสาธารณูปโภค
          </h1>
          <p className="text-sm text-zinc-500">กลุ่มงานอาคารสถานที่และบริการ</p>
        </header>

        <section className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
          </p>
          <p className="text-center text-xs font-semibold text-amber-700 dark:text-amber-400">
            ⚠ อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย @rmu.ac.th เท่านั้น
          </p>

          {(phase === "idle" || phase === "error") && (
            <GoogleSignInButton onCredential={handleCredential} onError={handleGoogleError} />
          )}

          {phase === "checking" && <p className="text-sm text-zinc-500">กำลังตรวจสอบ...</p>}

          {phase === "pick-role" && (
            <div className="flex w-full flex-col gap-2">
              <p className="text-center text-sm font-semibold">คุณต้องการเข้าใช้งานในบทบาทใด?</p>
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePickRole(opt.value)}
                  className="rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {phase === "pick-room" && (
            <div className="flex w-full flex-col gap-3">
              <p className="text-center text-sm font-semibold">เลือกโซนและบ้านพัก/ห้องพักของคุณ</p>

              {roomsLoading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
              {roomsError && <p className="text-sm font-medium text-red-600">{roomsError}</p>}

              {!roomsLoading && !roomsError && rooms.length === 0 && (
                <p className="text-sm text-zinc-500">
                  ยังไม่มีข้อมูลโซน/บ้านพัก/ห้องพักในระบบ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              )}

              {!roomsLoading && !roomsError && rooms.length > 0 && (
                <>
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-sm font-medium" htmlFor="signup-zone">
                      โซน
                    </label>
                    <select
                      id="signup-zone"
                      value={selectedZoneId}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">— เลือกโซน —</option>
                      {zoneOptions.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-sm font-medium" htmlFor="signup-room">
                      บ้านพัก/ห้องพัก
                    </label>
                    <select
                      id="signup-room"
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      disabled={!selectedZoneId}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">— เลือกบ้านพัก/ห้องพัก —</option>
                      {roomOptionsInZone.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {selectedZoneId && roomOptionsInZone.length === 0 && (
                      <p className="text-xs text-zinc-500">ยังไม่มีบ้านพัก/ห้องพักในโซนนี้</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmResident}
                    disabled={!selectedRoomId}
                    className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-700"
                  >
                    ยืนยัน
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleBackToRolePick}
                className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
              >
                ← กลับไปเลือกบทบาท
              </button>
            </div>
          )}

          {phase === "pick-zones" && (
            <div className="flex w-full flex-col gap-3">
              <p className="text-center text-sm font-semibold">
                เลือกโซนที่รับผิดชอบในการเก็บมิเตอร์ (เลือกได้มากกว่า 1 โซน)
              </p>

              {checkerZonesLoading && <p className="text-sm text-zinc-500">กำลังโหลด...</p>}
              {checkerZonesError && (
                <p className="text-sm font-medium text-red-600">{checkerZonesError}</p>
              )}

              {!checkerZonesLoading && !checkerZonesError && checkerZones.length === 0 && (
                <p className="text-sm text-zinc-500">
                  ยังไม่มีข้อมูลโซนในระบบ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              )}

              {!checkerZonesLoading && !checkerZonesError && checkerZones.length > 0 && (
                <>
                  <div className="flex flex-col gap-1 text-left">
                    {checkerZones.map((z) => (
                      <label
                        key={z.id}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCheckerZoneIds.includes(z.id)}
                          onChange={() => toggleCheckerZone(z.id)}
                        />
                        {z.name}
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmChecker}
                    disabled={selectedCheckerZoneIds.length === 0}
                    className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-700"
                  >
                    ยืนยัน
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleBackToRolePick}
                className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
              >
                ← กลับไปเลือกบทบาท
              </button>
            </div>
          )}

          {phase === "registering" && <p className="text-sm text-zinc-500">กำลังส่งคำขอ...</p>}

          {phase === "pending" && (
            <p className="text-center text-sm font-medium text-amber-700 dark:text-amber-400">
              ส่งคำขอเรียบร้อย — กรุณารอผู้ดูแลระบบอนุมัติบทบาทการใช้งานของคุณ
            </p>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </section>

        <footer className="flex flex-col gap-0.5 text-xs text-zinc-400">
          <p>พัฒนาโดย เตโชธ์ เขตอนันต์</p>
          <p>นักวิชาการคอมพิวเตอร์</p>
          <p>ศูนย์เทคโนโลยีดิจิทัลและนวัตกรรม สำนักงานอธิการบดี</p>
        </footer>
      </div>
    </div>
  );
}
