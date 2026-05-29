import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { validate, numericIdParam } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import {
  listReviewsQuerySchema,
  createReviewInputSchema,
  updateReviewInputSchema,
  deleteReviewQuerySchema,
} from "./schema";
import * as svc from "./service";

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

export function registerReviewRoutes(app: Express) {
  app.get("/api/reviews", validate({ query: listReviewsQuerySchema }), asyncHandler(listReviews));
  app.post("/api/reviews", requireAuth, validate({ body: createReviewInputSchema }), asyncHandler(createReview));
  app.put("/api/reviews/:id", requireAuth, validate({ params: numericIdParam, body: updateReviewInputSchema }), asyncHandler(updateReview));
  app.delete("/api/reviews/:id", requireAuth, validate({ params: numericIdParam, query: deleteReviewQuerySchema }), asyncHandler(deleteReview));
}
