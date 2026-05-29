import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import { isProd } from "../lib/env";

interface ErrorResponse {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) return next(err);

  const requestId = (req as any).id as string | undefined;
  const log = (req as any).log ?? logger;

  let body: ErrorResponse;

  if (err instanceof AppError) {
    body = {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    };
    log.warn({ err, code: err.code }, `AppError: ${err.message}`);
  } else if (err instanceof ZodError) {
    body = {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: err.flatten(),
      requestId,
    };
    log.warn({ err }, "ZodError");
  } else if (err instanceof Error) {
    body = {
      status: 500,
      code: "INTERNAL_ERROR",
      message: isProd ? "Internal server error" : err.message,
      requestId,
    };
    log.error({ err }, `Unhandled error: ${err.message}`);
  } else {
    body = {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId,
    };
    log.error({ err }, "Unknown error type thrown");
  }

  res.status(body.status).json(body);
}
