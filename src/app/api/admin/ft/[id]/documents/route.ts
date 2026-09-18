import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getFtById } from "@/lib/billing/ftService";
import { prisma } from "@/lib/db/prisma";

// Supporting announcement document(s) for one month's Ft (2026-09-17) —
// same public/upload/doc/ convention + server-side MIME/size validation as
// the existing src/app/api/admin/billing-config/document/route.ts, just
// allowing many files per FtRate instead of one slot. Filenames are always
// server-generated (never derived from the client's original filename), so
// there is no path-traversal surface from user input.
const UPLOAD_DIR = path.join(process.cwd(), "public", "upload", "doc");
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  const { id } = await params;
  const ftRate = await prisma.ftRate.findUnique({ where: { id } });
  if (!ftRate) return apiError(404, "NOT_FOUND", "ไม่พบข้อมูล Ft นี้");

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
  // Server-side MIME check only — never trust the client-declared type
  // alone beyond this whitelist lookup.
  const ext = ALLOWED_EXTENSIONS[file.type];
  if (!ext) {
    return apiError(400, "VALIDATION_ERROR", "รองรับเฉพาะไฟล์ PDF, JPG, PNG, WEBP เท่านั้น");
  }
  if (file.size > MAX_SIZE_BYTES) {
    return apiError(400, "VALIDATION_ERROR", "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)");
  }

  const filename = `ft_${id}_${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  const publicPath = `/upload/doc/${filename}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, bytes);
  } catch {
    return apiError(500, "INTERNAL_ERROR", "อัปโหลดไฟล์ไม่สำเร็จ");
  }

  // A failed metadata write must not leave an orphan file behind, and must
  // not leave the FtRate looking like it has a document it doesn't.
  try {
    await prisma.ftDocument.create({
      data: {
        ftRateId: id,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath: publicPath,
        uploadedBy: auth.adminId,
      },
    });
  } catch {
    await unlink(filePath).catch(() => {});
    return apiError(500, "INTERNAL_ERROR", "บันทึกข้อมูลไฟล์ไม่สำเร็จ");
  }

  const updated = await getFtById(id);
  return NextResponse.json({ ok: true, data: updated });
}
