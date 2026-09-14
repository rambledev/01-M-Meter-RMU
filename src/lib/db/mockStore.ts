// In-memory data store backing src/lib/db/mockPrisma.ts — used ONLY when
// MOCK_DATA=true (see src/lib/db/prisma.ts), so the whole app can run and
// be demoed with zero network/database dependency while the real
// PostgreSQL server is unreachable (2026-09-08). Mutations made while the
// app is running (Admin CRUD, checker readings, etc.) mutate these arrays
// directly and last only for the lifetime of the Node process — nothing
// here is persisted to disk.
//
// Every "Decimal" field (confirmedValue/previousReading/usage/ftRate/etc)
// is a plain `number` — every real call site already treats Prisma's
// Decimal as merely Number()-coercible (see src/lib/export/mapReadingToRow.ts),
// so plain numbers are a fully compatible stand-in.

export type RoleValue = "ADMIN" | "METER_READER" | "RESIDENT";
export type ReadingStatusValue = "DRAFT" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "SYNC_ERROR";

export interface MockZone {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockRoom {
  id: string;
  name: string;
  residentName: string | null;
  zoneId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockMeter {
  id: string;
  code: string;
  roomId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockUser {
  id: string;
  name: string;
  username: string | null;
  passwordHash: string | null;
  email: string | null; // มีความหมายกับ role RESIDENT เท่านั้น (login ด้วย Google, ไม่มี username/passwordHash)
  role: RoleValue;
  responsibleZoneIds: string[]; // มีความหมายกับ role METER_READER เท่านั้น
  residentRoomId: string | null; // มีความหมายกับ role RESIDENT เท่านั้น
  createdAt: Date;
}

export interface MockReading {
  id: string;
  meterId: string;
  readingMonth: Date;
  previousReading: number | null;
  ocrValue: string | null;
  confirmedValue: number | null;
  usage: number | null;
  status: ReadingStatusValue;
  recordedBy: string;
  recordedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockReadingImage {
  id: string;
  readingId: string;
  path: string;
  createdAt: Date;
}

export interface MockSyncLog {
  id: string;
  readingId: string;
  attemptedAt: Date;
  status: ReadingStatusValue;
  errorReason: string | null;
}

export interface MockBillingTier {
  minUnit: number;
  maxUnit: number | null;
  rate: number;
}

export interface MockBillingConfigRow {
  id: string;
  ftRate: number;
  taxRatePercent: number;
  baseCharge: number;
  tiers: MockBillingTier[];
  updatedAt: Date;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `mock-${prefix}-${counter}`;
}

function monthUTC(year: number, month1to12: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, 1));
}

// Precomputed with the same scrypt algorithm as src/lib/admin/password.ts
// (hashPassword("Demo1234!")) so the mock "checker-demo" account logs in
// with the same credentials the real seeded demo account used.
const DEMO_PASSWORD_HASH =
  "6479b2b176c5eed61a9b04ca70266be9:62ea8850e8e730649e9142d7d2c5a18c7d9c478ea05285fbbc284e86ce0d8c23dc99f59b7fea9d3dddae1761744cbc13dc66d21c4918115765e816cf2d26f70b";

const now = new Date();

export const mockZones: MockZone[] = [
  { id: "mock-zone-1", name: "บ้านพัก", createdAt: now, updatedAt: now },
  { id: "mock-zone-2", name: "วรุณ 1", createdAt: now, updatedAt: now },
  { id: "mock-zone-3", name: "วรุณ 2", createdAt: now, updatedAt: now },
];

export const mockRooms: MockRoom[] = [
  { id: "mock-room-1", name: "80/1", residentName: "สมชาย ใจดี", zoneId: "mock-zone-1", createdAt: now, updatedAt: now },
  { id: "mock-room-2", name: "80/2", residentName: "สมหญิง มีสุข", zoneId: "mock-zone-1", createdAt: now, updatedAt: now },
  { id: "mock-room-3", name: "201", residentName: "วิชัย ทองดี", zoneId: "mock-zone-2", createdAt: now, updatedAt: now },
  { id: "mock-room-4", name: "202", residentName: "มาลี ศรีสุข", zoneId: "mock-zone-2", createdAt: now, updatedAt: now },
  { id: "mock-room-5", name: "201", residentName: "ประยุทธ์ แสงทอง", zoneId: "mock-zone-3", createdAt: now, updatedAt: now },
  { id: "mock-room-6", name: "202", residentName: "อรุณี ใจงาม", zoneId: "mock-zone-3", createdAt: now, updatedAt: now },
];

export const mockMeters: MockMeter[] = [
  { id: "mock-meter-1", code: "ME-001", roomId: "mock-room-1", createdAt: now, updatedAt: now },
  { id: "mock-meter-2", code: "ME-002", roomId: "mock-room-2", createdAt: now, updatedAt: now },
  { id: "mock-meter-3", code: "ME-003", roomId: "mock-room-3", createdAt: now, updatedAt: now },
  { id: "mock-meter-4", code: "ME-004", roomId: "mock-room-4", createdAt: now, updatedAt: now },
  { id: "mock-meter-5", code: "ME-005", roomId: "mock-room-5", createdAt: now, updatedAt: now },
  { id: "mock-meter-6", code: "ME-006", roomId: "mock-room-6", createdAt: now, updatedAt: now },
];

export const mockUsers: MockUser[] = [
  {
    id: "mock-user-demo",
    name: "ผู้จดมิเตอร์ทุกโซน (Demo)",
    username: "checker-demo",
    passwordHash: DEMO_PASSWORD_HASH,
    email: null,
    role: "METER_READER",
    responsibleZoneIds: ["mock-zone-1", "mock-zone-2", "mock-zone-3"],
    residentRoomId: null,
    createdAt: now,
  },
  {
    id: "mock-user-resident",
    name: "สมชาย ใจดี (Demo)",
    username: null,
    passwordHash: null,
    email: "resident-demo@rmu.ac.th",
    role: "RESIDENT",
    responsibleZoneIds: [],
    residentRoomId: "mock-room-1",
    createdAt: now,
  },
];

// 3 months of chained history (usage/confirmedValue increasing) per meter,
// same shape prisma/seedReadings.cjs produces against the real database.
function buildDemoReadings(): MockReading[] {
  const months = [monthUTC(2026, 6), monthUTC(2026, 7), monthUTC(2026, 8)];
  const readings: MockReading[] = [];
  let seed = 1000;
  for (const meter of mockMeters) {
    let previous: number | null = null;
    for (const readingMonth of months) {
      seed += 137;
      const usageStep: number | null = previous === null ? null : 80 + (seed % 170);
      const confirmedValue: number =
        previous === null ? 1200 + (seed % 3000) : previous + (usageStep ?? 0);
      readings.push({
        id: newId("reading"),
        meterId: meter.id,
        readingMonth,
        previousReading: previous,
        ocrValue: null,
        confirmedValue,
        usage: usageStep,
        status: "SYNCED",
        recordedBy: "mock-user-demo",
        recordedAt: new Date(readingMonth.getTime()),
        createdAt: now,
        updatedAt: now,
      });
      previous = confirmedValue;
    }
  }
  return readings;
}

export const mockReadings: MockReading[] = buildDemoReadings();
export const mockReadingImages: MockReadingImage[] = [];
export const mockSyncLogs: MockSyncLog[] = [];

// Lazily seeded on first read, matching getOrSeedBillingConfig()'s real
// behavior — starts null, not pre-populated here.
export let mockBillingConfig: MockBillingConfigRow | null = null;
export function setMockBillingConfig(row: MockBillingConfigRow): void {
  mockBillingConfig = row;
}
