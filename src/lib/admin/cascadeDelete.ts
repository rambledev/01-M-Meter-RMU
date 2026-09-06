import { unlink } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// By explicit request: deleting a Zone or Room from the admin UI must work
// even when real data (Rooms/Meters/Reading history) hangs off it — unlike
// Meter/User deletion, which still refuse when dependents exist. Everything
// under the deleted Zone/Room (Meter -> Reading -> ReadingImage/SyncLog) is
// permanently removed. This is intentionally destructive; the client is
// responsible for warning the user with the affected counts before calling
// deleteZone()/deleteRoom() (src/lib/admin/adminApi.ts).

const PUBLIC_DIR = path.join(process.cwd(), "public");

async function deleteImageFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((p) => unlink(path.join(PUBLIC_DIR, p)).catch(() => {})),
  );
}

type TxClient = Prisma.TransactionClient;

// Deletes every Meter (and each Meter's Reading/ReadingImage/SyncLog) under
// the given rooms, then the rooms themselves — all within the caller's
// transaction. Returns the ReadingImage paths so the caller can unlink the
// actual files AFTER the transaction commits: the DB is the source of
// truth, so a file that briefly outlives its row is fine, but deleting a
// file whose DB row then fails to commit would not be.
async function deleteRoomsCascade(tx: TxClient, roomIds: string[]): Promise<string[]> {
  if (roomIds.length === 0) return [];

  const meters = await tx.meter.findMany({
    where: { roomId: { in: roomIds } },
    select: { id: true },
  });
  const meterIds = meters.map((m) => m.id);

  let imagePaths: string[] = [];
  if (meterIds.length > 0) {
    const readings = await tx.reading.findMany({
      where: { meterId: { in: meterIds } },
      select: { id: true },
    });
    const readingIds = readings.map((r) => r.id);

    if (readingIds.length > 0) {
      const images = await tx.readingImage.findMany({
        where: { readingId: { in: readingIds } },
        select: { path: true },
      });
      imagePaths = images.map((i) => i.path);

      await tx.syncLog.deleteMany({ where: { readingId: { in: readingIds } } });
      await tx.readingImage.deleteMany({ where: { readingId: { in: readingIds } } });
      await tx.reading.deleteMany({ where: { id: { in: readingIds } } });
    }

    await tx.meter.deleteMany({ where: { id: { in: meterIds } } });
  }

  await tx.room.deleteMany({ where: { id: { in: roomIds } } });
  return imagePaths;
}

export async function cascadeDeleteZone(zoneId: string): Promise<void> {
  const imagePaths = await prisma.$transaction(async (tx) => {
    const rooms = await tx.room.findMany({ where: { zoneId }, select: { id: true } });
    const paths = await deleteRoomsCascade(tx, rooms.map((r) => r.id));
    await tx.zone.delete({ where: { id: zoneId } });
    return paths;
  });
  await deleteImageFiles(imagePaths);
}

export async function cascadeDeleteRoom(roomId: string): Promise<void> {
  const imagePaths = await prisma.$transaction((tx) => deleteRoomsCascade(tx, [roomId]));
  await deleteImageFiles(imagePaths);
}
