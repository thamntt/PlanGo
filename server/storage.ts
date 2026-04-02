import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  destinations,
  itineraries,
  reviews,
  notifications,
  sharedTrips,
  pois,
  type User,
  type InsertUser,
  type Destination,
  type InsertDestination,
  type Itinerary,
  type InsertItinerary,
  type Review,
  type InsertReview,
  type Notification,
  type InsertNotification,
  type SharedTrip,
  type InsertSharedTrip,
  type Poi,
  type InsertPoi,
} from "../shared/schema";

// ══════════════════════════════════════════════════════════════
// Storage Interface
// ══════════════════════════════════════════════════════════════

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Destinations
  getDestination(id: string): Promise<Destination | undefined>;
  getDestinationByName(name: string): Promise<Destination | undefined>;
  getDestinations(): Promise<Destination[]>;
  createDestination(dest: InsertDestination): Promise<Destination>;
  updateDestination(id: string, data: Partial<Destination>): Promise<Destination | undefined>;
  deleteDestination(id: string): Promise<boolean>;

  // Itineraries
  getItinerary(id: string): Promise<Itinerary | undefined>;
  getItineraries(): Promise<Itinerary[]>;
  getItinerariesByUser(userId: string): Promise<Itinerary[]>;
  createItinerary(itin: InsertItinerary): Promise<Itinerary>;
  updateItinerary(id: string, data: Partial<Itinerary>): Promise<Itinerary | undefined>;
  deleteItinerary(id: string): Promise<boolean>;

  // Reviews
  getReview(id: string): Promise<Review | undefined>;
  getReviews(): Promise<Review[]>;
  getReviewsByUser(userId: string): Promise<Review[]>;
  getReviewsByDestination(destinationId: string): Promise<Review[]>;
  getReviewsByPoi(poiId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, data: Partial<Review>): Promise<Review | undefined>;
  deleteReview(id: string): Promise<boolean>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  getNotifications(): Promise<Notification[]>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notif: InsertNotification): Promise<Notification>;
  updateNotification(id: string, data: Partial<Notification>): Promise<Notification | undefined>;
  deleteNotification(id: string): Promise<boolean>;

  // Shared Trips
  getSharedTrip(shareCode: string): Promise<SharedTrip | undefined>;
  createSharedTrip(trip: InsertSharedTrip): Promise<SharedTrip>;
  updateSharedTrip(shareCode: string, data: Partial<SharedTrip>): Promise<SharedTrip | undefined>;
  deleteSharedTrip(shareCode: string): Promise<boolean>;

  // POIs
  getPoi(id: string): Promise<Poi | undefined>;
  getPois(): Promise<Poi[]>;
  getPoisByDestination(destinationId: string): Promise<Poi[]>;
  getPoiByGooglePlaceId(googlePlaceId: string): Promise<Poi | undefined>;
  getPoiByName(name: string): Promise<Poi | undefined>;
  createPoi(poi: InsertPoi): Promise<Poi>;
  updatePoi(id: string, data: Partial<Poi>): Promise<Poi | undefined>;
  deletePoi(id: string): Promise<boolean>;
}

// ══════════════════════════════════════════════════════════════
// Database Storage Implementation
// ══════════════════════════════════════════════════════════════

export class DatabaseStorage implements IStorage {
  // ── Users ──────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // ── Destinations ───────────────────────────────────────────

  async getDestination(id: string): Promise<Destination | undefined> {
    const [dest] = await db.select().from(destinations).where(eq(destinations.id, id));
    return dest;
  }

  async getDestinationByName(name: string): Promise<Destination | undefined> {
    const allDests = await db.select().from(destinations);
    const lower = name.toLowerCase().trim();
    return allDests.find((d) =>
      d.name?.toLowerCase().trim() === lower ||
      d.name?.toLowerCase().includes(lower) ||
      lower.includes(d.name?.toLowerCase() || "")
    );
  }

  async getDestinations(): Promise<Destination[]> {
    return db.select().from(destinations);
  }

  async createDestination(dest: InsertDestination): Promise<Destination> {
    const [created] = await db.insert(destinations).values(dest).returning();
    return created;
  }

  async updateDestination(id: string, data: Partial<Destination>): Promise<Destination | undefined> {
    const [updated] = await db
      .update(destinations)
      .set(data)
      .where(eq(destinations.id, id))
      .returning();
    return updated;
  }

  async deleteDestination(id: string): Promise<boolean> {
    const result = await db.delete(destinations).where(eq(destinations.id, id)).returning();
    return result.length > 0;
  }

  // ── Itineraries ────────────────────────────────────────────

  async getItinerary(id: string): Promise<Itinerary | undefined> {
    const [itin] = await db.select().from(itineraries).where(eq(itineraries.id, id));
    return itin;
  }

  async getItineraries(): Promise<Itinerary[]> {
    return db.select().from(itineraries);
  }

  async getItinerariesByUser(userId: string): Promise<Itinerary[]> {
    return db.select().from(itineraries).where(eq(itineraries.userId, userId));
  }

  async createItinerary(itin: InsertItinerary): Promise<Itinerary> {
    const [created] = await db.insert(itineraries).values(itin).returning();
    return created;
  }

  async updateItinerary(id: string, data: Partial<Itinerary>): Promise<Itinerary | undefined> {
    const [updated] = await db
      .update(itineraries)
      .set(data)
      .where(eq(itineraries.id, id))
      .returning();
    return updated;
  }

  async deleteItinerary(id: string): Promise<boolean> {
    const result = await db.delete(itineraries).where(eq(itineraries.id, id)).returning();
    return result.length > 0;
  }

  // ── Reviews ────────────────────────────────────────────────

  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async getReviews(): Promise<Review[]> {
    return db.select().from(reviews);
  }

  async getReviewsByUser(userId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.userId, userId));
  }

  async getReviewsByDestination(destinationId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.destinationId, destinationId));
  }

  async getReviewsByPoi(poiId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.poiId, poiId));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async updateReview(id: string, data: Partial<Review>): Promise<Review | undefined> {
    const [updated] = await db
      .update(reviews)
      .set(data)
      .where(eq(reviews.id, id))
      .returning();
    return updated;
  }

  async deleteReview(id: string): Promise<boolean> {
    const result = await db.delete(reviews).where(eq(reviews.id, id)).returning();
    return result.length > 0;
  }

  // ── Notifications ──────────────────────────────────────────

  async getNotification(id: string): Promise<Notification | undefined> {
    const [notif] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notif;
  }

  async getNotifications(): Promise<Notification[]> {
    return db.select().from(notifications);
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async createNotification(notif: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notif).returning();
    return created;
  }

  async updateNotification(id: string, data: Partial<Notification>): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set(data)
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    return result.length > 0;
  }

  // ── Shared Trips ───────────────────────────────────────────

  async getSharedTrip(shareCode: string): Promise<SharedTrip | undefined> {
    const [trip] = await db.select().from(sharedTrips).where(eq(sharedTrips.shareCode, shareCode));
    return trip;
  }

  async createSharedTrip(trip: InsertSharedTrip): Promise<SharedTrip> {
    const [created] = await db.insert(sharedTrips).values(trip).returning();
    return created;
  }

  async updateSharedTrip(shareCode: string, data: Partial<SharedTrip>): Promise<SharedTrip | undefined> {
    const [updated] = await db
      .update(sharedTrips)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sharedTrips.shareCode, shareCode))
      .returning();
    return updated;
  }

  async deleteSharedTrip(shareCode: string): Promise<boolean> {
    const result = await db.delete(sharedTrips).where(eq(sharedTrips.shareCode, shareCode)).returning();
    return result.length > 0;
  }

  // ── POIs ───────────────────────────────────────────────────

  async getPoi(id: string): Promise<Poi | undefined> {
    const [poi] = await db.select().from(pois).where(eq(pois.id, id));
    return poi;
  }

  async getPois(): Promise<Poi[]> {
    return db.select().from(pois);
  }

  async getPoisByDestination(destinationId: string): Promise<Poi[]> {
    return db.select().from(pois).where(eq(pois.destinationId, destinationId));
  }

  async getPoiByGooglePlaceId(googlePlaceId: string): Promise<Poi | undefined> {
    const [poi] = await db.select().from(pois).where(eq(pois.googlePlaceId, googlePlaceId));
    return poi;
  }

  async getPoiByName(name: string): Promise<Poi | undefined> {
    const [poi] = await db.select().from(pois).where(eq(pois.name, name));
    return poi;
  }

  async createPoi(poi: InsertPoi): Promise<Poi> {
    const [created] = await db.insert(pois).values(poi).returning();
    return created;
  }

  async updatePoi(id: string, data: Partial<Poi>): Promise<Poi | undefined> {
    const [updated] = await db
      .update(pois)
      .set(data)
      .where(eq(pois.id, id))
      .returning();
    return updated;
  }

  async deletePoi(id: string): Promise<boolean> {
    const result = await db.delete(pois).where(eq(pois.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
