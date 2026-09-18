import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { saveBillingConfigDocument } from "@/lib/billing/billingConfigServer";
import { prisma } from "@/lib/db/prisma";

// Evidence document for the current billing rate settings (2026-09-16,
// tab "ตั้งค่าค่าไฟ") — same public/upload/<subfolder> convention as meter
// reading photos (src/app/api/readings/sync/route.ts), just a different
// subfolder. Only ever one file at a time: uploading a new one replaces
// (and deletes) the previous one; this is display/audit documentation
// only, never read by billing calculation (src/lib/billing/breakdown.ts).
const UPLOAD_DIR = path.join(process.cwd(), "public", "upload", "doc");
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const SINGLETON_ID = "singleton";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function currentDocumentPath(): Promise<string | null> {
  const row = await prisma.billingConfig.findUnique({
    where: { id: SINGLETON_ID },
    select: { documentPath: true },
  });
  return row?.documentPath ?? null;
}

// `publicPath` is always "/upload/doc/<filename>" (leading slash) — strip
// it before joining so path.join doesn't treat it as absolute.
function absoluteFromPublicPath(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "รูปแบบคำขอไม่ถูกต้อง");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบไฟล์ที่อัปโหลด");
  }
  const ext = ALLOWED_EXTENSIONS[file.type];
  if (!ext) {
    return apiError(400, "VALIDATION_ERROR", "รองรับเฉพาะไฟล์ PDF, JPG, PNG, WEBP เท่านั้น");
  }
  if (file.size > MAX_SIZE_BYTES) {
    return apiError(400, "VALIDATION_ERROR", "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)");
  }

  const filename = `evidence_${Date.now()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  const publicPath = `/upload/doc/${filename}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, bytes);
  } catch {
    return apiError(500, "INTERNAL_ERROR", "อัปโหลดไฟล์ไม่สำเร็จ");
  }

  const previousPath = await currentDocumentPath();

  let updated;
  try {
    updated = await saveBillingConfigDocument(publicPath, file.name);
  } catch {
    await unlink(filePath).catch(() => {});
    return apiError(500, "INTERNAL_ERROR", "บันทึกข้อมูลไฟล์ไม่สำเร็จ");
  }

  // Only remove the old file once the new one is confirmed saved in the DB.
  if (previousPath) {
    await unlink(absoluteFromPublicPath(previousPath)).catch(() => {});
  }

  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE() {
  const previousPath = await currentDocumentPath();
  const updated = await saveBillingConfigDocument(null, null);
  if (previousPath) {
    await unlink(absoluteFromPublicPath(previousPath)).catch(() => {});
  }
  return NextResponse.json({ ok: true, data: updated });
}
