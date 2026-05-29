import type { Request, Response, NextFunction } from "express";
import { errors } from "../lib/errors";

/**
 * Catch unmatched /api/* routes and forward to the error handler with
 * a standardized 404. Non-/api paths fall through (handled by static / SPA).
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  if (req.path.startsWith("/api/")) {
    return next(errors.notFound(`Endpoint ${req.method} ${req.path}`));
  }
  next();
}
