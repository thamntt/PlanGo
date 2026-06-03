import { randomBytes } from "node:crypto";
import { storage } from "../../storage";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { env } from "../../lib/env";
import { signJwt } from "../../lib/jwt";
import { hashPassword } from "../../lib/password";
import { sendEmail, resetPasswordEmail } from "../../lib/email";
import {
  verifyGoogleIdToken,
  verifyFacebookAccessToken,
  verifyAppleIdToken,
  type OAuthProfile,
} from "../../lib/oauth";

// ══════════════════════════════════════════════════════════════
// Social login: find-or-create user, issue JWT
// ══════════════════════════════════════════════════════════════

export interface SocialLoginInput {
  provider: "google" | "facebook" | "apple";
  idToken?: string;
  accessToken?: string;
  /** Apple only: user object passed on first signup (Apple returns name only once) */
  fullName?: string;
}

export async function socialLogin(input: SocialLoginInput) {
  let profile: OAuthProfile;

  switch (input.provider) {
    case "google":
      if (!input.idToken) throw new AppError("BAD_REQUEST", "Google idToken required");
      profile = await verifyGoogleIdToken(input.idToken);
      break;
    case "facebook":
      if (!input.accessToken)
        throw new AppError("BAD_REQUEST", "Facebook accessToken required");
      profile = await verifyFacebookAccessToken(input.accessToken);
      break;
    case "apple":
      if (!input.idToken) throw new AppError("BAD_REQUEST", "Apple idToken required");
      profile = await verifyAppleIdToken(input.idToken);
      // Apple returns name only on first auth — accept from FE if provider didn't include it
      if (!profile.fullName && input.fullName) profile.fullName = input.fullName;
      break;
    default:
      throw new AppError("BAD_REQUEST", "Unknown provider");
  }

  // Find by provider + providerUserId first (canonical identity)
  let user = await storage.getUserByProviderIdentity(profile.provider, profile.providerUserId);

  // Fallback: find by email (account linking — same email, different provider OR email/password account)
  if (!user) {
    user = await storage.getUserByEmail(profile.email);
    if (user) {
      // Link this social identity to the existing email account
      logger.info(
        { userId: user.userId, provider: profile.provider },
        "Linking social identity to existing user",
      );
      await storage.updateUser(user.userId, {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        avatarUrl: profile.avatarUrl ?? user.avatarUrl,
        emailVerified: profile.emailVerified ?? user.emailVerified,
      });
      // Re-fetch to get updated row
      user = await storage.getUser(user.userId);
    }
  }

  // Create new user if no match
  if (!user) {
    logger.info({ provider: profile.provider, email: profile.email }, "Creating new social user");
    user = await storage.createUser({
      userName: profile.fullName || profile.email.split("@")[0],
      email: profile.email,
      password: null, // social-only, no password
      role: "user",
      status: "active",
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      avatarUrl: profile.avatarUrl,
      emailVerified: profile.emailVerified ?? false,
    } as any);
  }

  if (!user) throw new AppError("INTERNAL_ERROR", "Failed to create or fetch user");

  if (user.status === "banned" || user.status === "inactive" || user.status === "locked") {
    throw new AppError("ACCOUNT_LOCKED", "Tài khoản đã bị khoá");
  }
  if (user.role === "admin") {
    throw new AppError(
      "FORBIDDEN",
      "Tài khoản admin phải đăng nhập qua admin portal, không dùng social login.",
    );
  }

  const role = (user.role === "admin" ? "admin" : "user") as "admin" | "user";
  const token = signJwt({ sub: String(user.userId), email: user.email, role });
  const { password: _pw, ...sanitized } = user;
  return { ...sanitized, token };
}

// ══════════════════════════════════════════════════════════════
// Forgot password: generate token, email reset link
// ══════════════════════════════════════════════════════════════

export async function forgotPassword(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const user = await storage.getUserByEmail(normalized);

  // Always return success regardless to prevent email enumeration.
  // But only actually send email when user exists + has a password (social-only users handled differently).
  if (!user) {
    logger.info({ email: normalized }, "forgotPassword: user not found (silent success)");
    return;
  }

  if (!user.password) {
    // Social-only account — send a different email guiding them
    logger.info(
      { userId: user.userId, provider: user.provider },
      "forgotPassword: social-only account",
    );
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await storage.updateUser(user.userId, {
    resetToken: token,
    resetTokenExpiresAt: expiresAt,
  });

  const resetLink = `${env.APP_URL}/reset-password?token=${token}`;
  const { subject, html } = resetPasswordEmail({ fullName: user.userName, resetLink });

  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    // Already logged in email lib; don't leak to user
    logger.error({ err, userId: user.userId }, "Failed to send reset email");
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || token.length < 32) {
    throw new AppError("RESET_TOKEN_INVALID", "Token không hợp lệ");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new AppError("VALIDATION_ERROR", "Mật khẩu phải có ít nhất 6 ký tự");
  }

  const user = await storage.getUserByResetToken(token);
  if (!user) throw new AppError("RESET_TOKEN_INVALID", "Token không hợp lệ");

  if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt).getTime() < Date.now()) {
    throw new AppError("RESET_TOKEN_EXPIRED", "Token đã hết hạn. Vui lòng yêu cầu link mới.");
  }

  const newHash = await hashPassword(newPassword);
  await storage.updateUser(user.userId, {
    password: newHash,
    resetToken: null,
    resetTokenExpiresAt: null,
  });

  logger.info({ userId: user.userId }, "Password reset successful");
}
