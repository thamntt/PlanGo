import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import { env } from "./env";
import { errors } from "./errors";

export interface JwtUserPayload extends JwtPayload {
  sub: string;        // user id (stringified)
  email: string;
  role: "user" | "admin";
}

function getSecret(): string {
  const secret = env.JWT_SECRET || env.SESSION_SECRET;
  if (!secret) throw new Error("JWT_SECRET/SESSION_SECRET not configured");
  return secret;
}

export function signJwt(payload: Omit<JwtUserPayload, "iat" | "exp">, opts: SignOptions = {}): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    ...opts,
  });
}

export function verifyJwt(token: string): JwtUserPayload {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === "string" || !decoded || typeof (decoded as any).sub !== "string") {
      throw errors.unauthorized("Invalid token payload");
    }
    return decoded as JwtUserPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw errors.unauthorized("Token expired");
    if (err instanceof jwt.JsonWebTokenError) throw errors.unauthorized("Invalid token");
    throw err;
  }
}
