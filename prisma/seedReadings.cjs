// Demo-only Reading history seed (2026-09-07, generalized 2026-09-08) — NOT
// part of the base reference-data seed (prisma/seed.cjs). Generates a
// plausible reading history (increasing cumulative meter values, realistic
// monthly usage, all status SYNCED) for every Meter that currently exists
// in the database, so the checker/admin/executive screens have something
// to show in a demo instead of being empty.
//
// Usage:
//   node prisma/seedReadings.cjs              # 6 months ending at the current calendar month
//   node prisma/seedReadings.cjs 2026-07 2026-08   # exactly the given months (any count/order)
//
// previousReading for the first month seeded per meter chains from that
// meter's most recent EXISTING reading strictly before it, if any (so this
// can be run more than once, or for a month range that doesn't start at a
// meter's true first reading, without breaking the running-total chain) —
// otherwise it's treated as that meter's first-ever reading (previousReading
// null, a random starting baseline). A meter+month that already has a
// reading is skipped, never overwritten.
//
// Inserting month(s) BEFORE a reading that already exists (e.g. seeding
// June after July/August are already there) is handled too: the new
// month(s)' values are chosen so they land strictly below that existing
// reading's confirmedValue with a plausible usage gap, and that existing
// reading's own previousReading/usage are then updated to chain from the
// newly-inserted month — otherwise it would still look like July had no
// previous reading even after June was added right before it.
//
// TEMPORARY: the user creating this data has said they'll delete it again
// afterward. Every created Reading id is appended to
// prisma/seedReadings.output.json — run prisma/deleteSeedReadings.cjs
// afterward to remove exactly those rows (and nothing else) cleanly.

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const RECORDED_BY = "demo-user-1"; // always present — prisma/seed.cjs upserts it
const DEFAULT_MONTHS_BACK = 6;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 1st of the month, `monthsBack` calendar months before `from`'s month
// (0 = from's own month) — UTC, matching how readingMonth is stored
// elsewhere (data-model.md §3.1: always the 1st, no time/timezone).
function monthStartUTC(monthsBack, from) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsBack, 1));
}

function parseMonthArg(arg) {
  const match = /^(\d{4})-(\d{2})$/.exec(arg);
  if (!match) {
    throw new Error(`Invalid month "${arg}" — expected YYYY-MM, e.g. 2026-07`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month "${arg}" — month must be 01-12`);
  }
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

const MIN_USAGE = 80;
const MAX_USAGE = 250;

// Builds `count` strictly-increasing confirmedValues starting after
// `startValue` (null = pick a fresh random baseline). If `ceiling` is given
// (an already-existing reading right after this run's new months), the
// values are compressed as needed so the last one still leaves a plausible
// positive usage gap up to `ceiling` — never generated at or past it.
function buildChain(startValue, count, ceiling) {
  const values = [];
  let prev = startValue;

  if (ceiling === null) {
    for (let i = 0; i < count; i++) {
      prev = prev === null ? randomInt(1000, 5000) : prev + randomInt(MIN_USAGE, MAX_USAGE);
      values.push(prev);
    }
    return values;
  }

  // Bounded case: `count` new months plus one more implicit step to reach
  // `ceiling` itself = count + 1 segments to fit into the available gap.
  const segments = count + 1;
  if (prev === null) {
    const naiveBaseline = ceiling - segments * randomInt(MIN_USAGE, MAX_USAGE);
    prev = Math.max(1, naiveBaseline);
  }

  for (let i = 0; i < count; i++) {
    const remainingSegments = segments - i;
    const remainingGap = ceiling - prev;
    const avgStep = Math.max(1, Math.floor(remainingGap / remainingSegments));
    const jitter = Math.max(1, Math.floor(avgStep * 0.3));
    const step = Math.max(1, Math.min(remainingGap - 1, avgStep + randomInt(-jitter, jitter)));
    prev = prev + step;
    values.push(prev);
  }
  return values;
}

async function main() {
  const args = process.argv.slice(2);
  const now = new Date();

  const months = (
    args.length > 0
      ? args.map(parseMonthArg)
      : Array.from({ length: DEFAULT_MONTHS_BACK }, (_, i) =>
          monthStartUTC(DEFAULT_MONTHS_BACK - 1 - i, now),
        )
  ).sort((a, b) => a - b);

  const meters = await prisma.meter.findMany({ orderBy: { code: "asc" } });
  if (meters.length === 0) {
    console.log("No meters found — nothing to seed. Run prisma/seed.cjs or add meters via /admin first.");
    return;
  }

  const recorder = await prisma.user.findUnique({ where: { id: RECORDED_BY } });
  if (!recorder) {
    throw new Error(`recordedBy user "${RECORDED_BY}" not found — run prisma/seed.cjs first.`);
  }

  console.log(`Seeding months: ${months.map(monthKey).join(", ")}`);

  const createdIds = [];
  let skipped = 0;
  let relinked = 0;

  for (const meter of meters) {
    const earliestNewMonth = months[0];
    const latestNewMonth = months[months.length - 1];

    const priorReading = await prisma.reading.findFirst({
      where: { meterId: meter.id, readingMonth: { lt: earliestNewMonth } },
      orderBy: { readingMonth: "desc" },
    });
    // Only ever re-chain a following reading that was itself recorded by
    // this same demo user — never touch a real reading someone actually
    // recorded through the app, even if it happens to be the next one
    // chronologically.
    const nextReading = await prisma.reading.findFirst({
      where: {
        meterId: meter.id,
        readingMonth: { gt: latestNewMonth },
        recordedBy: RECORDED_BY,
      },
      orderBy: { readingMonth: "asc" },
    });

    // Months in this run that don't already have a reading, in order —
    // skip existing ones up front so buildChain() only sizes itself for
    // what will actually be created.
    const monthsToCreate = [];
    for (const readingMonth of months) {
      const existing = await prisma.reading.findUnique({
        where: { meterId_readingMonth: { meterId: meter.id, readingMonth } },
      });
      if (existing) {
        console.log(`  skip ${meter.code} ${monthKey(readingMonth)} — reading already exists`);
        skipped += 1;
      } else {
        monthsToCreate.push(readingMonth);
      }
    }
    if (monthsToCreate.length === 0) continue;

    const startValue = priorReading ? Number(priorReading.confirmedValue) : null;
    const ceiling = nextReading ? Number(nextReading.confirmedValue) : null;
    const values = buildChain(startValue, monthsToCreate.length, ceiling);

    let previousValue = startValue;
    for (let i = 0; i < monthsToCreate.length; i++) {
      const readingMonth = monthsToCreate[i];
      const confirmedValue = values[i];
      const usage = previousValue === null ? null : confirmedValue - previousValue;
      const recordedAt = new Date(
        Date.UTC(
          readingMonth.getUTCFullYear(),
          readingMonth.getUTCMonth(),
          randomInt(3, 25),
          randomInt(8, 17),
          randomInt(0, 59),
        ),
      );

      const reading = await prisma.reading.create({
        data: {
          meterId: meter.id,
          readingMonth,
          previousReading: previousValue,
          confirmedValue,
          usage,
          status: "SYNCED",
          recordedBy: RECORDED_BY,
          recordedAt,
        },
      });
      createdIds.push(reading.id);
      previousValue = confirmedValue;
    }

    // The new months now end right before nextReading — re-chain it so it
    // no longer looks like a meter's first-ever reading now that an
    // earlier one exists.
    if (nextReading) {
      await prisma.reading.update({
        where: { id: nextReading.id },
        data: {
          previousReading: previousValue,
          usage: Number(nextReading.confirmedValue) - previousValue,
        },
      });
      relinked += 1;
    }
  }

  console.log(
    `Seeded ${createdIds.length} readings across ${meters.length} meters` +
      (skipped > 0 ? ` (${skipped} meter+month already existed, skipped)` : "") +
      (relinked > 0
        ? ` — re-chained ${relinked} existing reading(s) that used to be the earliest on record`
        : "") +
      ".",
  );

  if (createdIds.length > 0) {
    const outPath = path.join(__dirname, "seedReadings.output.json");
    let manifest = { createdAt: new Date().toISOString(), readingIds: [] };
    if (fs.existsSync(outPath)) {
      try {
        const prior = JSON.parse(fs.readFileSync(outPath, "utf-8"));
        if (Array.isArray(prior.readingIds)) manifest.readingIds = prior.readingIds;
      } catch {
        // Corrupt/unexpected existing file — start the manifest fresh
        // rather than fail the whole seed run over it.
      }
    }
    manifest.readingIds.push(...createdIds);
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
    console.log(
      `Reading ids written to ${outPath} (${manifest.readingIds.length} total tracked) — run "node prisma/deleteSeedReadings.cjs" to remove all seeded demo data later.`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
