export interface ResidentRoomRef {
  id: string;
  name: string;
  zoneName: string;
}

export interface ResidentSession {
  id: string;
  name: string;
  email: string;
  room: ResidentRoomRef | null;
}

// A pickable room in the self-service room picker — same shape as
// ResidentRoomRef plus zoneId (needed to group the picker's options).
export interface RoomOption {
  id: string;
  name: string;
  zoneId: string;
  zoneName: string;
}

export interface ResidentBilling {
  baseCharge: number | null;
  ft: number | null;
  tax: number | null;
  total: number | null;
}

export interface ResidentReadingDTO {
  id: string;
  meterCode: string;
  period: string; // "MM/BBBB", e.g. "01/2569"
  readingMonth: string; // "YYYY-MM"
  previousValue: number | null;
  currentValue: number | null;
  usage: number | null;
  status: string;
  billing: ResidentBilling;
}

export interface ResidentHistoryDTO {
  room: ResidentRoomRef | null;
  readings: ResidentReadingDTO[];
}
