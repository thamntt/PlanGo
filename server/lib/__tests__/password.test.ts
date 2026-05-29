import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isBcryptHash } from "../password";

describe("password", () => {
  it("hashes plaintext into a bcrypt hash", async () => {
    const hash = await hashPassword("hello123");
    expect(isBcryptHash(hash)).toBe(true);
    expect(hash).not.toEqual("hello123");
  });

  it("verifies a correct plaintext against its hash", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects a wrong plaintext against a hash", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("accepts legacy plaintext-stored passwords (matching value)", async () => {
    expect(await verifyPassword("legacy", "legacy")).toBe(true);
    expect(await verifyPassword("legacy", "other")).toBe(false);
  });

  it("isBcryptHash distinguishes hashed vs plaintext", () => {
    expect(isBcryptHash("$2b$10$abcdefghijklmnopqrstuv")).toBe(true);
    expect(isBcryptHash("plaintext")).toBe(false);
  });
});
