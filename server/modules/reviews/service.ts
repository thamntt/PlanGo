import { storage } from "../../storage";
import { errors, AppError } from "../../lib/errors";
import { notifyReviewPosted } from "../../lib/notify";
import { logger } from "../../lib/logger";
import type {
  ListReviewsQuery,
  CreateReviewInput,
  UpdateReviewInput,
  DeleteReviewQuery,
} from "./schema";

export async function listReviews(query: ListReviewsQuery, viewerId?: number) {
  return storage.getReviews(query, viewerId);
}

export async function createReview(input: CreateReviewInput) {
  const tripId = input.tripId ?? input.itineraryId;
  const itemId = input.itemId ?? input.activityId ?? input.poiId;

  let created: any;
  if (itemId) {
    created = await storage.createItemReview({ ...input, itemId } as any);
  } else if (tripId) {
    created = await storage.createTripReview({ ...input, tripId } as any);
  } else {
    throw new AppError("BAD_REQUEST", "tripId or itemId required");
  }

  // Fire review_posted notification to other trip members (fire-and-forget).
  if (tripId && input.userId) {
    (async () => {
      try {
        const reviewer = await storage.getUser(Number(input.userId)).catch(() => null);
        const reviewerName = reviewer
          ? (reviewer as any).fullName || (reviewer as any).userName || "Ai đó"
          : "Ai đó";
        let targetName = "địa điểm";
        if (itemId) {
          const item = await storage.getItineraryItem(Number(itemId)).catch(() => null);
          if (item) targetName = (item as any).customName || targetName;
        } else {
          const trip = await storage.getTrip(Number(tripId)).catch(() => null);
          if (trip) targetName = (trip as any).title || targetName;
        }
        await notifyReviewPosted(
          Number(tripId),
          Number(input.userId),
          reviewerName,
          targetName,
          Number(input.rating || 0),
        );
      } catch (err) {
        logger.warn({ err }, "Failed to fire review_posted notification");
      }
    })();
  }

  return created;
}

export async function updateReview(id: number, body: UpdateReviewInput) {
  const userId = Number(body.userId);
  if (isNaN(userId)) throw new AppError("BAD_REQUEST", "Invalid User ID");

  const type = body.type || (body.poiId || body.activityId ? "item" : "trip");
  const updated =
    type === "item"
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
