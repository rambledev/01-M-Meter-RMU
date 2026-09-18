// Hand-rolled stand-in for @prisma/client's PrismaClient, covering exactly
// the method calls this codebase actually makes (grep for `prisma\.\w+\.\w+`
// across src/ to see the full surface area) — NOT a generic Prisma engine.
// Used only when MOCK_DATA=true (src/lib/db/prisma.ts), so the app can run
// fully offline while the real PostgreSQL server is unreachable
// (2026-09-08). Every route keeps calling `prisma.model.method(...)`
// completely unchanged; this file is the only thing that's swapped in.
import { Prisma } from "@prisma/client";
import {
  type MockBillingConfigRow,
  type MockFtDocument,
  type MockFtHistoryAction,
  type MockFtRate,
  type MockFtRateHistory,
  type MockFtStatus,
  type MockMeter,
  type MockReading,
  type MockRoom,
  type MockUser,
  type MockZone,
  mockBillingConfig,
  mockFtDocuments,
  mockFtRateHistory,
  mockFtRates,
  mockMeters,
  mockReadingImages,
  mockReadings,
  mockRooms,
  mockSyncLogs,
  mockUsers,
  mockZones,
  newId,
  setMockBillingConfig,
} from "./mockStore";

function notFoundError(message = "Record not found"): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: "P2025",
    clientVersion: "mock",
  });
}

function uniqueConstraintError(message = "Unique constraint failed"): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: "P2002",
    clientVersion: "mock",
  });
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function byNameAsc<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function byCodeAsc<T extends { code: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.code.localeCompare(b.code));
}

// ---- enrichment helpers (mirror Prisma `include`) ----

function withZone(room: MockRoom) {
  const zone = mockZones.find((z) => z.id === room.zoneId);
  if (!zone) throw new Error(`mock data inconsistency: room ${room.id} has no zone`);
  return { ...room, zone };
}

function withRoomAndZone(meter: MockMeter) {
  const room = mockRooms.find((r) => r.id === meter.roomId);
  if (!room) throw new Error(`mock data inconsistency: meter ${meter.id} has no room`);
  return { ...meter, room: withZone(room) };
}

function roomCountForZone(zoneId: string): number {
  return mockRooms.filter((r) => r.zoneId === zoneId).length;
}

function meterCountForRoom(roomId: string): number {
  return mockMeters.filter((m) => m.roomId === roomId).length;
}

function readingCountForMeter(meterId: string): number {
  return mockReadings.filter((r) => r.meterId === meterId).length;
}

function readingCountForUser(userId: string): number {
  return mockReadings.filter((r) => r.recordedBy === userId).length;
}

function responsibleZonesFor(user: MockUser) {
  return mockZones.filter((z) => user.responsibleZoneIds.includes(z.id));
}

function residentRoomFor(user: MockUser) {
  if (!user.residentRoomId) return null;
  const r = mockRooms.find((room2) => room2.id === user.residentRoomId);
  return r ? withZone(r) : null;
}

// ---- zone ----

const zone = {
  async findMany(args?: { orderBy?: { name?: "asc" } }) {
    const list = mockZones.map((z) => ({
      ...z,
      _count: { rooms: roomCountForZone(z.id) },
    }));
    return args?.orderBy?.name ? byNameAsc(list) : list;
  },
  async findUnique(args: { where: { id: string } }) {
    return mockZones.find((z) => z.id === args.where.id) ?? null;
  },
  async count() {
    return mockZones.length;
  },
  async create(args: { data: { name: string } }) {
    const row: MockZone = { id: newId("zone"), name: args.data.name, createdAt: new Date(), updatedAt: new Date() };
    mockZones.push(row);
    return row;
  },
  async update(args: { where: { id: string }; data: { name: string } }) {
    const z = mockZones.find((x) => x.id === args.where.id);
    if (!z) throw notFoundError();
    z.name = args.data.name;
    z.updatedAt = new Date();
    return z;
  },
  async delete(args: { where: { id: string } }) {
    const index = mockZones.findIndex((z) => z.id === args.where.id);
    if (index === -1) throw notFoundError();
    return mockZones.splice(index, 1)[0];
  },
};

// ---- room ----

const room = {
  async findMany(args?: { where?: { zoneId?: string }; orderBy?: { name?: "asc" }; select?: { id: true } }) {
    let list = mockRooms;
    if (args?.where?.zoneId) list = list.filter((r) => r.zoneId === args.where!.zoneId);
    if (args?.select) return list.map((r) => ({ id: r.id }));
    const enriched = list.map((r) => ({ ...withZone(r), _count: { meters: meterCountForRoom(r.id) } }));
    return args?.orderBy?.name ? byNameAsc(enriched) : enriched;
  },
  async findUnique(args: { where: { id: string } }) {
    const r = mockRooms.find((x) => x.id === args.where.id);
    return r ? withZone(r) : null;
  },
  async count(args?: { where?: { zoneId?: string } }) {
    if (args?.where?.zoneId) return mockRooms.filter((r) => r.zoneId === args.where!.zoneId).length;
    return mockRooms.length;
  },
  async create(args: { data: { name: string; residentName: string | null; zoneId: string } }) {
    const row: MockRoom = {
      id: newId("room"),
      name: args.data.name,
      residentName: args.data.residentName,
      zoneId: args.data.zoneId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRooms.push(row);
    return row;
  },
  async update(args: {
    where: { id: string };
    data: { name: string; residentName: string | null; zoneId: string };
  }) {
    const r = mockRooms.find((x) => x.id === args.where.id);
    if (!r) throw notFoundError();
    r.name = args.data.name;
    r.residentName = args.data.residentName;
    r.zoneId = args.data.zoneId;
    r.updatedAt = new Date();
    return r;
  },
  async deleteMany(args: { where: { id: { in: string[] } } }) {
    const ids = new Set(args.where.id.in);
    const before = mockRooms.length;
    for (let i = mockRooms.length - 1; i >= 0; i--) {
      if (ids.has(mockRooms[i].id)) mockRooms.splice(i, 1);
    }
    return { count: before - mockRooms.length };
  },
};

// ---- meter ----

interface MeterFindManyArgs {
  where?: {
    room?: { zoneId?: string | { in: string[] } };
    readings?: { none?: { readingMonth: Date } };
    roomId?: string | { in: string[] };
  };
  include?: {
    readings?: { where?: { readingMonth?: Date }; select?: { id: true } };
  };
  select?: { id: true };
}

const meter = {
  async findMany(args?: MeterFindManyArgs) {
    let list = mockMeters;
    const where = args?.where;
    if (where?.roomId) {
      if (typeof where.roomId === "string") {
        const id = where.roomId;
        list = list.filter((m) => m.roomId === id);
      } else {
        const ids = new Set(where.roomId.in);
        list = list.filter((m) => ids.has(m.roomId));
      }
    }
    if (where?.room?.zoneId) {
      const zoneFilter = where.room.zoneId;
      list = list.filter((m) => {
        const zoneId = mockRooms.find((r) => r.id === m.roomId)?.zoneId;
        if (!zoneId) return false;
        return typeof zoneFilter === "string" ? zoneId === zoneFilter : zoneFilter.in.includes(zoneId);
      });
    }
    if (where?.readings?.none) {
      const month = where.readings.none.readingMonth;
      list = list.filter((m) => !mockReadings.some((r) => r.meterId === m.id && sameMonth(r.readingMonth, month)));
    }
    if (args?.select) return list.map((m) => ({ id: m.id }));
    const readingsInclude = args?.include?.readings;
    return byCodeAsc(list.map((m) => withRoomAndZone(m))).map((m) => ({
      ...m,
      _count: { readings: readingCountForMeter(m.id) },
      ...(readingsInclude
        ? {
            readings: mockReadings
              .filter(
                (r) =>
                  r.meterId === m.id &&
                  (!readingsInclude.where?.readingMonth ||
                    sameMonth(r.readingMonth, readingsInclude.where.readingMonth)),
              )
              .map((r) => ({ id: r.id })),
          }
        : {}),
    }));
  },
  async findUnique(args: { where: { id: string } }) {
    const m = mockMeters.find((x) => x.id === args.where.id);
    return m ?? null;
  },
  async count() {
    return mockMeters.length;
  },
  async create(args: { data: { code: string; roomId: string } }) {
    if (mockMeters.some((m) => m.code === args.data.code)) {
      throw uniqueConstraintError("Unique constraint failed on Meter.code");
    }
    const row: MockMeter = {
      id: newId("meter"),
      code: args.data.code,
      roomId: args.data.roomId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockMeters.push(row);
    return row;
  },
  async update(args: { where: { id: string }; data: { code: string; roomId: string } }) {
    const m = mockMeters.find((x) => x.id === args.where.id);
    if (!m) throw notFoundError();
    if (mockMeters.some((other) => other.id !== m.id && other.code === args.data.code)) {
      throw uniqueConstraintError("Unique constraint failed on Meter.code");
    }
    m.code = args.data.code;
    m.roomId = args.data.roomId;
    m.updatedAt = new Date();
    return m;
  },
  async delete(args: { where: { id: string } }) {
    const index = mockMeters.findIndex((m) => m.id === args.where.id);
    if (index === -1) throw notFoundError();
    return mockMeters.splice(index, 1)[0];
  },
  async deleteMany(args: { where: { id: { in: string[] } } }) {
    const ids = new Set(args.where.id.in);
    const before = mockMeters.length;
    for (let i = mockMeters.length - 1; i >= 0; i--) {
      if (ids.has(mockMeters[i].id)) mockMeters.splice(i, 1);
    }
    return { count: before - mockMeters.length };
  },
};

// ---- user ----

function toPublicUser(u: MockUser) {
  return {
    ...u,
    responsibleZones: responsibleZonesFor(u),
    residentRoom: residentRoomFor(u),
    _count: { readings: readingCountForUser(u.id) },
  };
}

const user = {
  async findMany(args?: { orderBy?: { name?: "asc" } }) {
    const list = mockUsers.map(toPublicUser);
    return args?.orderBy?.name ? byNameAsc(list) : list;
  },
  async findUnique(args: {
    where: { id?: string; username?: string; email?: string };
    include?: { responsibleZones?: true; residentRoom?: true | { include: { zone: { select: { name: true } } } } };
  }) {
    const u = args.where.id
      ? mockUsers.find((x) => x.id === args.where.id)
      : args.where.username !== undefined
        ? mockUsers.find((x) => x.username === args.where.username)
        : mockUsers.find((x) => x.email === args.where.email);
    if (!u) return null;
    return {
      ...u,
      ...(args.include?.responsibleZones ? { responsibleZones: responsibleZonesFor(u) } : {}),
      ...(args.include?.residentRoom ? { residentRoom: residentRoomFor(u) } : {}),
    };
  },
  async count() {
    return mockUsers.length;
  },
  async create(args: {
    data: {
      name: string;
      username?: string | null;
      email?: string | null;
      passwordHash?: string | null;
      role: MockUser["role"];
      isApproved?: boolean;
      responsibleZones?: { connect: { id: string }[] };
      residentRoom?: { connect: { id: string } };
    };
  }) {
    if (args.data.username && mockUsers.some((u) => u.username === args.data.username)) {
      throw uniqueConstraintError("Unique constraint failed on User.username");
    }
    if (args.data.email && mockUsers.some((u) => u.email === args.data.email)) {
      throw uniqueConstraintError("Unique constraint failed on User.email");
    }
    const zoneIds = (args.data.responsibleZones?.connect ?? []).map((z) => z.id);
    if (zoneIds.some((id) => !mockZones.some((z) => z.id === id))) {
      throw notFoundError("One or more responsibleZones not found");
    }
    const roomId = args.data.residentRoom?.connect.id ?? null;
    if (roomId && !mockRooms.some((r) => r.id === roomId)) {
      throw notFoundError("residentRoom not found");
    }
    const row: MockUser = {
      id: newId("user"),
      name: args.data.name,
      username: args.data.username ?? null,
      passwordHash: args.data.passwordHash ?? null,
      email: args.data.email ?? null,
      role: args.data.role,
      isApproved: args.data.isApproved ?? true, // matches schema.prisma's @default(true)
      responsibleZoneIds: zoneIds,
      residentRoomId: roomId,
      createdAt: new Date(),
    };
    mockUsers.push(row);
    return row;
  },
  async update(args: {
    where: { id: string };
    data: {
      name?: string;
      username?: string | null;
      email?: string | null;
      role?: MockUser["role"];
      isApproved?: boolean;
      responsibleZones?: { set: { id: string }[] };
      residentRoom?: { connect: { id: string } } | { disconnect: true };
      passwordHash?: string;
    };
  }) {
    const u = mockUsers.find((x) => x.id === args.where.id);
    if (!u) throw notFoundError();
    if (
      args.data.username &&
      mockUsers.some((other) => other.id !== u.id && other.username === args.data.username)
    ) {
      throw uniqueConstraintError("Unique constraint failed on User.username");
    }
    if (args.data.email && mockUsers.some((other) => other.id !== u.id && other.email === args.data.email)) {
      throw uniqueConstraintError("Unique constraint failed on User.email");
    }
    if (args.data.responsibleZones) {
      const zoneIds = args.data.responsibleZones.set.map((z) => z.id);
      if (zoneIds.some((id) => !mockZones.some((z) => z.id === id))) {
        throw notFoundError("One or more responsibleZones not found");
      }
      u.responsibleZoneIds = zoneIds;
    }
    if (args.data.residentRoom && "connect" in args.data.residentRoom) {
      const roomId = args.data.residentRoom.connect.id;
      if (!mockRooms.some((r) => r.id === roomId)) throw notFoundError("residentRoom not found");
      u.residentRoomId = roomId;
    } else if (args.data.residentRoom) {
      u.residentRoomId = null;
    }
    if (args.data.name !== undefined) u.name = args.data.name;
    if (args.data.username !== undefined) u.username = args.data.username;
    if (args.data.email !== undefined) u.email = args.data.email;
    if (args.data.role !== undefined) u.role = args.data.role;
    if (args.data.isApproved !== undefined) u.isApproved = args.data.isApproved;
    if (args.data.passwordHash) u.passwordHash = args.data.passwordHash;
    return u;
  },
  async delete(args: { where: { id: string } }) {
    const index = mockUsers.findIndex((u) => u.id === args.where.id);
    if (index === -1) throw notFoundError();
    return mockUsers.splice(index, 1)[0];
  },
};

// ---- reading ----

interface ReadingFindManyArgs {
  where?: {
    readingMonth?: Date;
    meterId?: string | { in: string[] };
    confirmedValue?: { not: null };
    meter?: { room?: { zoneId?: string } };
  };
  select?: Record<string, unknown>;
  orderBy?: { readingMonth?: "asc" | "desc"; meterId?: "asc" | "desc" };
}

function readingMatchesZone(r: MockReading, zoneId: string | undefined): boolean {
  if (!zoneId) return true;
  const meterRow = mockMeters.find((m) => m.id === r.meterId);
  const roomRow = meterRow ? mockRooms.find((room2) => room2.id === meterRow.roomId) : undefined;
  return roomRow?.zoneId === zoneId;
}

const reading = {
  async findMany(args?: ReadingFindManyArgs) {
    let list = mockReadings;
    const where = args?.where;
    if (where?.readingMonth) list = list.filter((r) => sameMonth(r.readingMonth, where.readingMonth!));
    if (where?.meterId) {
      if (typeof where.meterId === "string") {
        const id = where.meterId;
        list = list.filter((r) => r.meterId === id);
      } else {
        const ids = new Set(where.meterId.in);
        list = list.filter((r) => ids.has(r.meterId));
      }
    }
    if (where?.confirmedValue?.not === null) list = list.filter((r) => r.confirmedValue !== null);
    if (where?.meter?.room?.zoneId) {
      const zoneId = where.meter.room.zoneId;
      list = list.filter((r) => readingMatchesZone(r, zoneId));
    }
    if (args?.orderBy?.readingMonth) {
      const dir = args.orderBy.readingMonth === "desc" ? -1 : 1;
      list = [...list].sort((a, b) => dir * (a.readingMonth.getTime() - b.readingMonth.getTime()));
    } else if (args?.orderBy?.meterId) {
      const dir = args.orderBy.meterId === "desc" ? -1 : 1;
      list = [...list].sort((a, b) => dir * a.meterId.localeCompare(b.meterId));
    }
    // Always return the fully-enriched shape regardless of `select` — every
    // call site either wants the enriched fields (executive summary,
    // export, admin readings list) or only reads `.id` off the result
    // (cascadeDelete's `select: { id: true }`), and an over-fetched object
    // satisfies both without needing to interpret arbitrary select shapes.
    return list.map((r) => ({
      ...r,
      meter: withRoomAndZone(mockMeters.find((m) => m.id === r.meterId)!),
      recorder: mockUsers.find((u) => u.id === r.recordedBy)!,
    }));
  },
  async findFirst(args: { where: { meterId: string; readingMonth: { lt?: Date; gt?: Date } } }) {
    let candidates = mockReadings.filter((r) => r.meterId === args.where.meterId);
    if (args.where.readingMonth.lt) {
      const bound = args.where.readingMonth.lt;
      candidates = candidates.filter((r) => r.readingMonth.getTime() < bound.getTime());
    }
    if (args.where.readingMonth.gt) {
      const bound = args.where.readingMonth.gt;
      candidates = candidates.filter((r) => r.readingMonth.getTime() > bound.getTime());
    }
    return candidates[0] ?? null;
  },
  async findUnique(args: { where: { meterId_readingMonth: { meterId: string; readingMonth: Date } } }) {
    const { meterId, readingMonth } = args.where.meterId_readingMonth;
    return mockReadings.find((r) => r.meterId === meterId && sameMonth(r.readingMonth, readingMonth)) ?? null;
  },
  async count(args?: { where?: { readingMonth?: Date; status?: string; meterId?: string; recordedBy?: string } }) {
    let list = mockReadings;
    if (args?.where?.readingMonth) list = list.filter((r) => sameMonth(r.readingMonth, args.where!.readingMonth!));
    if (args?.where?.status) list = list.filter((r) => r.status === args.where!.status);
    if (args?.where?.meterId) list = list.filter((r) => r.meterId === args.where!.meterId);
    if (args?.where?.recordedBy) list = list.filter((r) => r.recordedBy === args.where!.recordedBy);
    return list.length;
  },
  async create(args: {
    data: {
      meterId: string;
      readingMonth: Date;
      previousReading?: number | null;
      ocrValue?: string | null;
      confirmedValue: number;
      usage?: number | null;
      status: MockReading["status"];
      recordedBy: string;
      recordedAt: Date;
    };
  }) {
    if (
      mockReadings.some(
        (r) => r.meterId === args.data.meterId && sameMonth(r.readingMonth, args.data.readingMonth),
      )
    ) {
      throw uniqueConstraintError("Unique constraint failed on Reading.[meterId,readingMonth]");
    }
    const row: MockReading = {
      id: newId("reading"),
      meterId: args.data.meterId,
      readingMonth: args.data.readingMonth,
      previousReading: args.data.previousReading ?? null,
      ocrValue: args.data.ocrValue ?? null,
      confirmedValue: args.data.confirmedValue,
      usage: args.data.usage ?? null,
      status: args.data.status,
      recordedBy: args.data.recordedBy,
      recordedAt: args.data.recordedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReadings.push(row);
    return row;
  },
  async update(args: { where: { id: string }; data: { previousReading?: number | null; usage?: number | null } }) {
    const r = mockReadings.find((x) => x.id === args.where.id);
    if (!r) throw notFoundError();
    if (args.data.previousReading !== undefined) r.previousReading = args.data.previousReading;
    if (args.data.usage !== undefined) r.usage = args.data.usage;
    r.updatedAt = new Date();
    return r;
  },
  async delete(args: { where: { id: string } }) {
    const index = mockReadings.findIndex((r) => r.id === args.where.id);
    if (index === -1) throw notFoundError();
    return mockReadings.splice(index, 1)[0];
  },
  async deleteMany(args: { where: { id: { in: string[] }; meterId?: { in: string[] } } }) {
    const ids = new Set(args.where.id.in);
    const before = mockReadings.length;
    for (let i = mockReadings.length - 1; i >= 0; i--) {
      if (ids.has(mockReadings[i].id)) mockReadings.splice(i, 1);
    }
    return { count: before - mockReadings.length };
  },
  async groupBy(args: { by: ["status"]; where?: { meter?: { room?: { zoneId?: string } } } }) {
    let list = mockReadings;
    const zoneId = args.where?.meter?.room?.zoneId;
    if (zoneId) list = list.filter((r) => readingMatchesZone(r, zoneId));
    const counts = new Map<string, number>();
    for (const r of list) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      _count: { _all: count },
    }));
  },
};

// ---- readingImage ----

const readingImage = {
  async create(args: { data: { readingId: string; path: string } }) {
    const row = { id: newId("readingImage"), readingId: args.data.readingId, path: args.data.path, createdAt: new Date() };
    mockReadingImages.push(row);
    return row;
  },
  async findMany(args: { where: { readingId: { in: string[] } }; select?: { path: true } }) {
    const ids = new Set(args.where.readingId.in);
    return mockReadingImages.filter((img) => ids.has(img.readingId));
  },
  async deleteMany(args: { where: { readingId: { in: string[] } } }) {
    const ids = new Set(args.where.readingId.in);
    const before = mockReadingImages.length;
    for (let i = mockReadingImages.length - 1; i >= 0; i--) {
      if (ids.has(mockReadingImages[i].readingId)) mockReadingImages.splice(i, 1);
    }
    return { count: before - mockReadingImages.length };
  },
};

// ---- syncLog ----

const syncLog = {
  async deleteMany(args: { where: { readingId: { in: string[] } } }) {
    const ids = new Set(args.where.readingId.in);
    const before = mockSyncLogs.length;
    for (let i = mockSyncLogs.length - 1; i >= 0; i--) {
      if (ids.has(mockSyncLogs[i].readingId)) mockSyncLogs.splice(i, 1);
    }
    return { count: before - mockSyncLogs.length };
  },
};

// ---- billingConfig ----

interface BillingConfigCreateData {
  id: string;
  ftRate: number;
  taxRatePercent: number;
  baseCharge: number;
  tiers: unknown;
  documentPath?: string | null;
  documentName?: string | null;
}

// Real Prisma's `update` only overwrites the fields you pass — everything
// else on the row stays as-is. Modeled properly here (merge onto the
// existing row) rather than reconstructing the whole row from `update`
// alone, so a document-only upsert (src/lib/billing/billingConfigServer.ts's
// saveBillingConfigDocument()) can never accidentally null out
// ftRate/taxRatePercent/baseCharge/tiers, and vice versa.
interface BillingConfigUpdateData {
  ftRate?: number;
  taxRatePercent?: number;
  baseCharge?: number;
  tiers?: unknown;
  documentPath?: string | null;
  documentName?: string | null;
}

const billingConfig = {
  async findUnique() {
    return mockBillingConfig;
  },
  async create(args: { data: BillingConfigCreateData }) {
    const row: MockBillingConfigRow = {
      id: args.data.id,
      ftRate: args.data.ftRate,
      taxRatePercent: args.data.taxRatePercent,
      baseCharge: args.data.baseCharge,
      tiers: args.data.tiers as MockBillingConfigRow["tiers"],
      documentPath: args.data.documentPath ?? null,
      documentName: args.data.documentName ?? null,
      updatedAt: new Date(),
    };
    setMockBillingConfig(row);
    return row;
  },
  async upsert(args: {
    where: { id: string };
    create: BillingConfigCreateData;
    update: BillingConfigUpdateData;
  }) {
    if (!mockBillingConfig) {
      const row: MockBillingConfigRow = {
        id: args.create.id,
        ftRate: args.create.ftRate,
        taxRatePercent: args.create.taxRatePercent,
        baseCharge: args.create.baseCharge,
        tiers: args.create.tiers as MockBillingConfigRow["tiers"],
        documentPath: args.create.documentPath ?? null,
        documentName: args.create.documentName ?? null,
        updatedAt: new Date(),
      };
      setMockBillingConfig(row);
      return row;
    }
    const u = args.update;
    const row: MockBillingConfigRow = {
      ...mockBillingConfig,
      ...(u.ftRate !== undefined ? { ftRate: u.ftRate } : {}),
      ...(u.taxRatePercent !== undefined ? { taxRatePercent: u.taxRatePercent } : {}),
      ...(u.baseCharge !== undefined ? { baseCharge: u.baseCharge } : {}),
      ...(u.tiers !== undefined ? { tiers: u.tiers as MockBillingConfigRow["tiers"] } : {}),
      ...(u.documentPath !== undefined ? { documentPath: u.documentPath } : {}),
      ...(u.documentName !== undefined ? { documentName: u.documentName } : {}),
      updatedAt: new Date(),
    };
    setMockBillingConfig(row);
    return row;
  },
};

// ---- ftRate / ftRateHistory / ftDocument ----
// (2026-09-17) Monthly Ft rate + append-only audit history + supporting
// documents. Mirrors exactly what src/lib/billing/ftService.ts and
// src/lib/billing/ftResolver.ts actually call — not a generic Prisma
// engine, same posture as every other model above.

function ftRateCreator(row: MockFtRate): MockUser {
  const u = mockUsers.find((x) => x.id === row.createdBy);
  if (!u) throw new Error(`mock data inconsistency: ftRate ${row.id} has no creator`);
  return u;
}

function ftDocumentsFor(ftRateId: string) {
  return mockFtDocuments
    .filter((d) => d.ftRateId === ftRateId)
    .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
    .map((d) => ({ ...d, uploader: mockUsers.find((u) => u.id === d.uploadedBy)! }));
}

function withFtRateRelations(row: MockFtRate) {
  return { ...row, creator: ftRateCreator(row), documents: ftDocumentsFor(row.id) };
}

interface FtRateFindArgs {
  where?: { id?: string; readingMonth?: Date; status?: MockFtStatus };
}

const ftRate = {
  async findFirst(args: FtRateFindArgs) {
    let list = mockFtRates;
    const where = args.where;
    if (where?.id) list = list.filter((r) => r.id === where.id);
    if (where?.readingMonth) list = list.filter((r) => sameMonth(r.readingMonth, where.readingMonth!));
    if (where?.status) list = list.filter((r) => r.status === where.status);
    const match = list[0];
    return match ? withFtRateRelations(match) : null;
  },
  async findUnique(args: { where: { id: string } }) {
    const row = mockFtRates.find((r) => r.id === args.where.id);
    return row ? withFtRateRelations(row) : null;
  },
  async findUniqueOrThrow(args: { where: { id: string } }) {
    const row = mockFtRates.find((r) => r.id === args.where.id);
    if (!row) throw notFoundError();
    return withFtRateRelations(row);
  },
  async findMany(args?: { orderBy?: { readingMonth?: "asc" | "desc" } }) {
    const list = [...mockFtRates];
    if (args?.orderBy?.readingMonth) {
      const dir = args.orderBy.readingMonth === "desc" ? -1 : 1;
      list.sort((a, b) => dir * (a.readingMonth.getTime() - b.readingMonth.getTime()));
    }
    return list.map(withFtRateRelations);
  },
  async create(args: {
    data: { readingMonth: Date; ftRate: number; notes: string | null; createdBy: string };
  }) {
    if (mockFtRates.some((r) => sameMonth(r.readingMonth, args.data.readingMonth))) {
      throw uniqueConstraintError("Unique constraint failed on FtRate.readingMonth");
    }
    const row: MockFtRate = {
      id: newId("ftRate"),
      readingMonth: args.data.readingMonth,
      ftRate: args.data.ftRate,
      status: "ACTIVE",
      notes: args.data.notes,
      createdBy: args.data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFtRates.push(row);
    return row;
  },
  async update(args: {
    where: { id: string };
    data: { ftRate?: number; notes?: string | null; status?: MockFtStatus };
  }) {
    const row = mockFtRates.find((r) => r.id === args.where.id);
    if (!row) throw notFoundError();
    if (args.data.ftRate !== undefined) row.ftRate = args.data.ftRate;
    if (args.data.notes !== undefined) row.notes = args.data.notes;
    if (args.data.status !== undefined) row.status = args.data.status;
    row.updatedAt = new Date();
    return row;
  },
};

const ftRateHistory = {
  async create(args: {
    data: {
      ftRateId: string;
      readingMonth: Date;
      action: MockFtHistoryAction;
      oldValue: number | null;
      newValue: number | null;
      reason: string | null;
      performedBy: string;
    };
  }) {
    const row: MockFtRateHistory = {
      id: newId("ftRateHistory"),
      ftRateId: args.data.ftRateId,
      readingMonth: args.data.readingMonth,
      action: args.data.action,
      oldValue: args.data.oldValue,
      newValue: args.data.newValue,
      reason: args.data.reason,
      performedBy: args.data.performedBy,
      performedAt: new Date(),
    };
    mockFtRateHistory.push(row);
    return row;
  },
  async findMany(args: { where: { ftRateId: string }; orderBy?: { performedAt?: "asc" | "desc" } }) {
    let list = mockFtRateHistory.filter((h) => h.ftRateId === args.where.ftRateId);
    if (args.orderBy?.performedAt) {
      const dir = args.orderBy.performedAt === "desc" ? -1 : 1;
      list = [...list].sort((a, b) => dir * (a.performedAt.getTime() - b.performedAt.getTime()));
    }
    return list.map((h) => ({ ...h, performer: mockUsers.find((u) => u.id === h.performedBy)! }));
  },
};

const ftDocument = {
  async create(args: {
    data: {
      ftRateId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
      uploadedBy: string;
    };
  }) {
    const row: MockFtDocument = {
      id: newId("ftDocument"),
      ftRateId: args.data.ftRateId,
      originalName: args.data.originalName,
      mimeType: args.data.mimeType,
      sizeBytes: args.data.sizeBytes,
      storagePath: args.data.storagePath,
      uploadedBy: args.data.uploadedBy,
      uploadedAt: new Date(),
    };
    mockFtDocuments.push(row);
    return row;
  },
  async findUnique(args: { where: { id: string } }) {
    return mockFtDocuments.find((d) => d.id === args.where.id) ?? null;
  },
  async delete(args: { where: { id: string } }) {
    const index = mockFtDocuments.findIndex((d) => d.id === args.where.id);
    if (index === -1) throw notFoundError();
    return mockFtDocuments.splice(index, 1)[0];
  },
};

// ---- root client ----
// $transaction just invokes the callback with this same client — every
// mutation here is a synchronous in-memory array operation, so there is no
// real isolation/rollback semantics to provide (and nothing in this
// codebase relies on partial-transaction rollback behavior specifically).

interface MockPrismaModels {
  zone: typeof zone;
  room: typeof room;
  meter: typeof meter;
  user: typeof user;
  reading: typeof reading;
  readingImage: typeof readingImage;
  syncLog: typeof syncLog;
  billingConfig: typeof billingConfig;
  ftRate: typeof ftRate;
  ftRateHistory: typeof ftRateHistory;
  ftDocument: typeof ftDocument;
}

type MockPrismaClient = MockPrismaModels & {
  $transaction<T>(fn: (tx: MockPrismaClient) => Promise<T>): Promise<T>;
};

const models: MockPrismaModels = {
  zone,
  room,
  meter,
  user,
  reading,
  readingImage,
  syncLog,
  billingConfig,
  ftRate,
  ftRateHistory,
  ftDocument,
};

export const mockPrismaClient: MockPrismaClient = {
  ...models,
  async $transaction<T>(fn: (tx: MockPrismaClient) => Promise<T>): Promise<T> {
    return fn(mockPrismaClient);
  },
};
