import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, Response } from "express";
import { isTest } from "../lib/env";

/** Identify the caller by JWT subject if available, otherwise by IP (IPv6-safe). */
function authKey(req: Request, res: Response): string {
  const auth = req.auth;
  if (auth) return `user:${auth.id}`;
  return ipKeyGenerator(req.ip ?? "anon");
}

const baseConfig: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Disable rate limit during tests so they don't flake
  skip: () => isTest,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests",
    });
  },
};

/** Tight limit for auth endpoints to throttle brute-force attempts. */
export const authLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => `auth:${ipKeyGenerator(req.ip ?? "anon")}`,
});

/** Expensive AI generation: 10/hour per authenticated user (or IP). */
export const aiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 60_000,
  limit: 10,
  keyGenerator: authKey,
});

/** External places API proxy: 60/min per caller. */
export const placesLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60_000,
  limit: 60,
  keyGenerator: authKey,
});
