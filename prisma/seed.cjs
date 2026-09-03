// Minimal reference-data seed — Zone/Room/Meter/User only, matching
// src/lib/meters/demoData.ts exactly (same ids). No Reading rows.
//
// Required for Phase 5 (Sync): the sync API validates that the Meter and
// User referenced by a Reading actually exist server-side (foreign keys),
// but the demo data used by the Phase 3 UI only ever existed as a static
// client-side module — this seed makes it exist in PostgreSQL too, once.
// Approved explicitly by the user before running (see decision-log.md).
//
// Safe to re-run: every write is an upsert keyed by the same fixed ids.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const zoneA = await prisma.zone.upsert({
    where: { id: "zone-a" },
    update: {},
    create: { id: "zone-a", name: "Zone A" },
  });
  const zoneB = await prisma.zone.upsert({
    where: { id: "zone-b" },
    update: {},
    create: { id: "zone-b", name: "Zone B" },
  });

  const room101 = await prisma.room.upsert({
    where: { id: "room-101" },
    update: {},
    create: { id: "room-101", name: "ห้อง 101", zoneId: zoneA.id },
  });
  const room102 = await prisma.room.upsert({
    where: { id: "room-102" },
    update: {},
    create: { id: "room-102", name: "ห้อง 102", zoneId: zoneA.id },
  });
  const room201 = await prisma.room.upsert({
    where: { id: "room-201" },
    update: {},
    create: { id: "room-201", name: "ห้อง 201", zoneId: zoneB.id },
  });

  await prisma.meter.upsert({
    where: { id: "ME-001" },
    update: {},
    create: { id: "ME-001", code: "ME-001", roomId: room101.id },
  });
  await prisma.meter.upsert({
    where: { id: "ME-002" },
    update: {},
    create: { id: "ME-002", code: "ME-002", roomId: room102.id },
  });
  await prisma.meter.upsert({
    where: { id: "ME-003" },
    update: {},
    create: { id: "ME-003", code: "ME-003", roomId: room201.id },
  });

  await prisma.user.upsert({
    where: { id: "demo-user-1" },
    update: {},
    create: { id: "demo-user-1", name: "ผู้จดมิเตอร์ (Demo)", role: "METER_READER" },
  });

  console.log("Seed complete: 2 zones, 3 rooms, 3 meters, 1 user");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
