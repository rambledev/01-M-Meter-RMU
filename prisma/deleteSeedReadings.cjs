// Companion to prisma/seedReadings.cjs — deletes exactly the Reading rows
// that script created (by id, from prisma/seedReadings.output.json), and
// nothing else, so real data added through the app in the meantime is
// never touched. Deletes each Reading's ReadingImage/SyncLog rows first
// (same ordered-delete pattern as src/lib/admin/cascadeDelete.ts), even
// though seedReadings.cjs itself never creates any.

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  const manifestPath = path.join(__dirname, "seedReadings.output.json");
  if (!fs.existsSync(manifestPath)) {
    console.log(`No ${manifestPath} found — nothing to delete (already cleaned up, or seedReadings.cjs was never run).`);
    return;
  }

  const { readingIds } = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (!Array.isArray(readingIds) || readingIds.length === 0) {
    console.log("Manifest has no reading ids — nothing to delete.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.syncLog.deleteMany({ where: { readingId: { in: readingIds } } });
    await tx.readingImage.deleteMany({ where: { readingId: { in: readingIds } } });
    return tx.reading.deleteMany({ where: { id: { in: readingIds } } });
  });

  console.log(`Deleted ${result.count} of ${readingIds.length} seeded readings.`);
  fs.unlinkSync(manifestPath);
  console.log(`Removed ${manifestPath}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
