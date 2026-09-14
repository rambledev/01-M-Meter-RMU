import type { ResidentRoomRef, RoomOption } from "./types";

export async function fetchRoomOptions(): Promise<RoomOption[]> {
  const res = await fetch("/api/rooms");
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดรายชื่อห้องพักไม่สำเร็จ");
  }
  return body.data as RoomOption[];
}

export async function setResidentRoom(userId: string, roomId: string): Promise<ResidentRoomRef> {
  const res = await fetch("/api/resident/room", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, roomId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "บันทึกห้องไม่สำเร็จ");
  }
  return body.data.room as ResidentRoomRef;
}
