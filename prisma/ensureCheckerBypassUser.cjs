// Field Calibration testing convenience (2026-09-14) — upserts a fixed
// METER_READER test account "checker-01" so CheckerAuthGate's env-var
// bypass (NEXT_PUBLIC_CHECKER_BYPASS_USERNAME/NEXT_PUBLIC_CHECKER_BYPASS_PASSWORD,
// see src/components/checker/CheckerAuthGate.tsx) has a real account to
// log in as against whichever database DATABASE_URL points to. Idempotent
// — safe to run more than once, updates in place if the account already
// exists. Same one-off-script convention as seedReadings.cjs; delete the
// account manually (or via Admin's user management UI) once it's no
// longer needed for testing.
//
// The password is NEVER hardcoded here (this script is committed to git —
// a hardcoded password would leak a real account's credential into repo
// history). Pass one explicitly, or let this generate a random one and
// print it once:
//
//   CHECKER_BYPASS_SEED_PASSWORD='your-password' node prisma/ensureCheckerBypassUser.cjs
//   node prisma/ensureCheckerBypassUser.cjs                    # random password, printed once

const { PrismaClient } = require("@prisma/client");
const { randomBytes, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");

// Mirrors src/lib/admin/password.ts exactly (salted scrypt, "<saltHex>:<hashHex>")
// so the real login route's verifyPassword() accepts it — reimplemented here
// rather than imported since this is a plain .cjs script, not compiled TS.
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

const USERNAME = "checker-01";
const PASSWORD = process.env.CHECKER_BYPASS_SEED_PASSWORD || randomBytes(9).toString("base64url");
const NAME = "ผู้จดมิเตอร์ทดสอบ (checker-01)";

const prisma = new PrismaClient();

async function main() {
  const zones = await prisma.zone.findMany({ select: { id: true, name: true } });
  if (zones.length === 0) {
    console.error("ไม่พบ Zone ใดๆ ในฐานข้อมูล — รัน prisma/seed.cjs ก่อน");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(PASSWORD);
  const zoneConnect = zones.map((z) => ({ id: z.id }));
  const existing = await prisma.user.findUnique({ where: { username: USERNAME } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: NAME,
        passwordHash,
        role: "METER_READER",
        responsibleZones: { set: zoneConnect },
      },
    });
    console.log(`อัปเดตบัญชี "${USERNAME}" แล้ว (id=${existing.id}) — ${zones.length} โซน: ${zones.map((z) => z.name).join(", ")}`);
  } else {
    const created = await prisma.user.create({
      data: {
        name: NAME,
        username: USERNAME,
        passwordHash,
        role: "METER_READER",
        responsibleZones: { connect: zoneConnect },
      },
    });
    console.log(`สร้างบัญชี "${USERNAME}" แล้ว (id=${created.id}) — ${zones.length} โซน: ${zones.map((z) => z.name).join(", ")}`);
  }
  console.log(`Username: ${USERNAME}`);
  console.log(`Password: ${PASSWORD}`);
  console.log("(เก็บรหัสนี้ไว้เอง — สคริปต์นี้ไม่บันทึกรหัสไว้ที่ไหนอีก ใส่ลง .env's NEXT_PUBLIC_CHECKER_BYPASS_PASSWORD เอง)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
