"use client";

import { useCallback, useEffect, useState } from "react";
import { listMeters, listRooms, listZones } from "@/lib/admin/adminApi";
import type { MeterDTO, RoomDTO, ZoneDTO } from "@/lib/admin/types";
import MeterManager from "./MeterManager";
import RoomManager from "./RoomManager";
import ZoneManager from "./ZoneManager";

// Zone -> Room -> Meter is a hierarchy, so all three are managed together in
// this one tab (Phase kickoff: "จัดการมิเตอร์") with data fetched once and
// shared, so e.g. a newly-added Room shows up immediately in the Meter
// form's room dropdown without a second round-trip.
export default function MeterManagement() {
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [meters, setMeters] = useState<MeterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const [z, r, m] = await Promise.all([listZones(), listRooms(), listMeters()]);
    setZones(z);
    setRooms(r);
    setMeters(m);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAll();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  if (error) {
    return <p className="text-sm font-medium text-red-600">{error}</p>;
  }
  if (loading) {
    return <p className="text-sm text-zinc-500">กำลังโหลด...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <ZoneManager zones={zones} rooms={rooms} meters={meters} onChange={refreshAll} />
      <RoomManager rooms={rooms} zones={zones} meters={meters} onChange={refreshAll} />
      <MeterManager meters={meters} rooms={rooms} zones={zones} onChange={refreshAll} />
    </div>
  );
}
