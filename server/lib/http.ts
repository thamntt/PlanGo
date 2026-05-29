import type { Request, Response, NextFunction } from "express";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wrap an async handler so thrown errors propagate to the global error handler.
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Standard success response shape.
 */
export function sendResponse<T>(
  res: Response,
  status: number,
  message: string,
  data: T | null = null,
) {
  return res.status(status).json({ status, message, data });
}
