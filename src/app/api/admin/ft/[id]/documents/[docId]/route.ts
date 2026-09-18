import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getFtById } from "@/lib/billing/ftService";
import { prisma } from "@/lib/db/prisma";

function absoluteFromPublicPath(publicPath: string): string {
  return path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

// DELETE /api/admin/ft/:id/documents/:docId — Admin เท่านั้น ลบเอกสารหนึ่งไฟล์
// ของเดือนนี้ (ลบทั้ง metadata และไฟล์จริงบนดิสก์ ไม่กระทบ FtRate/ประวัติ Ft).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message);

  const { id, docId } = await params;
  const doc = await prisma.ftDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.ftRateId !== id) {
    return apiError(404, "NOT_FOUND", "ไม่พบเอกสารนี้");
  }

  await prisma.ftDocument.delete({ where: { id: docId } });
  await unlink(absoluteFromPublicPath(doc.storagePath)).catch(() => {});

  const updated = await getFtById(id);
  return NextResponse.json({ ok: true, data: updated });
}
