import type { Request, Response, NextFunction } from "express";
import { verifyJwt, type JwtUserPayload } from "../lib/jwt";
import { errors } from "../lib/errors";
import { storage } from "../storage";

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: "user" | "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.header("authorization") || req.header("Authorization");
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  const queryToken = req.query.token;
  if (typeof queryToken === "string" && queryToken) return queryToken;
  return null;
}

function payloadToUser(p: JwtUserPayload): AuthenticatedUser {
  return { id: Number(p.sub), email: p.email, role: p.role };
}

/**
 * Optional auth: attaches req.auth if a valid token is present; otherwise continues.
 * Use this on routes that have different behavior for logged-in vs anonymous users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.auth = payloadToUser(verifyJwt(token));
  } catch {
    // Invalid token — treat as anonymous
  }
  next();
}

/** Require a valid token. Throws 401 if missing/invalid. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(errors.unauthorized());
  try {
    req.auth = payloadToUser(verifyJwt(token));
    next();
  } catch (err) {
    next(err);
  }
}

/** Require admin role (implies requireAuth). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(errors.unauthorized());
  try {
    const user = payloadToUser(verifyJwt(token));
    if (user.role !== "admin") return next(errors.forbidden("Admin only"));
    req.auth = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require the authenticated user owns the trip in `:id` or `:tripId`.
 * Admins always pass.
 */
export async function requireTripOwner(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw errors.unauthorized();
    const user = payloadToUser(verifyJwt(token));
    req.auth = user;

    if (user.role === "admin") return next();

    const tripIdParam = req.params.id || req.params.tripId;
    const tripId = Number(tripIdParam);
    if (isNaN(tripId)) throw errors.badRequest("Invalid trip ID");

    const trip = await storage.getTrip(tripId);
    if (!trip) throw errors.notFound("Trip");
    if (trip.ownerId !== user.id) throw errors.forbidden("Not the trip owner");

    next();
  } catch (err) {
    next(err);
  }
}
