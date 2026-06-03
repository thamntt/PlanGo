import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  pois,
  poiOpeningHours,
  poiPreferences,
  itemReviews,
  itineraryItems,
  type Poi,
  type InsertPoi,
  type InsertPoiOpeningHours,
  type InsertPoiPreference,
} from "../../../shared/schema";

export const poiRepo = {
  async getPoi(id: number) {
    const [r] = await db.select().from(pois).where(eq(pois.poiId, id));
    return r;
  },

  async getPois() {
    return db.select().from(pois);
  },

  async getPoisByDestination(did: number) {
    return db.select().from(pois).where(eq(pois.destinationId, did));
  },

  async getPoiByGooglePlaceId(placeId: string) {
    const [r] = await db.select().from(pois).where(eq(pois.googlePlaceId, placeId));
    return r;
  },

  async getPoiByName(name: string) {
    const [r] = await db.select().from(pois).where(eq(pois.name, name));
    return r;
  },

  async createPoi(data: InsertPoi) {
    const [r] = await db.insert(pois).values(data).returning();
    return r;
  },

  async updatePoi(id: number, data: Partial<Poi>) {
    const [r] = await db.update(pois).set(data).where(eq(pois.poiId, id)).returning();
    return r;
  },

  async deletePoi(id: number) {
    const r = await db.delete(pois).where(eq(pois.poiId, id)).returning();
    return r.length > 0;
  },

  // ─── Opening hours ───
  async getPoiOpeningHours(poiId: number) {
    return db.select().from(poiOpeningHours).where(eq(poiOpeningHours.poiId, poiId));
  },

  async getBatchPoiOpeningHours(poiIds: number[]) {
    if (poiIds.length === 0) return [];
    return db.select().from(poiOpeningHours).where(inArray(poiOpeningHours.poiId, poiIds));
  },

  async createPoiOpeningHours(data: InsertPoiOpeningHours) {
    const [r] = await db.insert(poiOpeningHours).values(data).returning();
    return r;
  },

  async deletePoiOpeningHours(poiId: number) {
    const r = await db.delete(poiOpeningHours).where(eq(poiOpeningHours.poiId, poiId)).returning();
    return r.length > 0;
  },

  // ─── POI preferences ───
  async getPoiPreferences(poiId: number) {
    return db.select().from(poiPreferences).where(eq(poiPreferences.poiId, poiId));
  },

  async addPoiPreference(data: InsertPoiPreference) {
    const [r] = await db.insert(poiPreferences).values(data).returning();
    return r;
  },

  async clearPoiPreferences(poiId: number) {
    await db.delete(poiPreferences).where(eq(poiPreferences.poiId, poiId));
  },

  async removePoiPreference(poiId: number, prefId: number) {
    const r = await db
      .delete(poiPreferences)
      .where(and(eq(poiPreferences.poiId, poiId), eq(poiPreferences.preferenceId, prefId)))
      .returning();
    return r.length > 0;
  },

  /** Recalculate aggregate rating + review count for a POI from its item reviews */
  async updatePoiStats(poiId: number) {
    const reviews = await db
      .select({ rating: itemReviews.rating })
      .from(itemReviews)
      .innerJoin(itineraryItems, eq(itemReviews.itemId, itineraryItems.itemId))
      .where(eq(itineraryItems.poiId, poiId));

    const count = reviews.length;
    const avgRating = count > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count
      : 0;

    await db
      .update(pois)
      .set({ reviewCounts: count, rating: avgRating.toFixed(2) })
      .where(eq(pois.poiId, poiId));
  },
};
