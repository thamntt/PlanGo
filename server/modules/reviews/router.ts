import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors } from "../../lib/errors";
import { validate, numericIdParam } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import {
  listReviewsQuerySchema,
  createReviewInputSchema,
  updateReviewInputSchema,
  deleteReviewQuerySchema,
} from "./schema";
import * as svc from "./service";
import { engagementRepo } from "./engagement";

async function listReviews(req: Request, res: Response) {
  const data = await svc.listReviews((req as any).validatedQuery);
  sendResponse(res, 200, "Reviews retrieved successfully", data);
}
async function createReview(req: Request, res: Response) {
  const data = await svc.createReview(req.body);
  sendResponse(res, 201, "Review created successfully", data);
}
async function updateReview(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.updateReview(id, req.body);
  sendResponse(res, 200, "Review updated successfully", data);
}
async function deleteReview(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  await svc.deleteReview(id, (req as any).validatedQuery);
  sendResponse(res, 200, "Review deleted successfully", null);
}

// ──────────────────────────────────────────────────────────────
// Phase 1.5 engagement: votes, replies, reports
// ──────────────────────────────────────────────────────────────

async function voteReview(req: Request, res: Response) {
  const reviewUserId = Number(req.params.reviewUserId);
  const reviewTripId = Number(req.params.reviewTripId);
  const voterUserId = Number((req as any).user?.userId);
  const voteType = req.body?.voteType as "helpful" | "not_helpful";
  if (!voterUserId) throw errors.unauthorized();
  if (voteType !== "helpful" && voteType !== "not_helpful") {
    throw errors.badRequest("voteType must be 'helpful' or 'not_helpful'");
  }
  const summary = await engagementRepo.setVote(reviewUserId, reviewTripId, voterUserId, voteType);
  // Trigger reviewer stats refresh in background
  engagementRepo.recomputeReviewerStats(reviewUserId).catch(() => {});
  sendResponse(res, 200, "Vote saved", summary);
}

async function unvoteReview(req: Request, res: Response) {
  const reviewUserId = Number(req.params.reviewUserId);
  const reviewTripId = Number(req.params.reviewTripId);
  const voterUserId = Number((req as any).user?.userId);
  if (!voterUserId) throw errors.unauthorized();
  const summary = await engagementRepo.removeVote(reviewUserId, reviewTripId, voterUserId);
  engagementRepo.recomputeReviewerStats(reviewUserId).catch(() => {});
  sendResponse(res, 200, "Vote removed", summary);
}

async function listReplies(req: Request, res: Response) {
  const reviewUserId = Number(req.params.reviewUserId);
  const reviewTripId = Number(req.params.reviewTripId);
  const data = await engagementRepo.listReplies(reviewUserId, reviewTripId);
  sendResponse(res, 200, "Replies retrieved", data);
}

async function createReply(req: Request, res: Response) {
  const reviewUserId = Number(req.params.reviewUserId);
  const reviewTripId = Number(req.params.reviewTripId);
  const authorId = Number((req as any).user?.userId);
  const content = (req.body?.content ?? "").toString().trim();
  if (!authorId) throw errors.unauthorized();
  if (!content || content.length < 2) throw errors.badRequest("Nội dung quá ngắn");
  if (content.length > 1000) throw errors.badRequest("Nội dung quá dài");
  const r = await engagementRepo.createReply({
    parentReviewUserId: reviewUserId,
    parentReviewTripId: reviewTripId,
    authorId,
    content,
  });
  sendResponse(res, 201, "Reply created", r);
}

async function deleteReply(req: Request, res: Response) {
  const replyId = Number(req.params.replyId);
  const authorId = Number((req as any).user?.userId);
  if (!authorId) throw errors.unauthorized();
  const ok = await engagementRepo.deleteReply(replyId, authorId);
  if (!ok) throw errors.notFound("Reply");
  sendResponse(res, 200, "Reply deleted", null);
}

async function reportContent(req: Request, res: Response) {
  const reporterId = Number((req as any).user?.userId);
  if (!reporterId) throw errors.unauthorized();
  const { contentType, contentRefId, reason, details } = req.body ?? {};
  if (!["review", "reply", "blog", "qa"].includes(contentType)) {
    throw errors.badRequest("Invalid contentType");
  }
  if (!contentRefId) throw errors.badRequest("contentRefId required");
  if (!reason) throw errors.badRequest("reason required");
  const r = await engagementRepo.createReport({
    contentType,
    contentRefId: String(contentRefId),
    reporterId,
    reason,
    details,
  });
  sendResponse(res, 201, "Đã ghi nhận báo cáo, admin sẽ xem xét", r);
}

export function registerReviewRoutes(app: Express) {
  app.get("/api/reviews", validate({ query: listReviewsQuerySchema }), asyncHandler(listReviews));
  app.post(
    "/api/reviews",
    requireAuth,
    validate({ body: createReviewInputSchema }),
    asyncHandler(createReview),
  );
  app.put(
    "/api/reviews/:id",
    requireAuth,
    validate({ params: numericIdParam, body: updateReviewInputSchema }),
    asyncHandler(updateReview),
  );
  app.delete(
    "/api/reviews/:id",
    requireAuth,
    validate({ params: numericIdParam, query: deleteReviewQuerySchema }),
    asyncHandler(deleteReview),
  );

  // Engagement (Phase 1.5)
  app.post("/api/reviews/:reviewUserId/:reviewTripId/vote", requireAuth, asyncHandler(voteReview));
  app.delete(
    "/api/reviews/:reviewUserId/:reviewTripId/vote",
    requireAuth,
    asyncHandler(unvoteReview),
  );
  app.get("/api/reviews/:reviewUserId/:reviewTripId/replies", asyncHandler(listReplies));
  app.post(
    "/api/reviews/:reviewUserId/:reviewTripId/replies",
    requireAuth,
    asyncHandler(createReply),
  );
  app.delete("/api/reviews/replies/:replyId", requireAuth, asyncHandler(deleteReply));
  app.post("/api/reports", requireAuth, asyncHandler(reportContent));
}
