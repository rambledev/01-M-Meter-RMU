import type { BillingConfig } from "@/lib/billing/types";
import { calculateBilling } from "./calculation";

export interface ExportRow {
  seq: number;
  roomName: string;
  residentName: string;
  currentValue: number | null;
  previousValue: number | null;
  usage: number | null;
  baseCharge: number | null;
  ftCharge: number | null;
  tax: number | null;
  total: number | null;
}

// Shape needed from a Prisma `Reading` (with its Meter -> Room include) to
// build one export row. Decimal fields come in as Prisma.Decimal | null;
// accept anything Number()-coercible so callers don't need to import
// @prisma/client's Decimal type here.
export interface ReadingForExport {
  confirmedValue: unknown;
  previousReading: unknown;
  meter: {
    room: {
      name: string;
      residentName: string | null;
    };
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Row mapping calls the Calculation Service for every derived value —
// no usage/billing math happens inline here (Phase 6 spec item 5), and the
// billing rates always come from the caller's config (Phase 6B), never
// hard-coded here.
export function mapReadingToRow(
  reading: ReadingForExport,
  seq: number,
  config: BillingConfig,
): ExportRow {
  const confirmedValue = toNumberOrNull(reading.confirmedValue);
  const previousReading = toNumberOrNull(reading.previousReading);
  const billing = calculateBilling(confirmedValue, previousReading, config);

  return {
    seq,
    roomName: reading.meter.room.name,
    residentName: reading.meter.room.residentName ?? "",
    currentValue: confirmedValue,
    previousValue: previousReading,
    usage: billing.usage,
    baseCharge: billing.baseCharge,
    ftCharge: billing.ft,
    tax: billing.tax,
    total: billing.total,
  };
}
