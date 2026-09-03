import { demoMeters, type DemoMeter } from "./demoData";

export type { DemoMeter };

const QR_PREFIX = "METER:";

// Strips the "METER:" QR prefix if present, so a raw meter code and a scanned
// QR payload both resolve the same way. Phase 4 swaps in a real camera
// scanner by feeding its decoded string straight into lookupMeter() —
// no change needed here.
export function parseMeterScanPayload(payload: string): string {
  const trimmed = payload.trim();
  return trimmed.toUpperCase().startsWith(QR_PREFIX)
    ? trimmed.slice(QR_PREFIX.length).trim()
    : trimmed;
}

export function findMeterByCode(code: string): DemoMeter | undefined {
  const normalized = code.trim().toUpperCase();
  return demoMeters.find((meter) => meter.code.toUpperCase() === normalized);
}

export function findMeterById(id: string): DemoMeter | undefined {
  return demoMeters.find((meter) => meter.id === id);
}

export function lookupMeter(payload: string): DemoMeter | undefined {
  return findMeterByCode(parseMeterScanPayload(payload));
}
