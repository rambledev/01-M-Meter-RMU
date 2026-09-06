import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("returns a salt:hash string, never the plaintext password itself", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(hash).not.toContain("hunter2");
  });

  it("produces a different hash each time (random salt) even for the same password", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password against its own hash", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("hunter2", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("hunter2", "")).toBe(false);
  });
});
