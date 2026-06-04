import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { AppError } from "../lib/errors";

interface ValidateSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Returns an Express middleware that validates `req.body`, `req.query`, and `req.params`
 * against the provided Zod schemas. On success, replaces the source with the parsed
 * (and possibly transformed) value. On failure, throws AppError("VALIDATION_ERROR").
 */
export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          return next(
            new AppError("VALIDATION_ERROR", "Invalid request body", result.error.flatten()),
          );
        }
        req.body = result.data;
      }
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          return next(
            new AppError("VALIDATION_ERROR", "Invalid query params", result.error.flatten()),
          );
        }
        // Don't reassign req.query — Express 5 makes it read-only; instead stash on res.locals
        (req as any).validatedQuery = result.data;
      }
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          return next(
            new AppError("VALIDATION_ERROR", "Invalid path params", result.error.flatten()),
          );
        }
        (req as any).validatedParams = result.data;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Common reusable param schema for numeric :id */
export const numericIdParam = z.object({
  id: z.string().regex(/^\d+$/, "Must be a positive integer").transform(Number),
});

export const numericTripIdParam = z.object({
  tripId: z.string().regex(/^\d+$/).transform(Number),
});

export const numericDayIdParam = z.object({
  dayId: z.string().regex(/^\d+$/).transform(Number),
});
