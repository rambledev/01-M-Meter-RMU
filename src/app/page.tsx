"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Gauge,
  Home as HomeIcon,
  Lock,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import ChromeRequiredDialog from "@/components/ChromeRequiredDialog";
import FtAnnouncements from "@/components/FtAnnouncements";
import InstallShortcutButton from "@/components/InstallShortcutButton";
import LoginHeroBackground from "@/components/LoginHeroBackground";
import GoogleSignInButton from "@/components/resident/GoogleSignInButton";
import { saveAdminSession } from "@/lib/admin/adminSession";
import {
  loginWithGoogle,
  registerWithGoogle,
  type SelfServiceRole,
} from "@/lib/auth/authApi";
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

const ROLE_OPTIONS: {
  value: SelfServiceRole;
  label: string;
  icon: typeof Gauge;
}[] = [
  { value: "METER_READER", label: "ผู้จดมิเตอร์", icon: Gauge },
  { value: "RESIDENT", label: "ผู้พักอาศัย (ห้องพัก/บ้านพัก)", icon: HomeIcon },
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
    new Map(
      rooms.map((r) => [r.zoneId, { id: r.zoneId, name: r.zoneName }]),
    ).values(),
  );
  const roomOptionsInZone = rooms.filter((r) => r.zoneId === selectedZoneId);

  // Zone picker for a new METER_READER signup (2026-09-18) — same idea as
  // the room picker above, but for the zone(s) they'll be responsible for
  // collecting meter readings in (multi-select, same as Admin's own
  // zoneIds checkbox list in src/components/admin/UserManagement.tsx).
  const [checkerZones, setCheckerZones] = useState<ZoneOption[]>([]);
  const [checkerZonesLoading, setCheckerZonesLoading] = useState(false);
  const [checkerZonesError, setCheckerZonesError] = useState<string | null>(
    null,
  );
  const [selectedCheckerZoneIds, setSelectedCheckerZoneIds] = useState<
    string[]
  >([]);

  function toggleCheckerZone(zoneId: string) {
    setSelectedCheckerZoneIds((prev) =>
      prev.includes(zoneId)
        ? prev.filter((id) => id !== zoneId)
        : [...prev, zoneId],
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
        setRoomsError(
          err instanceof Error
            ? err.message
            : "โหลดรายชื่อโซน/ห้องพักไม่สำเร็จ",
        );
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
      setCheckerZonesError(
        err instanceof Error ? err.message : "โหลดรายชื่อโซนไม่สำเร็จ",
      );
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
      await registerWithGoogle(credential, "RESIDENT", {
        roomId: selectedRoomId,
      });
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
      await registerWithGoogle(credential, "METER_READER", {
        zoneIds: selectedCheckerZoneIds,
      });
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
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#0a1230] px-4 py-10 sm:px-8 lg:px-12">
      <LoginHeroBackground />
      <ChromeRequiredDialog />

      <div className="relative z-10 grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ฝั่งซ้าย: โลโก้ระบบและประกาศ */}
        <div className="flex flex-col gap-6 text-white lg:gap-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15">
              <Image
                src="/meter.png"
                alt="โลโก้ระบบ"
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">
                ระบบบริหารจัดการค่าสาธารณูปโภค
              </p>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-white/45 uppercase">
                RMU Meter Collection
              </p>
            </div>
          </div>

          <span className="hidden h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white/10 shadow-lg ring-1 ring-white/15 sm:flex">
            <Image
              src="/meter.png"
              alt=""
              width={150}
              height={150}
              className="h-full w-full object-cover"
              priority
            />
          </span>

          <div className="flex flex-col gap-3 text-left">
            <p className="text-xs font-bold tracking-[0.25em] text-blue-300 uppercase">
              ระบบประจำมหาวิทยาลัย
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              ระบบบริหารจัดการค่าสาธารณูปโภค
            </h1>
            <p className="max-w-sm text-sm text-white/60">
              กลุ่มงานอาคารสถานที่และบริการ — บันทึกค่ามิเตอร์ ตรวจสอบ
              และสรุปค่าสาธารณูปโภคของหน่วยงาน
            </p>
            <div className="h-px w-16 bg-white/15" />
          </div>

          <FtAnnouncements />
        </div>

        {/* ฝั่งขวา: การ์ดเข้าสู่ระบบ */}
        <div className="flex items-center justify-center lg:justify-end">
          <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-2xl sm:p-8">
            <div className="flex w-full items-center gap-3 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Lock aria-hidden="true" className="h-5 w-5 shrink-0" />
              </span>
              <div>
                <h2 className="text-base font-bold text-zinc-900">
                  เข้าสู่ระบบ
                </h2>
                <p className="text-xs text-zinc-500">
                  เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
                </p>
              </div>
            </div>

            {(phase === "idle" || phase === "error") && (
              <GoogleSignInButton
                onCredential={handleCredential}
                onError={handleGoogleError}
              />
            )}

            {phase === "checking" && (
              <p className="text-sm text-zinc-500">กำลังตรวจสอบ...</p>
            )}

            {phase === "pick-role" && (
              <div className="flex w-full flex-col gap-2">
                <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold">
                  <Users
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-primary-600"
                  />
                  คุณต้องการเข้าใช้งานในบทบาทใด?
                </p>
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePickRole(opt.value)}
                    className="flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-3 font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                  >
                    <opt.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {phase === "pick-room" && (
              <div className="flex w-full flex-col gap-3">
                <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold">
                  <MapPin
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-primary-600"
                  />
                  เลือกโซนและบ้านพัก/ห้องพักของคุณ
                </p>

                {roomsLoading && (
                  <p className="text-sm text-zinc-500">กำลังโหลด...</p>
                )}
                {roomsError && (
                  <p className="text-sm font-medium text-red-600">
                    {roomsError}
                  </p>
                )}

                {!roomsLoading && !roomsError && rooms.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    ยังไม่มีข้อมูลโซน/บ้านพัก/ห้องพักในระบบ
                    กรุณาติดต่อผู้ดูแลระบบ
                  </p>
                )}

                {!roomsLoading && !roomsError && rooms.length > 0 && (
                  <>
                    <div className="flex flex-col gap-1 text-left">
                      <label
                        className="text-sm font-medium"
                        htmlFor="signup-zone"
                      >
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
                      <label
                        className="text-sm font-medium"
                        htmlFor="signup-room"
                      >
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
                        <p className="text-xs text-zinc-500">
                          ยังไม่มีบ้านพัก/ห้องพักในโซนนี้
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmResident}
                      disabled={!selectedRoomId}
                      className="rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary-700"
                    >
                      ยืนยัน
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleBackToRolePick}
                  className="flex items-center gap-1 text-sm font-medium text-primary-700 underline dark:text-primary-400"
                >
                  <ArrowLeft
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  กลับไปเลือกบทบาท
                </button>
              </div>
            )}

            {phase === "pick-zones" && (
              <div className="flex w-full flex-col gap-3">
                <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold">
                  <MapPin
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-primary-600"
                  />
                  เลือกโซนที่รับผิดชอบในการเก็บมิเตอร์ (เลือกได้มากกว่า 1 โซน)
                </p>

                {checkerZonesLoading && (
                  <p className="text-sm text-zinc-500">กำลังโหลด...</p>
                )}
                {checkerZonesError && (
                  <p className="text-sm font-medium text-red-600">
                    {checkerZonesError}
                  </p>
                )}

                {!checkerZonesLoading &&
                  !checkerZonesError &&
                  checkerZones.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      ยังไม่มีข้อมูลโซนในระบบ กรุณาติดต่อผู้ดูแลระบบ
                    </p>
                  )}

                {!checkerZonesLoading &&
                  !checkerZonesError &&
                  checkerZones.length > 0 && (
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
                        className="rounded-lg bg-primary-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary-700"
                      >
                        ยืนยัน
                      </button>
                    </>
                  )}

                <button
                  type="button"
                  onClick={handleBackToRolePick}
                  className="flex items-center gap-1 text-sm font-medium text-primary-700 underline dark:text-primary-400"
                >
                  <ArrowLeft
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  กลับไปเลือกบทบาท
                </button>
              </div>
            )}

            {phase === "registering" && (
              <p className="text-sm text-zinc-500">กำลังส่งคำขอ...</p>
            )}

            {phase === "pending" && (
              <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                ส่งคำขอเรียบร้อย — กรุณารอผู้ดูแลระบบอนุมัติบทบาทการใช้งานของคุณ
              </p>
            )}

            {error && (
              <p className="text-sm font-medium text-red-600">{error}</p>
            )}

            <ul className="flex w-full flex-col gap-1.5 border-t border-zinc-100 pt-4 text-left text-xs">
              <li className="flex items-start gap-1.5">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                />
                <span className="font-semibold text-amber-700">
                  อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย @rmu.ac.th เท่านั้น
                </span>
              </li>
              <li className="flex items-start gap-1.5 text-zinc-500">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600"
                />
                บัญชีใหม่ต้องรอผู้ดูแลระบบอนุมัติสิทธิ์ก่อนใช้งาน
              </li>
            </ul>

            <InstallShortcutButton />
          </section>
        </div>
      </div>

      <footer className="relative z-10 mt-8 flex flex-col items-center gap-0.5 text-center text-xs text-white/40">
        <p>พัฒนาโดย เตโชธ์ เขตอนันต์</p>
        <p>ฝ่ายพัฒนาระบบเทคโนโลยีสารสนเทศ</p>
        <p>ศูนย์เทคโนโลยีดิจิทัลและนวัตกรรม สำนักงานอธิการบดี</p>
      </footer>
    </div>
  );
}
