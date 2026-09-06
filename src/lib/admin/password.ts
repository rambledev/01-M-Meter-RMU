import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Salted scrypt hash via Node's built-in crypto — no extra dependency for
// something this project doesn't otherwise need. Stored as
// "<saltHex>:<hashHex>" in User.passwordHash. Never store or return the
// plaintext password anywhere past this function.
const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Used by the checker login route (2026-09-06) — re-derives the hash with
// the stored salt and compares with a constant-time comparison so failed
// attempts can't be timed to learn anything about the real hash.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(hashHex, "hex");
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}
