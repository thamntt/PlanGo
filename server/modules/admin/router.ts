import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { requireAdmin } from "../../middlewares/auth";

async function getAdminStats(_req: Request, res: Response) {
  const stats = await storage.getAdminStats();
  sendResponse(res, 200, "Stats retrieved successfully", stats);
}

export function registerAdminRoutes(app: Express) {
  app.get("/api/admin/stats", requireAdmin, asyncHandler(getAdminStats));
}
