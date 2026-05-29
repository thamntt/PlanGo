import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  tripReviews,
  itemReviews,
  users,
  trips,
  destinations,
  itineraryDay,
  itineraryItems,
  pois,
  type TripReview,
  type ItemReview,
  type InsertTripReview,
  type InsertItemReview,
} from "../../shared/schema";
import { tripRepo } from "./trips";
import { destinationRepo } from "./destinations";
import { poiRepo } from "./pois";

export const reviewRepo = {
  async getReviews(filters?: { tripId?: number; itemId?: number; destinationId?: number }) {
    // Trip reviews
    const tripRevQuery = db
      .select({
        id: tripReviews.tripId,
        userId: tripReviews.userId,
        tripId: tripReviews.tripId,
        rating: tripReviews.rating,
        comment: tripReviews.comment,
        userName: users.userName,
        destinationId: trips.destinationId,
        destinationName: destinations.name,
        createdAt: tripReviews.createdAt,
      })
      .from(tripReviews)
      .innerJoin(users, eq(tripReviews.userId, users.userId))
      .innerJoin(trips, eq(tripReviews.tripId, trips.tripId))
      .leftJoin(destinations, eq(trips.destinationId, destinations.destinationId));

    if (filters?.tripId) tripRevQuery.where(eq(tripReviews.tripId, filters.tripId));
    else if (filters?.destinationId) tripRevQuery.where(eq(trips.destinationId, filters.destinationId));

    // Item reviews
    const itemRevQuery = db
      .select({
        id: itemReviews.itemId,
        userId: itemReviews.userId,
        itemId: itemReviews.itemId,
        rating: itemReviews.rating,
        comment: itemReviews.comment,
        userName: users.userName,
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
    else if (filters?.destinationId) itemRevQuery.where(eq(trips.destinationId, filters.destinationId));

    const [tripResults, itemResults] = await Promise.all([tripRevQuery, itemRevQuery]);

    const mappedTrips = tripResults.map((r) => ({ ...r, type: "trip", itineraryId: r.tripId }));
    const mappedItems = itemResults.map((r) => ({ ...r, type: "item", activityId: r.itemId }));

    let all = [...mappedTrips, ...mappedItems];
    if (filters?.tripId) all = all.filter((r) => (r as any).tripId === filters.tripId);
    if (filters?.itemId) all = all.filter((r) => (r as any).itemId === filters.itemId);
    if (filters?.destinationId) all = all.filter((r) => r.destinationId === filters.destinationId);

    return all.sort((a, b) => (b as any).id - (a as any).id);
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
