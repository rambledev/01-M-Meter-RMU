// Real Meter/Room/Zone info, fetched from PostgreSQL (GET /api/meters) —
// replaces the static demo list that used to live in demoData.ts (Phase 3
// scope note: "Replace this with a real Meter/Room/Zone lookup once the API
// exists"). Flat shape (roomName/zoneName instead of nested room.zone.name)
// to match what the API returns directly, no client-side reshaping needed.
export interface MeterInfo {
  id: string;
  code: string;
  roomId: string;
  roomName: string;
  zoneId: string;
  zoneName: string;
}
