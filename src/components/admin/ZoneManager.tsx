"use client";

import { useState } from "react";
import { createZone, deleteZone, updateZone } from "@/lib/admin/adminApi";
import type { MeterDTO, RoomDTO, ZoneDTO } from "@/lib/admin/types";

export default function ZoneManager({
  zones,
  rooms,
  meters,
  onChange,
}: {
  zones: ZoneDTO[];
  rooms: RoomDTO[];
  meters: MeterDTO[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setEditingId(null);
    setName("");
    setError(null);
  }

  function startEdit(zone: ZoneDTO) {
    setEditingId(zone.id);
    setName(zone.name);
    setError(null);
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      if (editingId) await updateZone(editingId, name);
      else await createZone(name);
      onChange();
      startAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // By explicit request, Zone delete is allowed to cascade through Room ->
  // Meter -> Reading history rather than being blocked — the server does
  // the actual cascade (src/lib/admin/cascadeDelete.ts); this just warns
  // with the real affected counts before calling it.
  async function handleDelete(zone: ZoneDTO) {
    const roomsInZone = rooms.filter((r) => r.zoneId === zone.id);
    const roomIds = new Set(roomsInZone.map((r) => r.id));
    const metersInZone = meters.filter((m) => roomIds.has(m.roomId));
    const readingCount = metersInZone.reduce((sum, m) => sum + m.readingCount, 0);

    const message =
      roomsInZone.length === 0
        ? `ลบโซน "${zone.name}" ใช่หรือไม่?`
        : `ลบโซน "${zone.name}" จะลบห้องพัก ${roomsInZone.length} ห้อง, มิเตอร์ ${metersInZone.length} เครื่อง และประวัติการอ่านมิเตอร์ ${readingCount} รายการอย่างถาวร ไม่สามารถกู้คืนได้ ต้องการดำเนินการต่อหรือไม่?`;
    if (!window.confirm(message)) return;
    setError(null);
    try {
      await deleteZone(zone.id);
      onChange();
      if (editingId === zone.id) startAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">โซน (Zone)</h3>

      <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="p-2">ชื่อโซน</th>
              <th className="p-2">จำนวนห้องพัก</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 && (
              <tr>
                <td colSpan={3} className="p-3 text-center text-zinc-500">
                  ยังไม่มีข้อมูลโซน
                </td>
              </tr>
            )}
            {zones.map((zone) => (
              <tr key={zone.id} className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                <td className="p-2">{zone.name}</td>
                <td className="p-2">{zone.roomCount}</td>
                <td className="p-2 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(zone)}
                    className="mr-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(zone)}
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

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-sm font-semibold">{editingId ? "แก้ไขโซน" : "เพิ่มโซนใหม่"}</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อโซน"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
          >
            {editingId ? "บันทึกการแก้ไข" : "เพิ่มโซน"}
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
