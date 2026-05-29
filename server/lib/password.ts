import bcrypt from "bcrypt";
import { env } from "./env";

/** Bcrypt-hash a plaintext password */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against either a bcrypt hash OR a legacy plaintext
 * value (so existing users created before the bcrypt migration can still log in).
 * Detected via the canonical bcrypt prefix.
 */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) return bcrypt.compare(plain, stored);
  // Legacy plaintext — accept exact match, caller should re-hash on success.
  return plain === stored;
}
