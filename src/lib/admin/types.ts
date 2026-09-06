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

export interface UserDTO {
  id: string;
  name: string;
  username: string | null;
  role: RoleValue;
  responsibleZones: ZoneRef[];
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
  error: "VALIDATION_ERROR" | "NOT_FOUND" | "DUPLICATE" | "HAS_DEPENDENTS" | "INTERNAL_ERROR";
  message: string;
}
