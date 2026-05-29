import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors, AppError } from "../../lib/errors";
import { hashPassword, verifyPassword, isBcryptHash } from "../../lib/password";
import { signJwt } from "../../lib/jwt";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { authLimiter } from "../../middlewares/rate-limit";
import { logger } from "../../lib/logger";

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

export function registerUserRoutes(app: Express) {
  app.get("/api/users", requireAdmin, asyncHandler(listUsers));
  app.get("/api/users/me", requireAuth, asyncHandler(getCurrentUser));
  app.get("/api/users/:id", requireAuth, asyncHandler(getUserById));
  app.post("/api/users", requireAdmin, asyncHandler(createUser));
  app.put("/api/users/:id", requireAuth, asyncHandler(updateUser));
  app.delete("/api/users/:id", requireAdmin, asyncHandler(deleteUser));

  app.post("/api/auth/login", authLimiter, asyncHandler(login));
  app.post("/api/auth/register", authLimiter, asyncHandler(register));
}
