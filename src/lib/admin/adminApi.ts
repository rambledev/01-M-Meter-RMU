import type { BillingConfig } from "@/lib/billing/types";
import type {
  AdminDashboardSummary,
  MeterDTO,
  MissingReadingDTO,
  ReadingHistoryDTO,
  RoleValue,
  RoomDTO,
  UserDTO,
  ZoneDTO,
} from "./types";

// Thin client-side fetch wrapper for /api/admin/** — every function either
// resolves with the data the route returns, or throws an Error whose
// message is the Thai message from the route's error body (never a raw
// HTTP status), so calling components can show it directly to the user.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
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

export function fetchDashboard(): Promise<AdminDashboardSummary> {
  return request("/api/admin/dashboard");
}

export function listZones(): Promise<ZoneDTO[]> {
  return request("/api/admin/zones");
}
export function createZone(name: string): Promise<ZoneDTO[]> {
  return request("/api/admin/zones", { method: "POST", body: JSON.stringify({ name }) });
}
export function updateZone(id: string, name: string): Promise<ZoneDTO[]> {
  return request(`/api/admin/zones/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}
export function deleteZone(id: string): Promise<ZoneDTO[]> {
  return request(`/api/admin/zones/${id}`, { method: "DELETE" });
}

export function listRooms(): Promise<RoomDTO[]> {
  return request("/api/admin/rooms");
}
export interface RoomInput {
  name: string;
  residentName: string;
  zoneId: string;
}
export function createRoom(input: RoomInput): Promise<RoomDTO[]> {
  return request("/api/admin/rooms", { method: "POST", body: JSON.stringify(input) });
}
export function updateRoom(id: string, input: RoomInput): Promise<RoomDTO[]> {
  return request(`/api/admin/rooms/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export function deleteRoom(id: string): Promise<RoomDTO[]> {
  return request(`/api/admin/rooms/${id}`, { method: "DELETE" });
}

export function listMeters(): Promise<MeterDTO[]> {
  return request("/api/admin/meters");
}
export interface MeterInput {
  code: string;
  roomId: string;
}
export function createMeter(input: MeterInput): Promise<MeterDTO[]> {
  return request("/api/admin/meters", { method: "POST", body: JSON.stringify(input) });
}
export function updateMeter(id: string, input: MeterInput): Promise<MeterDTO[]> {
  return request(`/api/admin/meters/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export function deleteMeter(id: string): Promise<MeterDTO[]> {
  return request(`/api/admin/meters/${id}`, { method: "DELETE" });
}

export function listUsers(): Promise<UserDTO[]> {
  return request("/api/admin/users");
}
// username/password required unless role is RESIDENT (Google login only,
// email required instead — src/lib/admin/validation.ts's
// validateResidentEmail enforces @rmu.ac.th server-side too).
export interface CreateUserInput {
  name: string;
  username?: string;
  password?: string;
  email?: string;
  role: RoleValue;
  zoneIds: string[]; // มีความหมายกับ role METER_READER เท่านั้น
  roomId?: string; // มีความหมายกับ role RESIDENT เท่านั้น
}
// password omitted/blank on update means "keep the current password".
// isApproved omitted means "leave as-is" — pass it explicitly to approve
// (or revoke) a self-service signup (src/app/api/auth/register).
export interface UpdateUserInput {
  name: string;
  username?: string;
  password?: string;
  email?: string;
  role: RoleValue;
  zoneIds: string[];
  roomId?: string;
  isApproved?: boolean;
}
export function createUser(input: CreateUserInput): Promise<UserDTO[]> {
  return request("/api/admin/users", { method: "POST", body: JSON.stringify(input) });
}
export function updateUser(id: string, input: UpdateUserInput): Promise<UserDTO[]> {
  return request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}
export function deleteUser(id: string): Promise<UserDTO[]> {
  return request(`/api/admin/users/${id}`, { method: "DELETE" });
}

export function listReadingHistory(): Promise<ReadingHistoryDTO[]> {
  return request("/api/admin/readings");
}

export function listMissingReadings(month: string): Promise<MissingReadingDTO[]> {
  return request(`/api/admin/readings/missing?month=${month}`);
}

export function updateBillingConfig(input: BillingConfig): Promise<BillingConfig> {
  return request("/api/admin/billing-config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

// Evidence document for the current billing rate settings — separate from
// updateBillingConfig() above (never touches ftRate/taxRatePercent/
// baseCharge/tiers, and vice versa). Not using request()'s JSON helper
// here: a file upload needs multipart/form-data, which the browser sets
// its own boundary for — an explicit "Content-Type: application/json"
// header would break it.
export async function uploadBillingConfigDocument(file: File): Promise<BillingConfig> {
  const formData = new FormData();
  formData.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/admin/billing-config/document", { method: "POST", body: formData });
  } catch {
    throw new Error("เชื่อมต่อเครือข่ายไม่สำเร็จ");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    throw new Error(body?.message ?? "อัปโหลดไม่สำเร็จ");
  }
  return body.data as BillingConfig;
}

export function deleteBillingConfigDocument(): Promise<BillingConfig> {
  return request("/api/admin/billing-config/document", { method: "DELETE" });
}
