// Shared shapes for the Admin data-management UI (/admin) and its API routes
// (src/app/api/admin/**). Plain DTOs only — no Prisma types leak into client
// components.

export type RoleValue = "ADMIN" | "METER_READER" | "RESIDENT";

export interface ZoneDTO {
  id: string;
  name: string;
  roomCount: number;
}

export interface RoomDTO {
  id: string;
  name: string;
  residentName: string | null;
  zoneId: string;
  zoneName: string;
  meterCount: number;
}

export interface MeterDTO {
  id: string;
  code: string;
  roomId: string;
  roomName: string;
  zoneName: string;
  readingCount: number;
}

export interface ZoneRef {
  id: string;
  name: string;
}

export interface RoomRef {
  id: string;
  name: string;
  zoneName: string;
}

export interface UserDTO {
  id: string;
  name: string;
  username: string | null; // มีความหมายกับ role ADMIN/METER_READER ที่ล็อกอินด้วย username/password เท่านั้น
  email: string | null; // มีความหมายกับ role RESIDENT เสมอ, หรือ METER_READER ที่สมัครเองผ่าน Google (username เป็น null ในกรณีนั้น)
  role: RoleValue;
  isApproved: boolean; // false = สมัครเองผ่าน /login แล้วรอ Admin อนุมัติ — บัญชีที่ Admin สร้างเองเป็น true เสมอ
  responsibleZones: ZoneRef[]; // มีความหมายกับ role METER_READER เท่านั้น
  residentRoom: RoomRef | null; // มีความหมายกับ role RESIDENT เท่านั้น
  readingCount: number;
}

export interface ReadingHistoryDTO {
  id: string;
  meterId: string;
  meterCode: string;
  roomName: string;
  zoneName: string;
  period: string; // "MM/BBBB", e.g. "01/2569" (src/lib/admin/period.ts)
  readingMonth: string; // ISO date — for sorting only, use `period` for display
  previousValue: number | null;
  currentValue: number | null;
  usage: number | null;
  status: string; // ReadingStatus
  recordedByName: string;
  recordedAt: string | null; // ISO
}

export interface MissingReadingDTO {
  meterId: string;
  meterCode: string;
  roomName: string;
  zoneName: string;
}

export interface AdminDashboardSummary {
  zoneCount: number;
  roomCount: number;
  meterCount: number;
  userCount: number;
  readingCount: number;
  readingCountThisMonth: number;
  syncErrorCount: number;
}

export interface ApiErrorBody {
  ok: false;
  error:
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "DUPLICATE"
    | "HAS_DEPENDENTS"
    | "INTERNAL_ERROR"
    | "UNAUTHORIZED" // (2026-09-17) ไม่มี admin session — 401
    | "FORBIDDEN"; // (2026-09-17) มี session แต่ role ไม่ใช่ ADMIN — 403
  message: string;
}

// Client-side identity for the logged-in Admin (2026-09-17) —
// src/lib/admin/adminSession.ts. Sent back on every Ft mutation call
// (src/lib/admin/ftApi.ts) so the server can re-check the real role from
// the database — see src/lib/admin/requireAdmin.ts.
export interface AdminSession {
  id: string;
  name: string;
}

export type FtHistoryAction = "CREATE" | "UPDATE" | "DISABLE" | "ENABLE";

export interface FtHistoryEntryDTO {
  id: string;
  action: FtHistoryAction;
  oldValue: number | null;
  newValue: number | null;
  reason: string | null;
  performedByName: string;
  performedAt: string; // ISO
}

export interface FtDocumentDTO {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedByName: string;
  uploadedAt: string; // ISO
}

export interface FtRateDTO {
  id: string;
  readingMonth: string; // "YYYY-MM-01"
  ftRate: number;
  status: "ACTIVE" | "DISABLED";
  notes: string | null;
  createdByName: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  documents: FtDocumentDTO[];
}
