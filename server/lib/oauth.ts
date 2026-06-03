import { OAuth2Client } from "google-auth-library";
import { env } from "./env";
import { logger } from "./logger";
import { AppError } from "./errors";

/**
 * Verify an OAuth provider's ID token and return canonical user profile.
 * Each provider has its own verification path: Google uses signed JWT against
 * Google's JWKS; Facebook calls Graph API; Apple uses its own JWKS.
 */

export interface OAuthProfile {
  provider: "google" | "facebook" | "apple";
  providerUserId: string; // stable subject id from provider
  email: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

// ─── Google ───
// FE uses different Client IDs per platform (Web, iOS, Android). BE accepts any.
const googleClient = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string): Promise<OAuthProfile> {
  const audiences = [
    env.GOOGLE_OAUTH_CLIENT_ID_WEB,
    env.GOOGLE_OAUTH_CLIENT_ID_IOS,
    env.GOOGLE_OAUTH_CLIENT_ID_ANDROID,
  ].filter((v): v is string => !!v);

  if (audiences.length === 0) {
    throw new AppError(
      "OAUTH_NOT_CONFIGURED",
      "Google OAuth chưa được cấu hình. Set GOOGLE_OAUTH_CLIENT_ID_* trong .env.",
    );
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new AppError("INVALID_OAUTH_TOKEN", "Google token không hợp lệ");
    }

    return {
      provider: "google",
      providerUserId: payload.sub,
      email: payload.email.toLowerCase(),
      fullName: payload.name,
      avatarUrl: payload.picture,
      emailVerified: payload.email_verified === true,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn({ err }, "Google token verification failed");
    throw new AppError("INVALID_OAUTH_TOKEN", "Google token verification failed");
  }
}

// ─── Facebook ───
// Verify token via Graph API debug endpoint + fetch profile.

export async function verifyFacebookAccessToken(accessToken: string): Promise<OAuthProfile> {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
    throw new AppError(
      "OAUTH_NOT_CONFIGURED",
      "Facebook OAuth chưa được cấu hình. Set FACEBOOK_APP_ID + FACEBOOK_APP_SECRET trong .env.",
    );
  }

  const appAccessToken = `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;

  // 1. Debug token to verify it's issued by our app and not expired
  const debugRes = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
      accessToken,
    )}&access_token=${encodeURIComponent(appAccessToken)}`,
  );
  if (!debugRes.ok) throw new AppError("INVALID_OAUTH_TOKEN", "Facebook token debug failed");
  const debugJson = (await debugRes.json()) as {
    data?: { app_id?: string; is_valid?: boolean; user_id?: string; expires_at?: number };
  };
  const debugData = debugJson.data;
  if (!debugData?.is_valid) {
    throw new AppError("INVALID_OAUTH_TOKEN", "Facebook token không hợp lệ hoặc đã hết hạn");
  }
  if (debugData.app_id !== env.FACEBOOK_APP_ID) {
    throw new AppError("INVALID_OAUTH_TOKEN", "Facebook token không thuộc app này");
  }

  // 2. Fetch profile
  const profileRes = await fetch(
    `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
      accessToken,
    )}`,
  );
  if (!profileRes.ok) throw new AppError("INVALID_OAUTH_TOKEN", "Facebook profile fetch failed");
  const profile = (await profileRes.json()) as {
    id: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
  };

  if (!profile.email) {
    throw new AppError(
      "EMAIL_PERMISSION_REQUIRED",
      "Cần quyền truy cập email từ Facebook. Vui lòng cấp quyền email khi đăng nhập.",
    );
  }

  return {
    provider: "facebook",
    providerUserId: profile.id,
    email: profile.email.toLowerCase(),
    fullName: profile.name,
    avatarUrl: profile.picture?.data?.url,
    emailVerified: true, // Facebook only returns email if verified
  };
}

// ─── Apple ───
// Apple ID token is a signed JWT. We verify using Apple's JWKS.

import jwt, { type JwtHeader } from "jsonwebtoken";

interface AppleKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

let cachedKeys: { keys: AppleKey[]; fetchedAt: number } | null = null;

async function getAppleKeys(): Promise<AppleKey[]> {
  // Cache JWKS for 1 hour
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < 60 * 60 * 1000) {
    return cachedKeys.keys;
  }
  const res = await fetch("https://appleid.apple.com/auth/keys");
  if (!res.ok) throw new AppError("INVALID_OAUTH_TOKEN", "Apple JWKS fetch failed");
  const data = (await res.json()) as { keys: AppleKey[] };
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function jwkToPem(jwk: AppleKey): string {
  // Convert RSA JWK to PEM (minimal). Could use jwk-to-pem package but keep deps small.
  const modulus = Buffer.from(jwk.n, "base64url");
  const exponent = Buffer.from(jwk.e, "base64url");

  // ASN.1 DER encoding of RSAPublicKey
  function encodeLength(len: number): Buffer {
    if (len < 128) return Buffer.from([len]);
    const bytes: number[] = [];
    while (len > 0) {
      bytes.unshift(len & 0xff);
      len >>= 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }

  function encodeInt(buf: Buffer): Buffer {
    let b = buf;
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
    return Buffer.concat([Buffer.from([0x02]), encodeLength(b.length), b]);
  }

  const seq = Buffer.concat([encodeInt(modulus), encodeInt(exponent)]);
  const rsaPub = Buffer.concat([Buffer.from([0x30]), encodeLength(seq.length), seq]);
  const algId = Buffer.from(
    "300d06092a864886f70d0101010500", // RSA OID + NULL
    "hex",
  );
  const bitString = Buffer.concat([Buffer.from([0x00]), rsaPub]);
  const spki = Buffer.concat([
    Buffer.from([0x30]),
    encodeLength(algId.length + 1 + encodeLength(bitString.length).length + bitString.length),
    algId,
    Buffer.from([0x03]),
    encodeLength(bitString.length),
    bitString,
  ]);
  const pem =
    "-----BEGIN PUBLIC KEY-----\n" +
    spki.toString("base64").match(/.{1,64}/g)!.join("\n") +
    "\n-----END PUBLIC KEY-----";
  return pem;
}

export async function verifyAppleIdToken(idToken: string): Promise<OAuthProfile> {
  if (!env.APPLE_BUNDLE_ID && !env.APPLE_SERVICE_ID) {
    throw new AppError(
      "OAUTH_NOT_CONFIGURED",
      "Apple OAuth chưa được cấu hình. Set APPLE_BUNDLE_ID (mobile) hoặc APPLE_SERVICE_ID (web).",
    );
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string") {
    throw new AppError("INVALID_OAUTH_TOKEN", "Apple token decode failed");
  }
  const header = decoded.header as JwtHeader & { kid?: string };
  if (!header.kid) throw new AppError("INVALID_OAUTH_TOKEN", "Apple token missing kid");

  const keys = await getAppleKeys();
  const key = keys.find((k) => k.kid === header.kid);
  if (!key) throw new AppError("INVALID_OAUTH_TOKEN", "Apple key not found");

  const pem = jwkToPem(key);
  const expectedAudiences = [env.APPLE_BUNDLE_ID, env.APPLE_SERVICE_ID].filter(
    (v): v is string => !!v,
  );

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(idToken, pem, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com",
      audience: expectedAudiences as string[],
    } as jwt.VerifyOptions) as jwt.JwtPayload;
  } catch (err) {
    logger.warn({ err }, "Apple token verification failed");
    throw new AppError("INVALID_OAUTH_TOKEN", "Apple token không hợp lệ");
  }

  if (!payload.sub || typeof payload.sub !== "string" || !payload.email) {
    throw new AppError("INVALID_OAUTH_TOKEN", "Apple token thiếu sub/email");
  }

  return {
    provider: "apple",
    providerUserId: payload.sub,
    email: (payload.email as string).toLowerCase(),
    fullName: undefined, // Apple chỉ trả tên 1 lần ở first signup (FE phải gửi kèm)
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}
