// Demo data only — there is no API or seed workflow yet (Phase 3 scope).
// Replace this with a real Meter/Room/Zone lookup once the API exists.

export interface DemoZone {
  id: string;
  name: string;
}

export interface DemoRoom {
  id: string;
  name: string;
  zone: DemoZone;
}

export interface DemoMeter {
  id: string;
  code: string;
  room: DemoRoom;
}

const zoneA: DemoZone = { id: "zone-a", name: "Zone A" };
const zoneB: DemoZone = { id: "zone-b", name: "Zone B" };

const room101: DemoRoom = { id: "room-101", name: "ห้อง 101", zone: zoneA };
const room102: DemoRoom = { id: "room-102", name: "ห้อง 102", zone: zoneA };
const room201: DemoRoom = { id: "room-201", name: "ห้อง 201", zone: zoneB };

export const demoMeters: DemoMeter[] = [
  { id: "ME-001", code: "ME-001", room: room101 },
  { id: "ME-002", code: "ME-002", room: room102 },
  { id: "ME-003", code: "ME-003", room: room201 },
];

// Single hardcoded demo user — no auth in this phase (see decision-log.md).
export const demoUser = {
  id: "demo-user-1",
  name: "ผู้จดมิเตอร์ (Demo)",
};

export function resolveRecorderName(recordedBy: string): string {
  return recordedBy === demoUser.id ? demoUser.name : recordedBy;
}
