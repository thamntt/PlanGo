/**
 * Legacy compatibility re-exports. New code should import from `server/lib/*` directly.
 */
export { AppError, errors } from "../lib/errors";
export { asyncHandler, sendResponse } from "../lib/http";
