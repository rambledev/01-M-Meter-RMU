-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "_UserResponsibleZones" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserResponsibleZones_AB_unique" ON "_UserResponsibleZones"("A", "B");

-- CreateIndex
CREATE INDEX "_UserResponsibleZones_B_index" ON "_UserResponsibleZones"("B");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "_UserResponsibleZones" ADD CONSTRAINT "_UserResponsibleZones_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserResponsibleZones" ADD CONSTRAINT "_UserResponsibleZones_B_fkey" FOREIGN KEY ("B") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

