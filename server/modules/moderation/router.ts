import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse, errors } from "../../lib/http";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { moderationRepo, type ContentType } from "./repository";

const VALID_TYPES: ContentType[] = ["blog", "forum_thread", "forum_reply", "blog_comment"];
const VALID_REASONS = ["spam", "harassment", "misinformation", "illegal", "offensive", "other"];

async function createReport(req: Request, res: Response) {
  const reporterId = req.auth!.id;
  const { contentType, contentRefId, reason, details } = req.body ?? {};
  if (!VALID_TYPES.includes(contentType)) throw errors.badRequest("Invalid contentType");
  if (!VALID_REASONS.includes(reason)) throw errors.badRequest("Invalid reason");
  if (!contentRefId || isNaN(Number(contentRefId))) throw errors.badRequest("Invalid contentRefId");

  try {
    const created = await moderationRepo.createReport({
      reporterId,
      contentType,
      contentRefId: Number(contentRefId),
      reason,
      details: details ? String(details).slice(0, 500) : undefined,
    });
    sendResponse(res, 201, "Báo cáo đã được gửi", created);
  } catch (err: any) {
    throw errors.badRequest(err?.message || "Cannot create report");
  }
}

async function listMyReports(req: Request, res: Response) {
  const userId = req.auth!.id;
  const data = await moderationRepo.listMyReports(userId);
  sendResponse(res, 200, "My reports retrieved", data);
}

async function listAdminQueue(req: Request, res: Response) {
  const grouped = req.query.grouped === "true";
  const data = grouped
    ? await moderationRepo.listQueueGrouped()
    : await moderationRepo.listQueue("pending");
  sendResponse(res, 200, "Queue retrieved", data);
}

async function resolveReport(req: Request, res: Response) {
  const reportId = Number(req.params.id);
  const status = req.body?.status as "resolved" | "dismissed";
  if (!["resolved", "dismissed"].includes(status)) throw errors.badRequest("Invalid status");
  const r = await moderationRepo.resolveReport(reportId, status, req.auth!.id);
  sendResponse(res, 200, "Report resolved", r);
}

async function resolveAllForContent(req: Request, res: Response) {
  const { contentType, contentRefId, status } = req.body ?? {};
  if (!VALID_TYPES.includes(contentType)) throw errors.badRequest("Invalid contentType");
  if (!["resolved", "dismissed"].includes(status)) throw errors.badRequest("Invalid status");
  await moderationRepo.resolveAllForContent(contentType, Number(contentRefId), status);
  sendResponse(res, 200, "Reports updated", null);
}

export function registerModerationRoutes(app: Express) {
  app.post("/api/community/report", requireAuth, asyncHandler(createReport));
  app.get("/api/community/reports/me", requireAuth, asyncHandler(listMyReports));
  app.get("/api/admin/moderation/queue", requireAdmin, asyncHandler(listAdminQueue));
  app.post("/api/admin/moderation/reports/:id/resolve", requireAdmin, asyncHandler(resolveReport));
  app.post(
    "/api/admin/moderation/content/resolve",
    requireAdmin,
    asyncHandler(resolveAllForContent),
  );
}
