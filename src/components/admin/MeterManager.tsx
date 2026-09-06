"use client";

import { useMemo, useState } from "react";
import { deleteMeter, updateMeter } from "@/lib/admin/adminApi";
import type { MeterDTO, RoomDTO, ZoneDTO } from "@/lib/admin/types";
import MeterQrModal from "./MeterQrModal";
import PrintQrModal from "./PrintQrModal";

// Adding a new Meter now happens inline on its Room's row instead
// (src/components/admin/RoomManager.tsx) — this component only edits/
// deletes existing meters and displays the grouped/filterable table.
export default function MeterManager({
  meters,
  rooms,
  zones,
  onChange,
}: {
  meters: MeterDTO[];
  rooms: RoomDTO[];
  zones: ZoneDTO[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", roomId: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Display filters (item requested: table grouped by zone, a zone filter,
  // and a search box matching either room name or meter code) — these only
  // affect what's shown in the table above, never the add/edit form below.
  const [zoneFilter, setZoneFilter] = useState("");
  const [search, setSearch] = useState("");

  const [qrModalCode, setQrModalCode] = useState<string | null>(null);
  const [printCodes, setPrintCodes] = useState<string[] | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  function toggleSelected(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function openPrintForSelected() {
    if (selectedCodes.size === 0) return;
    setPrintCodes(Array.from(selectedCodes));
  }

  const groupedByZone = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = meters.filter((m) => {
      if (zoneFilter && m.zoneName !== zoneFilter) return false;
      if (!query) return true;
      return (
        m.roomName.toLowerCase().includes(query) || m.code.toLowerCase().includes(query)
      );
    });

    const groups = new Map<string, MeterDTO[]>();
    for (const m of filtered) {
      const list = groups.get(m.zoneName) ?? [];
      list.push(m);
      groups.set(m.zoneName, list);
    }

    // Zone order follows the Zone table's own order; only show zones that
    // actually have a matching meter under the current filter/search.
    const orderedNames = zones.map((z) => z.name).filter((name) => groups.has(name));
    return orderedNames.map((name) => ({ zoneName: name, meters: groups.get(name)! }));
  }, [meters, zones, zoneFilter, search]);

  const filteredCodes = useMemo(
    () => groupedByZone.flatMap((g) => g.meters.map((m) => m.code)),
    [groupedByZone],
  );
  const allFilteredSelected =
    filteredCodes.length > 0 && filteredCodes.every((c) => selectedCodes.has(c));

  function toggleSelectAllFiltered() {
    setSelectedCodes((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredCodes.forEach((c) => next.delete(c));
        return next;
      }
      return new Set([...prev, ...filteredCodes]);
    });
  }

  function closeEdit() {
    setEditingId(null);
    setError(null);
  }

  function startEdit(meter: MeterDTO) {
    setEditingId(meter.id);
    setForm({ code: meter.code, roomId: meter.roomId });
    setError(null);
  }

  async function handleSubmit() {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await updateMeter(editingId, form);
      onChange();
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(meter: MeterDTO) {
    if (!window.confirm(`ลบมิเตอร์ "${meter.code}" ใช่หรือไม่?`)) return;
    setError(null);
    try {
      await deleteMeter(meter.id);
      onChange();
      if (editingId === meter.id) closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">มิเตอร์ (Meter)</h3>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">ทุกโซน</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.name}>
              {zone.name}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาห้องพักหรือรหัสมิเตอร์"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {groupedByZone.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
            />
            เลือกทั้งหมด (ตามตัวกรอง)
          </label>
          <button
            type="button"
            onClick={openPrintForSelected}
            disabled={selectedCodes.size === 0}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"
          >
            ปริ้น QRcode ที่เลือก ({selectedCodes.size})
          </button>
        </div>
      )}

      {groupedByZone.length === 0 && (
        <p className="rounded-xl border border-zinc-300 p-3 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {meters.length === 0 ? "ยังไม่มีข้อมูลมิเตอร์" : "ไม่พบมิเตอร์ที่ตรงกับเงื่อนไข"}
        </p>
      )}

      {groupedByZone.map((group) => (
        <div key={group.zoneName} className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            โซน: {group.zoneName}
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-700">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr className="text-left">
                  <th className="w-8 p-2"></th>
                  <th className="p-2">รหัสมิเตอร์</th>
                  <th className="p-2">ห้องพัก</th>
                  <th className="p-2">จำนวนประวัติการอ่าน</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {group.meters.map((meter) => (
                  <tr key={meter.id} className="border-t border-zinc-200 transition-colors hover:bg-emerald-50/60 dark:border-zinc-800 dark:hover:bg-emerald-950/10">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedCodes.has(meter.code)}
                        onChange={() => toggleSelected(meter.code)}
                      />
                    </td>
                    <td className="p-2 font-semibold">{meter.code}</td>
                    <td className="p-2">{meter.roomName}</td>
                    <td className="p-2">{meter.readingCount}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setQrModalCode(meter.code)}
                        className="mr-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      >
                        QR
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(meter)}
                        className="mr-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(meter)}
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
        </div>
      ))}

      {editingId && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-sm font-semibold">แก้ไขมิเตอร์</p>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="รหัสมิเตอร์ (เช่น ME-004)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={form.roomId}
            onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              เลือกห้องพัก
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.zoneName})
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
              บันทึกการแก้ไข
            </button>
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {qrModalCode && (
        <MeterQrModal
          code={qrModalCode}
          onClose={() => setQrModalCode(null)}
          onPrint={() => {
            setPrintCodes([qrModalCode]);
            setQrModalCode(null);
          }}
        />
      )}

      {printCodes && (
        <PrintQrModal codes={printCodes} onClose={() => setPrintCodes(null)} />
      )}
    </section>
  );
}
