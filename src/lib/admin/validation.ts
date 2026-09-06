import type { RoleValue } from "./types";

// Pure validation only — no DB/network here, so these are unit-testable
// independently of the API routes that call them.

export function validateRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Empty string is valid here (residentName is optional) — only reject the
// wrong type or a value that's whitespace-only-but-present, normalizing to
// null either way so the DB stores a clean nullable field.
export function validateOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const VALID_ROLES: readonly RoleValue[] = [
  "ADMIN",
  "METER_READER",
  "RESIDENT",
];

export function isValidRole(value: unknown): value is RoleValue {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);
}

// An absent/missing field means "no zones assigned" (valid, empty list) —
// only reject a value that's present but not an array of strings.
export function validateZoneIds(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string")) return null;
  return value;
}
