import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin/apiResponse";
import { prisma } from "@/lib/db/prisma";

// Lets a logged-in resident pick which room is theirs, ONCE (2026-09-10) —
// self-service only for the very first login, since there was no existing
// data linking a resident's email to a room. Once a room is linked, only
// an Admin can change it (src/app/api/admin/users/[id] — UserManagement's
// room dropdown) — a resident can never re-pick their own room afterwards,
// which would otherwise let them browse any other room's data at will
// (multiple different residents/emails can still point to the same room
// by explicit request — roommates — no exclusivity check on that front).
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  if (!userId || !roomId) {
    return apiError(400, "VALIDATION_ERROR", "ข้อมูลไม่ครบถ้วน");
  }

  const [user, room] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.room.findUnique({ where: { id: roomId } }),
  ]);
  if (!user || user.role !== "RESIDENT") {
    return apiError(404, "NOT_FOUND", "ไม่พบผู้ใช้งาน");
  }
  if (user.residentRoomId) {
    return apiError(403, "VALIDATION_ERROR", "เปลี่ยนห้องเองไม่ได้ กรุณาติดต่อผู้ดูแลระบบ");
  }
  if (!room) {
    return apiError(400, "VALIDATION_ERROR", "ไม่พบห้องที่เลือก");
  }

  await prisma.user.update({ where: { id: userId }, data: { residentRoom: { connect: { id: roomId } } } });

  const zone = await prisma.zone.findUnique({ where: { id: room.zoneId } });
  return NextResponse.json({
    ok: true,
    data: { room: { id: room.id, name: room.name, zoneName: zone?.name ?? "" } },
  });
}
