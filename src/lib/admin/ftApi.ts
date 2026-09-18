import { getAdminSession } from "./adminSession";
import type { FtHistoryEntryDTO, FtRateDTO } from "./types";

// Client-side wrapper for /api/admin/ft/** (2026-09-17). Every mutating
// call attaches the logged-in Admin's opaque id (src/lib/admin/
// adminSession.ts) as the "x-admin-id" header — the server independently
// re-checks the real role from the database for every one of these calls
// (src/lib/admin/requireAdmin.ts); this header is never trusted as a role
// claim by itself. Mirrors the request()/error-message pattern already
// established by src/lib/admin/adminApi.ts.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const session = getAdminSession();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { "x-admin-id": session.id } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("เชื่อมต่อเครือข่ายไม่สำเร็จ");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  }
  return body.data as T;
}

export function fetchFtByMonth(monthValue: string): Promise<FtRateDTO | null> {
  return request(`/api/admin/ft?month=${encodeURIComponent(monthValue)}`);
}

export function fetchFtList(): Promise<FtRateDTO[]> {
  return request("/api/admin/ft/list");
}

export function fetchFtHistory(id: string): Promise<FtHistoryEntryDTO[]> {
  return request(`/api/admin/ft/${id}/history`);
}

export interface CreateFtInput {
  readingMonth: string; // "YYYY-MM"
  ftRate: number;
  notes: string | null;
}

export function createFt(input: CreateFtInput): Promise<FtRateDTO> {
  return request("/api/admin/ft", { method: "POST", body: JSON.stringify(input) });
}

export interface UpdateFtInput {
  ftRate: number;
  notes: string | null;
}

export function updateFt(id: string, input: UpdateFtInput): Promise<FtRateDTO> {
  return request(`/api/admin/ft/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function disableFt(id: string, reason?: string): Promise<FtRateDTO> {
  return request(`/api/admin/ft/${id}/disable`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export function enableFt(id: string, reason?: string): Promise<FtRateDTO> {
  return request(`/api/admin/ft/${id}/enable`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

// Not using request()'s JSON helper — multipart/form-data needs the
// browser's own auto-generated boundary, an explicit "Content-Type:
// application/json" would break it (same reasoning as
// src/lib/admin/adminApi.ts's uploadBillingConfigDocument()).
export async function uploadFtDocument(ftRateId: string, file: File): Promise<FtRateDTO> {
  const session = getAdminSession();
  const formData = new FormData();
  formData.append("file", file);
  let res: Response;
  try {
    res = await fetch(`/api/admin/ft/${ftRateId}/documents`, {
      method: "POST",
      headers: session ? { "x-admin-id": session.id } : undefined,
      body: formData,
    });
  } catch {
    throw new Error("เชื่อมต่อเครือข่ายไม่สำเร็จ");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "อัปโหลดไม่สำเร็จ");
  }
  return body.data as FtRateDTO;
}

export function deleteFtDocument(ftRateId: string, docId: string): Promise<FtRateDTO> {
  return request(`/api/admin/ft/${ftRateId}/documents/${docId}`, { method: "DELETE" });
}
