import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { FtDocumentDTO, FtHistoryEntryDTO, FtRateDTO } from "@/lib/admin/types";

// Decimal fields come back as Prisma.Decimal | null on the real client, or
// a plain number when MOCK_DATA=true (src/lib/db/mockPrisma.ts) — accept
// anything Number()-coercible rather than importing/relying on
// Prisma.Decimal's own .toNumber(), matching the convention already
// established by src/lib/export/mapReadingToRow.ts.
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Ft (ค่า Ft) CRUD + append-only audit history (2026-09-17). Every mutation
// here writes its FtRate change and its FtRateHistory row in the SAME
// prisma.$transaction — if the history insert fails, the FtRate change
// rolls back with it, so a Ft value can never change without a matching
// audit entry (implementation decision, confirmed). Uses the callback form
// of $transaction (not the array form) so this also works against
// src/lib/db/mockPrisma.ts when MOCK_DATA=true.

export class DuplicateFtMonthError extends Error {
  constructor() {
    super("มี Ft ของเดือนนี้อยู่แล้ว");
    this.name = "DuplicateFtMonthError";
  }
}

export class FtRateNotFoundError extends Error {
  constructor() {
    super("ไม่พบข้อมูล Ft นี้");
    this.name = "FtRateNotFoundError";
  }
}

const FT_RATE_INCLUDE = {
  creator: true,
  documents: { include: { uploader: true }, orderBy: { uploadedAt: "asc" as const } },
} satisfies Prisma.FtRateInclude;

type FtRateWithRelations = Prisma.FtRateGetPayload<{ include: typeof FT_RATE_INCLUDE }>;

function toDocumentDTO(
  doc: FtRateWithRelations["documents"][number],
): FtDocumentDTO {
  return {
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    storagePath: doc.storagePath,
    uploadedByName: doc.uploader.name,
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

function toFtRateDTO(row: FtRateWithRelations): FtRateDTO {
  return {
    id: row.id,
    readingMonth: row.readingMonth.toISOString().slice(0, 10),
    ftRate: Number(row.ftRate),
    status: row.status,
    notes: row.notes,
    createdByName: row.creator.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    documents: row.documents.map(toDocumentDTO),
  };
}

export function toHistoryDTO(entry: {
  id: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  performedAt: Date;
  performer: { name: string };
}): FtHistoryEntryDTO {
  return {
    id: entry.id,
    action: entry.action as FtHistoryEntryDTO["action"],
    oldValue: toNumberOrNull(entry.oldValue),
    newValue: toNumberOrNull(entry.newValue),
    reason: entry.reason,
    performedByName: entry.performer.name,
    performedAt: entry.performedAt.toISOString(),
  };
}

export async function getFtById(id: string): Promise<FtRateDTO | null> {
  const row = await prisma.ftRate.findUnique({ where: { id }, include: FT_RATE_INCLUDE });
  return row ? toFtRateDTO(row) : null;
}

export async function getFtByMonth(readingMonth: Date): Promise<FtRateDTO | null> {
  const row = await prisma.ftRate.findFirst({
    where: { readingMonth },
    include: FT_RATE_INCLUDE,
  });
  return row ? toFtRateDTO(row) : null;
}

export async function listFtRates(): Promise<FtRateDTO[]> {
  const rows = await prisma.ftRate.findMany({
    include: FT_RATE_INCLUDE,
    orderBy: { readingMonth: "desc" },
  });
  return rows.map(toFtRateDTO);
}

export async function getFtHistory(ftRateId: string): Promise<FtHistoryEntryDTO[]> {
  const rows = await prisma.ftRateHistory.findMany({
    where: { ftRateId },
    include: { performer: true },
    orderBy: { performedAt: "asc" },
  });
  return rows.map(toHistoryDTO);
}

export interface CreateFtInput {
  readingMonth: Date;
  ftRate: number;
  notes: string | null;
  createdBy: string;
}

export async function createFtRate(input: CreateFtInput): Promise<FtRateDTO> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.ftRate.findFirst({ where: { readingMonth: input.readingMonth } });
    if (existing) throw new DuplicateFtMonthError();

    const created = await tx.ftRate.create({
      data: {
        readingMonth: input.readingMonth,
        ftRate: input.ftRate,
        notes: input.notes,
        createdBy: input.createdBy,
      },
    });
    await tx.ftRateHistory.create({
      data: {
        ftRateId: created.id,
        readingMonth: created.readingMonth,
        action: "CREATE",
        oldValue: null,
        newValue: created.ftRate,
        reason: input.notes,
        performedBy: input.createdBy,
      },
    });

    const withRelations = await tx.ftRate.findUniqueOrThrow({
      where: { id: created.id },
      include: FT_RATE_INCLUDE,
    });
    return toFtRateDTO(withRelations);
  });
}

export interface UpdateFtInput {
  ftRate: number;
  notes: string | null;
  performedBy: string;
}

export async function updateFtRate(id: string, input: UpdateFtInput): Promise<FtRateDTO> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.ftRate.findUnique({ where: { id } });
    if (!existing) throw new FtRateNotFoundError();

    const updated = await tx.ftRate.update({
      where: { id },
      data: { ftRate: input.ftRate, notes: input.notes },
    });
    await tx.ftRateHistory.create({
      data: {
        ftRateId: id,
        readingMonth: existing.readingMonth,
        action: "UPDATE",
        oldValue: existing.ftRate,
        newValue: updated.ftRate,
        reason: input.notes,
        performedBy: input.performedBy,
      },
    });

    const withRelations = await tx.ftRate.findUniqueOrThrow({
      where: { id },
      include: FT_RATE_INCLUDE,
    });
    return toFtRateDTO(withRelations);
  });
}

// DISABLE/ENABLE change status only, never the rate value itself — history
// records oldValue === newValue (both the unchanged current rate) so it
// reads distinctly from an UPDATE (where they differ) while still showing
// what the rate was at the time of the status change.
async function setFtStatus(
  id: string,
  status: "ACTIVE" | "DISABLED",
  action: "ENABLE" | "DISABLE",
  performedBy: string,
  reason: string | null,
): Promise<FtRateDTO> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.ftRate.findUnique({ where: { id } });
    if (!existing) throw new FtRateNotFoundError();

    await tx.ftRate.update({ where: { id }, data: { status } });
    await tx.ftRateHistory.create({
      data: {
        ftRateId: id,
        readingMonth: existing.readingMonth,
        action,
        oldValue: existing.ftRate,
        newValue: existing.ftRate,
        reason,
        performedBy,
      },
    });

    const withRelations = await tx.ftRate.findUniqueOrThrow({
      where: { id },
      include: FT_RATE_INCLUDE,
    });
    return toFtRateDTO(withRelations);
  });
}

export function disableFtRate(
  id: string,
  performedBy: string,
  reason: string | null,
): Promise<FtRateDTO> {
  return setFtStatus(id, "DISABLED", "DISABLE", performedBy, reason);
}

export function enableFtRate(
  id: string,
  performedBy: string,
  reason: string | null,
): Promise<FtRateDTO> {
  return setFtStatus(id, "ACTIVE", "ENABLE", performedBy, reason);
}
