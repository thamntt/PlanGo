import { describe, it, expect } from "vitest";
import { AppError, errors } from "../errors";

describe("AppError", () => {
  it("maps ErrorCode to standard HTTP status", () => {
    const err = new AppError("TRIP_NOT_FOUND", "x");
    expect(err.status).toBe(404);
    expect(err.code).toBe("TRIP_NOT_FOUND");
  });

  it("accepts a numeric status (legacy) and picks a representative code", () => {
    const err = new AppError(403, "x");
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("preserves details payload", () => {
    const err = new AppError("VALIDATION_ERROR", "x", { field: "value" });
    expect(err.details).toEqual({ field: "value" });
  });

  it("factory shortcuts produce correct codes", () => {
    expect(errors.notFound("Trip").code).toBe("RESOURCE_NOT_FOUND");
    expect(errors.unauthorized().status).toBe(401);
    expect(errors.forbidden().status).toBe(403);
    expect(errors.rateLimited().status).toBe(429);
  });
});
