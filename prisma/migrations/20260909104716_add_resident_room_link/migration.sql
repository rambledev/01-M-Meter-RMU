-- AlterTable
ALTER TABLE "User" ADD COLUMN     "residentRoomId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_residentRoomId_fkey" FOREIGN KEY ("residentRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

