"use client";

import { useEffect, useState } from "react";
import {
  createUser,
  deleteUser,
  listRooms,
  listUsers,
  listZones,
  updateUser,
} from "@/lib/admin/adminApi";
import type { RoleValue, RoomDTO, UserDTO, ZoneDTO } from "@/lib/admin/types";
import Modal from "./Modal";

const ROLE_LABELS: Record<RoleValue, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  METER_READER: "ผู้จดมิเตอร์",
  RESIDENT: "ผู้พักอาศัย",
};
const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as RoleValue[];

interface FormState {
  name: string;
  username: string;
  password: string;
  email: string;
  role: RoleValue;
  zoneIds: string[];
  roomId: string;
  isApproved: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  username: "",
  password: "",
  email: "",
  role: "METER_READER",
  zoneIds: [],
  roomId: "",
  isApproved: true,
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [userData, zoneData, roomData] = await Promise.all([
      listUsers(),
      listZones(),
      listRooms(),
    ]);
    setUsers(userData);
    setZones(zoneData);
    setRooms(roomData);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openAddModal() {
    setEditingId(null);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(user: UserDTO) {
    setEditingId(user.id);
    setEditingUser(user);
    setForm({
      name: user.name,
      username: user.username ?? "",
      password: "",
      email: user.email ?? "",
      role: user.role,
      zoneIds: user.responsibleZones.map((z) => z.id),
      roomId: user.residentRoom?.id ?? "",
      isApproved: user.isApproved,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function toggleZone(zoneId: string) {
    setForm((f) => ({
      ...f,
      zoneIds: f.zoneIds.includes(zoneId)
        ? f.zoneIds.filter((id) => id !== zoneId)
        : [...f.zoneIds, zoneId],
    }));
  }

  // Any non-RESIDENT account that already has an email but no username —
  // either a METER_READER that signed up itself via /login's Google role
  // picker (src/app/api/auth/register), or any role an Admin assigned by
  // email through the "+ กำหนดบทบาทด้วย Email" flow below — same signal
  // the PATCH route uses server-side. Its email is tied to its Google
  // identity, so this form never sends username/password for it.
  const isEmailIdentity =
    editingUser !== null &&
    editingUser.role !== "RESIDENT" &&
    editingUser.email !== null &&
    editingUser.username === null;

  async function handleSubmit() {
    setBusy(true);
    setFormError(null);
    try {
      const isResident = form.role === "RESIDENT";
      if (editingId) {
        await updateUser(editingId, {
          name: form.name,
          role: form.role,
          zoneIds: form.zoneIds,
          roomId: form.roomId || undefined,
          isApproved: form.isApproved,
          ...(isResident
            ? { email: form.email }
            : isEmailIdentity
              ? {}
              : {
                  username: form.username,
                  ...(form.password ? { password: form.password } : {}),
                }),
        });
      } else {
        // Creating is always email + role now — see the button/modal below.
        await createUser({
          name: form.name,
          email: form.email,
          role: form.role,
          zoneIds: form.zoneIds,
          roomId: form.roomId || undefined,
        });
      }
      await refresh();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // Quick one-click approve for a pending self-service signup — keeps
  // everything else about the account as-is (name/role/zones/room);
  // "แก้ไข" is still there for an admin who also wants to assign zones
  // (METER_READER) or a room (RESIDENT) at the same time instead.
  async function handleApprove(user: UserDTO) {
    try {
      await updateUser(user.id, {
        name: user.name,
        role: user.role,
        zoneIds: user.responsibleZones.map((z) => z.id),
        roomId: user.residentRoom?.id ?? undefined,
        isApproved: true,
        ...(user.role === "RESIDENT" ? { email: user.email ?? undefined } : { username: user.username ?? undefined }),
      });
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "อนุมัติไม่สำเร็จ");
    }
  }

  async function handleDelete(user: UserDTO) {
    if (!window.confirm(`ลบผู้ใช้งาน "${user.name}" ใช่หรือไม่?`)) return;
    try {
      await deleteUser(user.id);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  if (loadError) {
    return <p className="text-sm font-medium text-red-600">{loadError}</p>;
  }
  if (loading) {
    return <p className="text-sm text-zinc-500">กำลังโหลด...</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">ข้อมูลผู้ใช้งาน</h3>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + กำหนดบทบาทด้วย Email
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="p-2">ชื่อ-สกุล</th>
              <th className="p-2">Username / อีเมล</th>
              <th className="p-2">บทบาท</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">โซน/ห้องที่รับผิดชอบ</th>
              <th className="p-2">จำนวนรายการที่บันทึก</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-3 text-center text-zinc-500">
                  ยังไม่มีข้อมูลผู้ใช้งาน
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                <td className="p-2">{user.name}</td>
                <td className="p-2">
                  {user.role === "RESIDENT" ? (user.email ?? "-") : (user.username ?? user.email ?? "-")}
                </td>
                <td className="p-2">{ROLE_LABELS[user.role]}</td>
                <td className="p-2">
                  {user.isApproved ? (
                    <span className="text-zinc-500">อนุมัติแล้ว</span>
                  ) : (
                    <span className="font-semibold text-amber-700 dark:text-amber-400">รออนุมัติ</span>
                  )}
                </td>
                <td className="p-2">
                  {user.role === "RESIDENT"
                    ? user.residentRoom
                      ? `${user.residentRoom.name} (${user.residentRoom.zoneName})`
                      : "ยังไม่กำหนดห้อง"
                    : user.responsibleZones.length > 0
                      ? user.responsibleZones.map((z) => z.name).join(", ")
                      : "-"}
                </td>
                <td className="p-2">{user.readingCount}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  {!user.isApproved && (
                    <button
                      type="button"
                      onClick={() => handleApprove(user)}
                      className="mr-2 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      อนุมัติ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditModal(user)}
                    className="mr-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-400"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editingId ? "แก้ไขผู้ใช้งาน" : "กำหนดบทบาทด้วย Email"} onClose={closeModal}>
          <div className="flex flex-col gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ชื่อ-สกุล"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            {!editingId || form.role === "RESIDENT" ? (
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="อีเมล (@rmu.ac.th) — สำหรับเข้าสู่ระบบด้วย Google"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            ) : isEmailIdentity ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                เข้าสู่ระบบด้วย Google: {form.email}
              </p>
            ) : (
              <>
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="Username"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="รหัสผ่านใหม่ (เว้นว่างไว้หากไม่เปลี่ยน)"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </>
            )}
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleValue }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>

            {form.role === "METER_READER" && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">โซนที่รับผิดชอบ</p>
                {zones.length === 0 ? (
                  <p className="text-xs text-zinc-500">ยังไม่มีข้อมูลโซนในระบบ</p>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-zinc-300 p-2 dark:border-zinc-700">
                    {zones.map((zone) => (
                      <label key={zone.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.zoneIds.includes(zone.id)}
                          onChange={() => toggleZone(zone.id)}
                        />
                        {zone.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {form.role === "RESIDENT" && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">ห้องที่รับผิดชอบ (มองเห็นได้เฉพาะห้องนี้)</p>
                {rooms.length === 0 ? (
                  <p className="text-xs text-zinc-500">ยังไม่มีข้อมูลห้องพักในระบบ</p>
                ) : (
                  <select
                    value={form.roomId}
                    onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">ยังไม่กำหนดห้อง</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} ({room.zoneName})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {editingId && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isApproved}
                  onChange={(e) => setForm((f) => ({ ...f, isApproved: e.target.checked }))}
                />
                อนุมัติให้ใช้งานแล้ว
                {!form.isApproved && (
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    (ยังไม่ได้ติ๊ก = บัญชีนี้ยัง login ไม่ได้)
                  </span>
                )}
              </label>
            )}

            {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
              >
                {editingId ? "บันทึกการแก้ไข" : "กำหนดบทบาท"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
