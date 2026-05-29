import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors } from "../../lib/errors";
import { validate, numericIdParam } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import {
  listNotificationsQuerySchema,
  createNotificationInputSchema,
  updateNotificationInputSchema,
  markReadInputSchema,
} from "./schema";

async function listNotifications(req: Request, res: Response) {
  const { userId } = (req as any).validatedQuery;
  const items = userId
    ? await storage.getNotificationsByUser(userId)
    : await storage.getNotifications();
  sendResponse(res, 200, "Notifications retrieved successfully", items);
}

async function createNotification(req: Request, res: Response) {
  const notif = await storage.createNotification(req.body);
  sendResponse(res, 201, "Notification created successfully", notif);
}

async function updateNotification(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const notif = await storage.updateNotification(id, req.body);
  if (!notif) throw errors.notFound("Notification");
  sendResponse(res, 200, "Notification updated successfully", notif);
}

async function deleteNotification(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const ok = await storage.deleteNotification(id);
  if (!ok) throw errors.notFound("Notification");
  sendResponse(res, 200, "Notification deleted successfully", null);
}

async function markAllRead(req: Request, res: Response) {
  const { userId } = req.body;
  await storage.markNotificationsRead(userId);
  sendResponse(res, 200, "All notifications marked as read", null);
}

export function registerNotificationRoutes(app: Express) {
  app.get("/api/notifications", validate({ query: listNotificationsQuerySchema }), asyncHandler(listNotifications));
  app.post("/api/notifications", requireAuth, validate({ body: createNotificationInputSchema }), asyncHandler(createNotification));
  app.put("/api/notifications/:id", requireAuth, validate({ params: numericIdParam, body: updateNotificationInputSchema }), asyncHandler(updateNotification));
  app.delete("/api/notifications/:id", requireAuth, validate({ params: numericIdParam }), asyncHandler(deleteNotification));
  app.patch("/api/notifications/mark-read", requireAuth, validate({ body: markReadInputSchema }), asyncHandler(markAllRead));
}
