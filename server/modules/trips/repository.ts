import { eq, and, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  trips,
  tripMembers,
  tripPreferences,
  itineraryDay,
  itineraryItems,
  type Trip,
  type InsertTrip,
  type TripMember,
  type InsertTripMember,
  type InsertTripPreference,
  type ItineraryDay,
  type InsertItineraryDay,
  type ItineraryItem,
  type InsertItineraryItem,
} from "../../../shared/schema";

// Shared `with` clause for trip queries
const tripWith = {
  days: {
    orderBy: (d: any, { asc }: any) => [asc(d.dayIndex)],
    with: {
      items: {
        orderBy: (i: any, { asc }: any) => [asc(i.orderIndex)],
        with: { poi: true },
      },
    },
  },
  members: { with: { user: true } },
  expenses: { with: { expenseType: true, paidByInfo: true, splits: { with: { user: true } } } },
  destination: true,
  owner: true,
} as const;

export const tripRepo = {
  async getTrip(id: number) {
    return db.query.trips.findFirst({
      where: eq(trips.tripId, id),
      with: tripWith as any,
    });
  },

  async getTrips() {
    return db.query.trips.findMany({ with: tripWith as any });
  },

  async getTripsByOwner(ownerId: number) {
    return db.query.trips.findMany({
      where: eq(trips.ownerId, ownerId),
      with: tripWith as any,
      orderBy: (trips, { desc }) => [desc(trips.createdAt)],
    });
  },

  async getTripsByMember(userId: number) {
    // "Trips of this user" = trips they own + trips they're invited to as a
    // member. trip_members only stores companions added via share/invite, so
    // the owner's own trips would be missed if we only queried trip_members.
    const [memberRows, ownerTrips] = await Promise.all([
      db
        .select({ tripId: tripMembers.tripId })
        .from(tripMembers)
        .where(eq(tripMembers.userId, userId)),
      db.select({ tripId: trips.tripId }).from(trips).where(eq(trips.ownerId, userId)),
    ]);

    const visibleTripIds = Array.from(
      new Set<number>([
        ...memberRows.map((m) => m.tripId),
        ...ownerTrips.map((t) => t.tripId),
      ]),
    );
    if (visibleTripIds.length === 0) return [];

    // CRITICAL: filter BEFORE loading nested relations. Previously this fetched
    // every trip in the DB then filtered in-memory — O(N) where N = total trips
    // — which made the trips tab take ~60s once the table got large.
    return db.query.trips.findMany({
      where: inArray(trips.tripId, visibleTripIds),
      with: tripWith as any,
      orderBy: (trips, { desc }) => [desc(trips.createdAt)],
    });
  },

  async getTripByInvitationToken(token: string) {
    return db.query.trips.findFirst({
      where: eq(trips.invitationToken, token),
      with: tripWith as any,
    });
  },

  /**
   * Lightweight variant for the share/join landing page. The joiner only needs
   * trip header data + members (for "already joined" check) — NOT every day,
   * activity, item, expense, or POI. The heavy `tripWith` makes the
   * `/api/share/:code` call take 5-10s cold; this trims to ~200ms by skipping
   * the nested days/items/expenses joins entirely.
   */
  async getTripByInvitationTokenLight(token: string) {
    return db.query.trips.findFirst({
      where: eq(trips.invitationToken, token),
      with: {
        members: { with: { user: true } },
        destination: true,
        owner: true,
      },
    });
  },

  async createTrip(data: InsertTrip) {
    const [r] = await db.insert(trips).values(data).returning();
    return r;
  },

  async updateTrip(id: number, data: Partial<Trip>) {
    const validFields = [
      "destinationId",
      "ownerId",
      "title",
      "startDate",
      "endDate",
      "budget",
      "numPeople",
      "status",
      "invitationToken",
      "sharePermission",
    ];

    const updateData: Record<string, any> = {};
    for (const field of validFields) {
      if (data[field as keyof Trip] !== undefined) {
        updateData[field] = data[field as keyof Trip];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return tripRepo.getTrip(id);
    }

    try {
      await db.update(trips).set(updateData).where(eq(trips.tripId, id));
    } catch (err) {
      console.error("[UpdateTrip Error]", err);
      throw err;
    }

    return tripRepo.getTrip(id);
  },

  async deleteTrip(id: number) {
    const r = await db.delete(trips).where(eq(trips.tripId, id)).returning();
    return r.length > 0;
  },

  // ─── Trip members ───
  async getTripMembers(tripId: number) {
    return db.select().from(tripMembers).where(eq(tripMembers.tripId, tripId));
  },

  async addTripMember(data: InsertTripMember) {
    const [r] = await db.insert(tripMembers).values(data).returning();
    return r;
  },

  async updateTripMember(tid: number, uid: number, d: Partial<TripMember>) {
    const [r] = await db
      .update(tripMembers)
      .set(d)
      .where(and(eq(tripMembers.tripId, tid), eq(tripMembers.userId, uid)))
      .returning();
    return r;
  },

  async removeTripMember(tid: number, uid: number) {
    const r = await db
      .delete(tripMembers)
      .where(and(eq(tripMembers.tripId, tid), eq(tripMembers.userId, uid)))
      .returning();
    return r.length > 0;
  },

  // ─── Trip preferences ───
  async getTripPreferences(tripId: number) {
    return db.select().from(tripPreferences).where(eq(tripPreferences.tripId, tripId));
  },

  async addTripPreference(data: InsertTripPreference) {
    const [r] = await db.insert(tripPreferences).values(data).returning();
    return r;
  },

  async clearTripPreferences(tripId: number) {
    await db.delete(tripPreferences).where(eq(tripPreferences.tripId, tripId));
  },

  async removeTripPreference(tid: number, pid: number) {
    const r = await db
      .delete(tripPreferences)
      .where(and(eq(tripPreferences.tripId, tid), eq(tripPreferences.preferenceId, pid)))
      .returning();
    return r.length > 0;
  },

  // ─── Itinerary days ───
  async getItineraryDay(id: number) {
    const [r] = await db.select().from(itineraryDay).where(eq(itineraryDay.dayId, id));
    return r;
  },

  async getItineraryDaysByTrip(tripId: number) {
    return db.select().from(itineraryDay).where(eq(itineraryDay.tripId, tripId));
  },

  async createItineraryDay(data: InsertItineraryDay) {
    const [r] = await db.insert(itineraryDay).values(data).returning();
    return r;
  },

  async updateItineraryDay(id: number, data: Partial<ItineraryDay>) {
    const [r] = await db
      .update(itineraryDay)
      .set(data)
      .where(eq(itineraryDay.dayId, id))
      .returning();
    return r;
  },

  async deleteItineraryDay(id: number) {
    const r = await db.delete(itineraryDay).where(eq(itineraryDay.dayId, id)).returning();
    return r.length > 0;
  },

  // ─── Itinerary items ───
  async getItineraryItem(id: number) {
    const [r] = await db.select().from(itineraryItems).where(eq(itineraryItems.itemId, id));
    return r;
  },

  async getItineraryItemsByDay(dayId: number) {
    return db.select().from(itineraryItems).where(eq(itineraryItems.dayId, dayId));
  },

  async createItineraryItem(data: InsertItineraryItem) {
    const [r] = await db.insert(itineraryItems).values(data).returning();
    return r;
  },

  async updateItineraryItem(id: number, data: Partial<ItineraryItem>) {
    const [r] = await db
      .update(itineraryItems)
      .set(data)
      .where(eq(itineraryItems.itemId, id))
      .returning();
    return r;
  },

  async deleteItineraryItem(id: number) {
    const r = await db.delete(itineraryItems).where(eq(itineraryItems.itemId, id)).returning();
    return r.length > 0;
  },
};
