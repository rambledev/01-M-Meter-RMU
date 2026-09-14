import type { ResidentHistoryDTO } from "./types";

export async function fetchResidentHistory(userId: string): Promise<ResidentHistoryDTO> {
  const res = await fetch(`/api/resident/history?userId=${encodeURIComponent(userId)}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "โหลดประวัติการจดมิเตอร์ไม่สำเร็จ");
  }
  return body.data as ResidentHistoryDTO;
}
