import type { MeterInfo } from "./types";

const QR_PREFIX = "METER:";

// Strips the "METER:" QR prefix if present, so a raw meter code and a scanned
// QR payload both resolve the same way (src/components/QrScanner.tsx feeds
// its decoded string straight into lookupMeter(), no change needed here).
export function parseMeterScanPayload(payload: string): string {
  const trimmed = payload.trim();
  return trimmed.toUpperCase().startsWith(QR_PREFIX)
    ? trimmed.slice(QR_PREFIX.length).trim()
    : trimmed;
}

export function findMeterByCode(meters: MeterInfo[], code: string): MeterInfo | undefined {
  const normalized = code.trim().toUpperCase();
  return meters.find((meter) => meter.code.toUpperCase() === normalized);
}

export function findMeterById(meters: MeterInfo[], id: string): MeterInfo | undefined {
  return meters.find((meter) => meter.id === id);
}

export function lookupMeter(meters: MeterInfo[], payload: string): MeterInfo | undefined {
  return findMeterByCode(meters, parseMeterScanPayload(payload));
}
