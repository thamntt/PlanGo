/**
 * Centralized error model. All thrown errors at the application layer should
 * extend AppError with a domain-specific code. The global error handler maps
 * code → HTTP status and a stable JSON shape.
 */

export type ErrorCode =
  // Generic
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED"
  | "UPSTREAM_ERROR"
  // Auth / user
  | "USER_NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "EMAIL_ALREADY_EXISTS"
  // Trip
  | "TRIP_NOT_FOUND"
  | "TRIP_COMPLETED"
  | "TRIP_NOT_OWNED"
  // Itinerary
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_RESPONSE_INVALID"
  // Share
  | "SHARE_CODE_NOT_FOUND"
  | "ALREADY_JOINED"
  // Review
  | "REVIEW_NOT_FOUND"
  // OAuth / social
  | "OAUTH_NOT_CONFIGURED"
  | "INVALID_OAUTH_TOKEN"
  | "EMAIL_PERMISSION_REQUIRED"
  // Password reset
  | "RESET_TOKEN_INVALID"
  | "RESET_TOKEN_EXPIRED"
  // Generic resource
  | "RESOURCE_NOT_FOUND";

const STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  UPSTREAM_ERROR: 502,
  USER_NOT_FOUND: 404,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 403,
  EMAIL_ALREADY_EXISTS: 409,
  TRIP_NOT_FOUND: 404,
  TRIP_COMPLETED: 400,
  TRIP_NOT_OWNED: 403,
  AI_PROVIDER_UNAVAILABLE: 501,
  AI_RESPONSE_INVALID: 502,
  SHARE_CODE_NOT_FOUND: 404,
  ALREADY_JOINED: 409,
  REVIEW_NOT_FOUND: 404,
  OAUTH_NOT_CONFIGURED: 501,
  INVALID_OAUTH_TOKEN: 401,
  EMAIL_PERMISSION_REQUIRED: 400,
  RESET_TOKEN_INVALID: 400,
  RESET_TOKEN_EXPIRED: 410,
  RESOURCE_NOT_FOUND: 404,
};

/** Reverse map: pick first ErrorCode for a given HTTP status (for legacy `new AppError(404, ...)` callers) */
const codeForStatus = (status: number): ErrorCode => {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 500:
      return "INTERNAL_ERROR";
    case 501:
      return "NOT_IMPLEMENTED";
    case 502:
      return "UPSTREAM_ERROR";
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
  }
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  /**
   * Accepts either an ErrorCode (preferred — gives stable error.code in response)
   * or an HTTP status number (legacy compat).
   */
  constructor(codeOrStatus: ErrorCode | number, message: string, details?: unknown) {
    super(message);
    if (typeof codeOrStatus === "number") {
      this.status = codeOrStatus;
      this.code = codeForStatus(codeOrStatus);
    } else {
      this.code = codeOrStatus;
      this.status = STATUS_MAP[codeOrStatus];
    }
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Convenience factories for common errors */
export const errors = {
  validation: (message: string, details?: unknown) =>
    new AppError("VALIDATION_ERROR", message, details),
  badRequest: (message: string) => new AppError("BAD_REQUEST", message),
  unauthorized: (message = "Authentication required") => new AppError("UNAUTHORIZED", message),
  forbidden: (message = "Permission denied") => new AppError("FORBIDDEN", message),
  notFound: (resource: string) => new AppError("RESOURCE_NOT_FOUND", `${resource} not found`),
  conflict: (message: string) => new AppError("CONFLICT", message),
  rateLimited: (message = "Too many requests") => new AppError("RATE_LIMITED", message),
  internal: (message = "Internal server error") => new AppError("INTERNAL_ERROR", message),
  notImplemented: (message: string) => new AppError("NOT_IMPLEMENTED", message),
  upstream: (message: string) => new AppError("UPSTREAM_ERROR", message),
};
