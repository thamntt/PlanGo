import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../jwt";

describe("jwt", () => {
  it("signs and verifies a payload round-trip", () => {
    const token = signJwt({ sub: "42", email: "u@example.com", role: "user" });
    const decoded = verifyJwt(token);
    expect(decoded.sub).toBe("42");
    expect(decoded.email).toBe("u@example.com");
    expect(decoded.role).toBe("user");
  });

  it("rejects a tampered token", () => {
    const token = signJwt({ sub: "1", email: "a@b.c", role: "user" });
    const tampered = token.slice(0, -2) + "AA";
    expect(() => verifyJwt(tampered)).toThrow();
  });

  it("rejects an expired token", () => {
    const token = signJwt({ sub: "1", email: "a@b.c", role: "user" }, { expiresIn: -1 });
    expect(() => verifyJwt(token)).toThrow(/expired/i);
  });
});
