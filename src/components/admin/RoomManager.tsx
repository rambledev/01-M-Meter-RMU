"use client";

import { Fragment, useState } from "react";
import { createMeter, createRoom, deleteRoom, updateRoom } from "@/lib/admin/adminApi";
import type { MeterDTO, RoomDTO, ZoneDTO } from "@/lib/admin/types";

const EMPTY_FORM = { name: "", residentName: "", zoneId: "" };

export default function RoomManager({
  rooms,
  zones,
  meters,
  onChange,
}: {
  rooms: RoomDTO[];
  zones: ZoneDTO[];
  meters: MeterDTO[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, zoneId: zones[0]?.id ?? "" }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Adding a Meter to a specific Room, inline on that row (moved here from
  // the Meter table's own add form by explicit request — the room is
  // already known from context here, so the form only needs a meter code).
  const [addMeterRoomId, setAddMeterRoomId] = useState<string | null>(null);
  const [newMeterCode, setNewMeterCode] = useState("");
  const [addMeterError, setAddMeterError] = useState<string | null>(null);
  const [addMeterBusy, setAddMeterBusy] = useState(false);

  function startAddMeter(room: RoomDTO) {
    setAddMeterRoomId(room.id);
    setNewMeterCode("");
    setAddMeterError(null);
  }

  function cancelAddMeter() {
    setAddMeterRoomId(null);
  }

  async function handleAddMeterSubmit(room: RoomDTO) {
    setAddMeterBusy(true);
    setAddMeterError(null);
    try {
      await createMeter({ code: newMeterCode, roomId: room.id });
      onChange();
      cancelAddMeter();
    } catch (err) {
      setAddMeterError(err instanceof Error ? err.message : "เพิ่มมิเตอร์ไม่สำเร็จ");
    } finally {
      setAddMeterBusy(false);
    }
  }

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, zoneId: zones[0]?.id ?? "" });
    setError(null);
  }

  function startEdit(room: RoomDTO) {
    setEditingId(room.id);
    setForm({ name: room.name, residentName: room.residentName ?? "", zoneId: room.zoneId });
    setError(null);
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      if (editingId) await updateRoom(editingId, form);
      else await createRoom(form);
      onChange();
      startAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // By explicit request, Room delete is allowed to cascade through Meter ->
  // Reading history rather than being blocked — the server does the actual
  // cascade (src/lib/admin/cascadeDelete.ts); this just warns with the real
  // affected counts before calling it.
  async function handleDelete(room: RoomDTO) {
    const metersInRoom = meters.filter((m) => m.roomId === room.id);
    const readingCount = metersInRoom.reduce((sum, m) => sum + m.readingCount, 0);

    const message =
      metersInRoom.length === 0
        ? `ลบห้องพัก "${room.name}" ใช่หรือไม่?`
        : `ลบห้องพัก "${room.name}" จะลบมิเตอร์ ${metersInRoom.length} เครื่อง และประวัติการอ่านมิเตอร์ ${readingCount} รายการอย่างถาวร ไม่สามารถกู้คืนได้ ต้องการดำเนินการต่อหรือไม่?`;
    if (!window.confirm(message)) return;
    setError(null);
    try {
      await deleteRoom(room.id);
      onChange();
      if (editingId === room.id) startAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">ห้องพัก (Room)</h3>

      <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="p-2">ชื่อห้องพัก</th>
              <th className="p-2">ชื่อ-สกุลผู้พักอาศัย</th>
              <th className="p-2">โซน</th>
              <th className="p-2">จำนวนมิเตอร์</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center text-zinc-500">
                  ยังไม่มีข้อมูลห้องพัก
                </td>
              </tr>
            )}
            {rooms.map((room) => (
              <Fragment key={room.id}>
                <tr className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                  <td className="p-2">{room.name}</td>
                  <td className="p-2">{room.residentName ?? "-"}</td>
                  <td className="p-2">{room.zoneName}</td>
                  <td className="p-2">{room.meterCount}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startAddMeter(room)}
                      className="mr-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                    >
                      เพิ่มมิเตอร์
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(room)}
                      className="mr-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(room)}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-400"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
                {addMeterRoomId === room.id && (
                  <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <td colSpan={5} className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          เพิ่มมิเตอร์ให้ห้อง &quot;{room.name}&quot;:
                        </span>
                        <input
                          value={newMeterCode}
                          onChange={(e) => setNewMeterCode(e.target.value)}
                          placeholder="รหัสมิเตอร์ (เช่น ME-004)"
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddMeterSubmit(room)}
                          disabled={addMeterBusy}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={cancelAddMeter}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700"
                        >
                          ยกเลิก
                        </button>
                        {addMeterError && (
                          <span className="text-xs font-medium text-red-600">{addMeterError}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-sm font-semibold">{editingId ? "แก้ไขห้องพัก" : "เพิ่มห้องพักใหม่"}</p>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="ชื่อห้องพัก (เช่น ห้อง 101)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          value={form.residentName}
          onChange={(e) => setForm((f) => ({ ...f, residentName: e.target.value }))}
          placeholder="ชื่อ-สกุลผู้พักอาศัย (ถ้ามี)"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={form.zoneId}
          onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            เลือกโซน
          </option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
          >
            {editingId ? "บันทึกการแก้ไข" : "เพิ่มห้องพัก"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={startAdd}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
