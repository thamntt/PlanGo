import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors, AppError } from "../../lib/errors";
import { hashPassword, verifyPassword, isBcryptHash } from "../../lib/password";
import { signJwt } from "../../lib/jwt";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { authLimiter } from "../../middlewares/rate-limit";
import { logger } from "../../lib/logger";
import { socialLogin, forgotPassword, resetPassword } from "./service";
import { validate } from "../../middlewares/validate";
import { z } from "zod";

const socialLoginSchema = z.object({
  provider: z.enum(["google", "facebook", "apple"]),
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  fullName: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(6).max(100),
});

async function socialLoginHandler(req: Request, res: Response) {
  const result = await socialLogin(req.body);
  sendResponse(res, 200, "Social login successful", result);
}

async function forgotPasswordHandler(req: Request, res: Response) {
  await forgotPassword(req.body.email);
  sendResponse(res, 200, "Nếu email tồn tại, link đặt lại đã được gửi", null);
}

async function resetPasswordHandler(req: Request, res: Response) {
  const { token, newPassword } = req.body;
  await resetPassword(token, newPassword);
  sendResponse(res, 200, "Mật khẩu đã được đặt lại", null);
}

async function listUsers(req: Request, res: Response) {
  const search = req.query.search as string | undefined;
  const users = await storage.getUsers(search);
  // Never leak passwords
  const sanitized = users.map(({ password: _pw, ...u }) => u);
  sendResponse(res, 200, "Users retrieved successfully", sanitized);
}

async function getUserById(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) throw errors.badRequest("Invalid user ID");
  const user = await storage.getUser(id);
  if (!user) throw errors.notFound("User");
  const { password: _pw, ...sanitized } = user;
  sendResponse(res, 200, "User retrieved successfully", sanitized);
}

async function createUser(req: Request, res: Response) {
  const body = { ...req.body };
  if (body.password) body.password = await hashPassword(body.password);
  const user = await storage.createUser(body);
  const { password: _pw, ...sanitized } = user;
  sendResponse(res, 201, "User created successfully", sanitized);
}

async function updateUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) throw errors.badRequest("Invalid user ID");

  const updateData: Record<string, any> = {};
  const body = req.body;
  if (body.userName !== undefined) updateData.userName = body.userName;
  if (body.fullName !== undefined) updateData.userName = body.fullName;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.password !== undefined && body.password !== "") {
    updateData.password = await hashPassword(body.password);
  }
  if (body.role !== undefined) updateData.role = body.role;

  if (body.isLocked !== undefined) {
    updateData.status = body.isLocked ? "locked" : "active";
  } else if (body.status !== undefined) {
    updateData.status = body.status;
  }

  const user = await storage.updateUser(id, updateData);
  if (!user) throw errors.notFound("User");
  const { password: _pw, ...sanitized } = user;
  sendResponse(res, 200, "User updated successfully", sanitized);
}

async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) throw errors.badRequest("Invalid user ID");
  const ok = await storage.deleteUser(id);
  if (!ok) throw errors.notFound("User");
  sendResponse(res, 200, "User deleted successfully", null);
}

async function login(req: Request, res: Response) {
  const { email, username, password } = req.body;
  const identifier = (email || username || "").toLowerCase().trim();
  if (!identifier || !password) throw new AppError("BAD_REQUEST", "Email or username and password are required");

  let user = await storage.getUserByEmail(identifier);
  if (!user) user = await storage.getUserByUsername(identifier);

  if (!user) throw new AppError("INVALID_CREDENTIALS", "Invalid credentials");
  if (user.status === "banned" || user.status === "inactive" || user.status === "locked") {
    throw new AppError("ACCOUNT_LOCKED", "Account is locked");
  }

  // Social-only accounts have NULL password — direct user to use social login.
  if (!user.password) {
    throw new AppError(
      "INVALID_CREDENTIALS",
      `Tài khoản này đã đăng ký qua ${user.provider || "social login"}. Vui lòng đăng nhập bằng phương thức đó.`,
    );
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new AppError("INVALID_CREDENTIALS", "Invalid credentials");

  // Transparent upgrade: if legacy plaintext password, re-hash with bcrypt
  if (!isBcryptHash(user.password)) {
    try {
      const newHash = await hashPassword(password);
      await storage.updateUser(user.userId, { password: newHash });
      logger.info({ userId: user.userId }, "Upgraded legacy password to bcrypt");
    } catch (err) {
      logger.warn({ err, userId: user.userId }, "Failed to upgrade legacy password");
    }
  }

  const role = (user.role === "admin" ? "admin" : "user") as "admin" | "user";
  const token = signJwt({ sub: String(user.userId), email: user.email, role });
  const { password: _pw, ...sanitized } = user;
  sendResponse(res, 200, "Login successful", { ...sanitized, token });
}

async function register(req: Request, res: Response) {
  const { userName, username, password, email } = req.body;
  const finalUserName = userName || username;

  if (!finalUserName || !password || !email) {
    throw new AppError("BAD_REQUEST", "userName, email and password are required");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await storage.getUserByEmail(normalizedEmail);
  if (existing) throw new AppError("EMAIL_ALREADY_EXISTS", "Email already exists");

  const hashed = await hashPassword(password);
  const user = await storage.createUser({
    userName: finalUserName,
    password: hashed,
    email: normalizedEmail,
    role: "user",
    status: "active",
  });

  const role = "user" as const;
  const token = signJwt({ sub: String(user.userId), email: user.email, role });
  const { password: _pw, ...sanitized } = user;
  sendResponse(res, 201, "Registration successful", { ...sanitized, token });
}

async function getCurrentUser(req: Request, res: Response) {
  const auth = req.auth!;
  const user = await storage.getUser(auth.id);
  if (!user) throw errors.notFound("User");
  const { password: _pw, ...sanitized } = user;
  sendResponse(res, 200, "Current user retrieved", sanitized);
}

async function changePassword(req: Request, res: Response) {
  const auth = req.auth!;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError("BAD_REQUEST", "currentPassword and newPassword are required");
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new AppError("VALIDATION_ERROR", "newPassword must be at least 6 characters");
  }

  const user = await storage.getUser(auth.id);
  if (!user) throw errors.notFound("User");

  if (!user.password) {
    throw new AppError(
      "BAD_REQUEST",
      "Tài khoản social không có mật khẩu. Sử dụng tính năng 'đặt mật khẩu' thay vì 'đổi mật khẩu'.",
    );
  }
  const ok = await verifyPassword(currentPassword, user.password);
  if (!ok) throw new AppError("INVALID_CREDENTIALS", "Current password is incorrect");

  const newHash = await hashPassword(newPassword);
  await storage.updateUser(auth.id, { password: newHash });
  sendResponse(res, 200, "Password changed successfully", null);
}

export function registerUserRoutes(app: Express) {
  app.get("/api/users", requireAdmin, asyncHandler(listUsers));
  app.get("/api/users/me", requireAuth, asyncHandler(getCurrentUser));
  app.get("/api/users/:id", requireAuth, asyncHandler(getUserById));
  app.post("/api/users", requireAdmin, asyncHandler(createUser));
  app.put("/api/users/:id", requireAuth, asyncHandler(updateUser));
  app.delete("/api/users/:id", requireAdmin, asyncHandler(deleteUser));

  app.post("/api/auth/login", authLimiter, asyncHandler(login));
  app.post("/api/auth/register", authLimiter, asyncHandler(register));
  app.post("/api/auth/change-password", requireAuth, asyncHandler(changePassword));
  app.post(
    "/api/auth/social",
    authLimiter,
    validate({ body: socialLoginSchema }),
    asyncHandler(socialLoginHandler),
  );
  app.post(
    "/api/auth/forgot-password",
    authLimiter,
    validate({ body: forgotPasswordSchema }),
    asyncHandler(forgotPasswordHandler),
  );
  app.post(
    "/api/auth/reset-password",
    authLimiter,
    validate({ body: resetPasswordSchema }),
    asyncHandler(resetPasswordHandler),
  );
}
