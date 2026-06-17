import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  tripReviews,
  itemReviews,
  users,
  trips,
  destinations,
  itineraryDay,
  itineraryItems,
  pois,
  reviewVotes,
  type TripReview,
  type ItemReview,
  type InsertTripReview,
  type InsertItemReview,
} from "../../../shared/schema";
import { tripRepo } from "../trips/repository";
import { destinationRepo } from "../destinations/repository";
import { poiRepo } from "../pois/repository";

export const reviewRepo = {
  async getReviews(
    filters?: { tripId?: number; itemId?: number; destinationId?: number },
    viewerId?: number,
  ) {
    // Trip reviews — JOIN trip context (title, dates, people) so the FE can
    // display each review with the visit-context label (TripAdvisor pattern:
    // every visit = a separate review with its own context).
    const tripRevQuery = db
      .select({
        id: tripReviews.tripId,
        userId: tripReviews.userId,
        tripId: tripReviews.tripId,
        rating: tripReviews.rating,
        comment: tripReviews.comment,
        photos: tripReviews.photos,
        userName: users.userName,
        userAvatarUrl: users.avatarUrl,
        userReviewerLevel: users.reviewerLevel,
        userReviewCount: users.reviewCount,
        destinationId: trips.destinationId,
        destinationName: destinations.name,
        tripTitle: trips.title,
        tripStartDate: trips.startDate,
        tripEndDate: trips.endDate,
        tripNumPeople: trips.numPeople,
        createdAt: tripReviews.createdAt,
      })
      .from(tripReviews)
      .innerJoin(users, eq(tripReviews.userId, users.userId))
      .innerJoin(trips, eq(tripReviews.tripId, trips.tripId))
      .leftJoin(destinations, eq(trips.destinationId, destinations.destinationId));

    if (filters?.tripId) tripRevQuery.where(eq(tripReviews.tripId, filters.tripId));
    else if (filters?.destinationId)
      tripRevQuery.where(eq(trips.destinationId, filters.destinationId));

    // Item reviews
    const itemRevQuery = db
      .select({
        id: itemReviews.itemId,
        userId: itemReviews.userId,
        itemId: itemReviews.itemId,
        rating: itemReviews.rating,
        comment: itemReviews.comment,
        photos: itemReviews.photos,
        userName: users.userName,
        userAvatarUrl: users.avatarUrl,
        destinationId: itineraryDay.tripId,
        poiId: itineraryItems.poiId,
        activityId: itineraryItems.itemId,
        activityTitle: itineraryItems.customName,
        poiName: pois.name,
        destinationName: destinations.name,
        createdAt: itemReviews.createdAt,
      })
      .from(itemReviews)
      .innerJoin(users, eq(itemReviews.userId, users.userId))
      .innerJoin(itineraryItems, eq(itemReviews.itemId, itineraryItems.itemId))
      .innerJoin(itineraryDay, eq(itineraryItems.dayId, itineraryDay.dayId))
      .innerJoin(trips, eq(itineraryDay.tripId, trips.tripId))
      .leftJoin(destinations, eq(trips.destinationId, destinations.destinationId))
      .leftJoin(pois, eq(itineraryItems.poiId, pois.poiId));

    if (filters?.itemId) itemRevQuery.where(eq(itemReviews.itemId, filters.itemId));
    else if (filters?.tripId) itemRevQuery.where(eq(itineraryDay.tripId, filters.tripId));
    else if (filters?.destinationId)
      itemRevQuery.where(eq(trips.destinationId, filters.destinationId));

    const [tripResults, itemResults] = await Promise.all([tripRevQuery, itemRevQuery]);

    const mappedTrips = tripResults.map((r) => ({ ...r, type: "trip", itineraryId: r.tripId }));
    const mappedItems = itemResults.map((r) => ({ ...r, type: "item", activityId: r.itemId }));

    let all = [...mappedTrips, ...mappedItems];
    if (filters?.tripId) all = all.filter((r) => (r as any).tripId === filters.tripId);
    if (filters?.itemId) all = all.filter((r) => (r as any).itemId === filters.itemId);
    if (filters?.destinationId) all = all.filter((r) => r.destinationId === filters.destinationId);

    // Newest first. We DO NOT dedup by user — each visit (trip) is a separate
    // review with its own context (date, num people, trip title), per the
    // TripAdvisor pattern. The FE groups visually by user when rendering.
    all.sort(
      (a, b) =>
        new Date((b as any).createdAt ?? 0).getTime() -
        new Date((a as any).createdAt ?? 0).getTime(),
    );

    // Attach helpfulCount + viewerVoted via single batch query keyed by
    // (reviewUserId, reviewTripId). Only applies to trip reviews — item reviews
    // don't participate in helpful voting in current scope.
    const tripPairs = all
      .filter((r: any) => r.type === "trip" && r.tripId != null && r.userId != null)
      .map((r: any) => ({ userId: r.userId as number, tripId: r.tripId as number }));
    if (tripPairs.length > 0) {
      const userIds = [...new Set(tripPairs.map((p) => p.userId))];
      const tripIds = [...new Set(tripPairs.map((p) => p.tripId))];
      const voteRows = await db
        .select({
          reviewUserId: reviewVotes.reviewUserId,
          reviewTripId: reviewVotes.reviewTripId,
          voterUserId: reviewVotes.voterUserId,
          voteType: reviewVotes.voteType,
        })
        .from(reviewVotes)
        .where(
          and(
            inArray(reviewVotes.reviewUserId, userIds),
            inArray(reviewVotes.reviewTripId, tripIds),
          ),
        );
      const helpfulMap = new Map<string, number>();
      const viewerVotedSet = new Set<string>();
      for (const v of voteRows) {
        if (v.voteType !== "helpful") continue;
        const k = `${v.reviewUserId}|${v.reviewTripId}`;
        helpfulMap.set(k, (helpfulMap.get(k) || 0) + 1);
        if (viewerId && v.voterUserId === viewerId) viewerVotedSet.add(k);
      }
      for (const r of all as any[]) {
        if (r.type === "trip" && r.tripId != null && r.userId != null) {
          const k = `${r.userId}|${r.tripId}`;
          r.helpfulCount = helpfulMap.get(k) || 0;
          r.viewerVotedHelpful = viewerVotedSet.has(k);
        }
      }
    }

    return all;
  },

  // ─── Trip reviews ───
  async getTripReviews(tripId: number) {
    return db.select().from(tripReviews).where(eq(tripReviews.tripId, tripId));
  },

  async createTripReview(data: InsertTripReview) {
    const [r] = await db.insert(tripReviews).values(data).returning();

    const trip = await tripRepo.getTrip(data.tripId);
    if (trip?.destinationId) {
      await destinationRepo.updateDestinationStats(trip.destinationId);
    }

    const full = await reviewRepo.getReviews({ tripId: data.tripId });
    return full.find((rev) => Number(rev.userId) === data.userId) || r;
  },

  async updateTripReview(tid: number, uid: number, data: Partial<TripReview>) {
    const [r] = await db
      .update(tripReviews)
      .set(data)
      .where(and(eq(tripReviews.tripId, tid), eq(tripReviews.userId, uid)))
      .returning();

    if (r) {
      const trip = await tripRepo.getTrip(tid);
      if (trip?.destinationId) {
        await destinationRepo.updateDestinationStats(trip.destinationId);
      }
      const full = await reviewRepo.getReviews({ tripId: tid });
      return full.find((rev) => Number(rev.userId) === uid) || r;
    }
    return undefined;
  },

  async deleteTripReview(tid: number, uid: number) {
    const trip = await tripRepo.getTrip(tid);
    const res = await db
      .delete(tripReviews)
      .where(and(eq(tripReviews.tripId, tid), eq(tripReviews.userId, uid)))
      .returning();

    if (trip?.destinationId) {
      await destinationRepo.updateDestinationStats(trip.destinationId);
    }
    return res.length > 0;
  },

  // ─── Item reviews ───
  async getItemReviews(itemId: number) {
    return db.select().from(itemReviews).where(eq(itemReviews.itemId, itemId));
  },

  async createItemReview(data: InsertItemReview) {
    const [r] = await db.insert(itemReviews).values(data).returning();

    const item = await tripRepo.getItineraryItem(data.itemId);
    if (item?.poiId) {
      await poiRepo.updatePoiStats(item.poiId);
    }

    const full = await reviewRepo.getReviews({ itemId: data.itemId });
    return full.find((rev) => Number(rev.userId) === data.userId) || r;
  },

  async updateItemReview(itemId: number, userId: number, data: Partial<ItemReview>) {
    const [r] = await db
      .update(itemReviews)
      .set(data)
      .where(and(eq(itemReviews.itemId, itemId), eq(itemReviews.userId, userId)))
      .returning();

    if (r) {
      const item = await tripRepo.getItineraryItem(itemId);
      if (item?.poiId) {
        await poiRepo.updatePoiStats(item.poiId);
      }
      const full = await reviewRepo.getReviews({ itemId });
      return full.find((rev) => Number(rev.userId) === userId) || r;
    }
    return undefined;
  },

  async deleteItemReview(itemId: number, userId: number) {
    const item = await tripRepo.getItineraryItem(itemId);
    const res = await db
      .delete(itemReviews)
      .where(and(eq(itemReviews.itemId, itemId), eq(itemReviews.userId, userId)))
      .returning();

    if (item?.poiId) {
      await poiRepo.updatePoiStats(item.poiId);
    }
    return res.length > 0;
  },
};
