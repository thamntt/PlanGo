import { storage } from "../../storage";
import { errors, AppError } from "../../lib/errors";
import type { ListReviewsQuery, CreateReviewInput, UpdateReviewInput, DeleteReviewQuery } from "./schema";

export async function listReviews(query: ListReviewsQuery) {
  return storage.getReviews(query);
}

export async function createReview(input: CreateReviewInput) {
  const tripId = input.tripId ?? input.itineraryId;
  const itemId = input.itemId ?? input.activityId ?? input.poiId;

  if (itemId) {
    return storage.createItemReview({ ...input, itemId } as any);
  }
  if (tripId) {
    return storage.createTripReview({ ...input, tripId } as any);
  }
  throw new AppError("BAD_REQUEST", "tripId or itemId required");
}

export async function updateReview(id: number, body: UpdateReviewInput) {
  const userId = Number(body.userId);
  if (isNaN(userId)) throw new AppError("BAD_REQUEST", "Invalid User ID");

  const type = body.type || (body.poiId || body.activityId ? "item" : "trip");
  const updated = type === "item"
    ? await storage.updateItemReview(id, userId, body as any)
    : await storage.updateTripReview(id, userId, body as any);
  if (!updated) throw errors.notFound("Review");
  return updated;
}

export async function deleteReview(id: number, query: DeleteReviewQuery) {
  const { userId, type } = query;
  let ok = false;
  if (type === "item") ok = await storage.deleteItemReview(id, userId);
  else if (type === "trip") ok = await storage.deleteTripReview(id, userId);
  else {
    ok = await storage.deleteItemReview(id, userId);
    if (!ok) ok = await storage.deleteTripReview(id, userId);
  }
  if (!ok) throw errors.notFound("Review");
}
