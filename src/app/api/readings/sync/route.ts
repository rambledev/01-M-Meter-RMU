import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// MVP sync endpoint (Phase 5) — no auth, no background/worker sync, no retry
// algorithm here (that lives client-side in src/lib/sync/syncService.ts).
// Server steps follow the Phase 5 spec exactly:
//   1. validate payload  2. check Meter  3. check User  4. check readingMonth
//   5. check duplicate   6. create Reading  7. save image  8. create ReadingImage

const UPLOAD_DIR = path.join(process.cwd(), "public", "upload", "meter");

interface SyncErrorBody {
  ok: false;
  error:
    | "VALIDATION_ERROR"
    | "METER_NOT_FOUND"
    | "USER_NOT_FOUND"
    | "DUPLICATE"
    | "IMAGE_UPLOAD_FAILED"
    | "INTERNAL_ERROR";
  message: string;
  existing?: {
    confirmedValue: number | null;
    recordedBy: string;
    recordedAt: string | null;
  };
}

function errorResponse(
  status: number,
  error: SyncErrorBody["error"],
  message: string,
  existing?: SyncErrorBody["existing"],
) {
  const body: SyncErrorBody = { ok: false, error, message, ...(existing ? { existing } : {}) };
  return NextResponse.json(body, { status });
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg"; // default — matches the compressed JPEG the client always sends
}

// {MeterID}m{MM}_{YYYY}.{ext} — MM/YYYY from readingMonth, never the upload
// date (data-model.md §3.2). Server is the only one that builds this name.
function buildImageFilename(
  meterCode: string,
  readingMonth: Date,
  mimeType: string,
): string {
  const mm = String(readingMonth.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = readingMonth.getUTCFullYear();
  const ext = extensionForMimeType(mimeType);
  return `${meterCode}m${mm}_${yyyy}.${ext}`;
}

interface ReadingPayload {
  localId: string;
  meterId: string;
  readingMonth: string;
  previousReading?: number | null;
  ocrValue?: string | null;
  confirmedValue: number;
  usage?: number | null;
  recordedBy: string;
  recordedAt: string;
}

function validatePayload(value: unknown): ReadingPayload | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.localId !== "string" ||
    typeof v.meterId !== "string" ||
    typeof v.readingMonth !== "string" ||
    typeof v.recordedBy !== "string" ||
    typeof v.recordedAt !== "string" ||
    typeof v.confirmedValue !== "number" ||
    Number.isNaN(v.confirmedValue)
  ) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.readingMonth)) return null;
  return {
    localId: v.localId,
    meterId: v.meterId,
    readingMonth: v.readingMonth,
    previousReading:
      typeof v.previousReading === "number" ? v.previousReading : null,
    ocrValue: typeof v.ocrValue === "string" ? v.ocrValue : null,
    confirmedValue: v.confirmedValue,
    usage: typeof v.usage === "number" ? v.usage : null,
    recordedBy: v.recordedBy,
    recordedAt: v.recordedAt,
  };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "รูปแบบคำขอไม่ถูกต้อง");
  }

  const readingRaw = formData.get("reading");
  const imageFile = formData.get("image");

  if (typeof readingRaw !== "string") {
    return errorResponse(400, "VALIDATION_ERROR", "ไม่พบข้อมูล reading");
  }
  if (!(imageFile instanceof File)) {
    return errorResponse(400, "VALIDATION_ERROR", "ไม่พบไฟล์ภาพต้นฉบับ");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readingRaw);
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "ข้อมูล reading ไม่ใช่ JSON ที่ถูกต้อง");
  }

  const payload = validatePayload(parsed);
  if (!payload) {
    return errorResponse(400, "VALIDATION_ERROR", "ข้อมูล reading ไม่ครบหรือไม่ถูกต้อง");
  }

  const meter = await prisma.meter.findUnique({ where: { id: payload.meterId } });
  if (!meter) {
    return errorResponse(404, "METER_NOT_FOUND", "ไม่พบมิเตอร์นี้ในระบบ");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.recordedBy } });
  if (!user) {
    return errorResponse(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
  }

  const readingMonth = new Date(`${payload.readingMonth}T00:00:00.000Z`);
  if (Number.isNaN(readingMonth.getTime())) {
    return errorResponse(400, "VALIDATION_ERROR", "รูปแบบเดือนไม่ถูกต้อง");
  }

  const existing = await prisma.reading.findUnique({
    where: {
      meterId_readingMonth: { meterId: payload.meterId, readingMonth },
    },
  });
  if (existing) {
    return errorResponse(
      409,
      "DUPLICATE",
      "รายการนี้ถูกบันทึกเข้าสู่ระบบแล้ว",
      {
        confirmedValue: existing.confirmedValue
          ? Number(existing.confirmedValue)
          : null,
        recordedBy: existing.recordedBy,
        recordedAt: existing.recordedAt?.toISOString() ?? null,
      },
    );
  }

  let reading;
  try {
    reading = await prisma.reading.create({
      data: {
        meterId: payload.meterId,
        readingMonth,
        previousReading: payload.previousReading ?? undefined,
        ocrValue: payload.ocrValue ?? undefined,
        confirmedValue: payload.confirmedValue,
        usage: payload.usage ?? undefined,
        status: "SYNCED",
        recordedBy: payload.recordedBy,
        recordedAt: new Date(payload.recordedAt),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Race: another sync created the same meter+month between our check and
      // our insert — the DB unique constraint is the real source of truth.
      return errorResponse(409, "DUPLICATE", "รายการนี้ถูกบันทึกเข้าสู่ระบบแล้ว");
    }
    return errorResponse(500, "INTERNAL_ERROR", "บันทึก Reading ไม่สำเร็จ");
  }

  // Reading now exists in the DB — from here on, any failure must clean up
  // that row rather than leave an image-less Reading behind silently
  // (Phase 5 spec item 4).
  const filename = buildImageFilename(meter.code, readingMonth, imageFile.type);
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await imageFile.arrayBuffer());
    await writeFile(filePath, bytes);
  } catch {
    await prisma.reading.delete({ where: { id: reading.id } }).catch(() => {});
    return errorResponse(500, "IMAGE_UPLOAD_FAILED", "บันทึกภาพต้นฉบับไม่สำเร็จ");
  }

  try {
    await prisma.readingImage.create({
      data: {
        readingId: reading.id,
        path: `/upload/meter/${filename}`,
      },
    });
  } catch {
    await unlink(filePath).catch(() => {});
    await prisma.reading.delete({ where: { id: reading.id } }).catch(() => {});
    return errorResponse(500, "IMAGE_UPLOAD_FAILED", "บันทึกข้อมูลภาพไม่สำเร็จ");
  }

  return NextResponse.json(
    {
      ok: true,
      reading: {
        id: reading.id,
        meterId: reading.meterId,
        readingMonth: payload.readingMonth,
        status: "SYNCED",
        path: `/upload/meter/${filename}`,
      },
    },
    { status: 201 },
  );
}
