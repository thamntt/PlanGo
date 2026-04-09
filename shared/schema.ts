import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ══════════════════════════════════════════════════════════════
// Users
// ══════════════════════════════════════════════════════════════

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").default(""),
  fullName: text("full_name").default(""),
  avatar: text("avatar").default(""),
  role: text("role").default("user"), // "user" | "admin"
  isLocked: boolean("is_locked").default(false),
  preferences: jsonb("preferences").default([]), // string[]
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ══════════════════════════════════════════════════════════════
// Destinations
// ══════════════════════════════════════════════════════════════

export const destinations = pgTable("destinations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").default(""),
  images: jsonb("images").default([]), // string[]
  category: text("category").default(""),
  address: text("address").default(""),
  latitude: real("latitude").default(0),
  longitude: real("longitude").default(0),
  rating: real("rating").default(0),
  reviewCount: integer("review_count").default(0),
  priceRange: text("price_range"),
  tags: jsonb("tags").default([]), // string[]
  openHours: text("open_hours"),
  isActive: boolean("is_active").default(true),
  highlights: jsonb("highlights").default([]), // string[]
  tips: jsonb("tips").default([]), // string[]
  bestTimeToVisit: text("best_time_to_visit"),
  estimatedCostPerPerson: integer("estimated_cost_per_person"),
  sampleReviews: jsonb("sample_reviews").default([]),
  nearbyFood: jsonb("nearby_food").default([]),
  googlePlaceId: text("google_place_id"),
  googlePhotos: jsonb("google_photos").default([]),
  googleReviews: jsonb("google_reviews").default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDestinationSchema = createInsertSchema(destinations).omit({
  id: true,
  createdAt: true,
});

export type InsertDestination = z.infer<typeof insertDestinationSchema>;
export type Destination = typeof destinations.$inferSelect;

// ══════════════════════════════════════════════════════════════
// Itineraries
// ══════════════════════════════════════════════════════════════

export const itineraries = pgTable("itineraries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  budget: text("budget").default(""),
  totalBudget: integer("total_budget").default(0),
  spentAmount: integer("spent_amount").default(0),
  startingPoint: text("starting_point").default(""),
  numPeople: integer("num_people").default(2),
  preferences: jsonb("preferences").default([]), // string[]
  days: jsonb("days").default([]), // ItineraryDay[]
  expenses: jsonb("expenses").default([]), // Expense[]
  companions: jsonb("companions").default([]), // TripCompanion[]
  shareCode: text("share_code"),
  sharePermission: text("share_permission"), // "editor" | "viewer"
  status: text("status").default("draft"), // "draft" | "active" | "completed"
  resetCount: integer("reset_count").default(0),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertItinerarySchema = createInsertSchema(itineraries).omit({
  id: true,
  createdAt: true,
});

export type InsertItinerary = z.infer<typeof insertItinerarySchema>;
export type Itinerary = typeof itineraries.$inferSelect;

// ══════════════════════════════════════════════════════════════
// Reviews
// ══════════════════════════════════════════════════════════════

export const reviews = pgTable("reviews", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userName: text("user_name").default(""),
  destinationId: text("destination_id").default(""),
  poiId: text("poi_id").default(""),
  poiName: text("poi_name").default(""),
  activityId: text("activity_id"),
  activityTitle: text("activity_title"),
  itineraryId: text("itinerary_id"),
  rating: integer("rating").notNull(),
  comment: text("comment").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// ══════════════════════════════════════════════════════════════
// Notifications
// ══════════════════════════════════════════════════════════════

export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").default(""),
  type: text("type").default("info"), // "info" | "warning" | "success"
  itineraryId: text("itinerary_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ══════════════════════════════════════════════════════════════
// Shared Trips (replaces in-memory Map)
// ══════════════════════════════════════════════════════════════

export const sharedTrips = pgTable("shared_trips", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  shareCode: text("share_code").notNull().unique(),
  itinerary: jsonb("itinerary").notNull(), // full itinerary JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSharedTripSchema = createInsertSchema(sharedTrips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSharedTrip = z.infer<typeof insertSharedTripSchema>;
export type SharedTrip = typeof sharedTrips.$inferSelect;

// ══════════════════════════════════════════════════════════════
// POIs (Points of Interest)
// ══════════════════════════════════════════════════════════════

export const pois = pgTable("pois", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  destinationId: text("destination_id").default(""),
  name: text("name").notNull(),
  type: text("type").default("attraction"), // "attraction" | "restaurant" | "cafe" | "hotel" | "shopping" | "other"
  address: text("address").default(""),
  latitude: real("latitude").default(0),
  longitude: real("longitude").default(0),
  rating: real("rating").default(0),
  reviewCount: integer("review_count").default(0),
  openHours: text("open_hours"),
  openingHours: jsonb("opening_hours").default([]), // string[]
  priceLevel: integer("price_level"),
  estimatedCost: integer("estimated_cost"),
  estimatedDuration: text("estimated_duration"),
  description: text("description").default(""),
  images: jsonb("images").default([]), // string[]
  googlePlaceId: text("google_place_id"),
  googlePhotos: jsonb("google_photos").default([]),
  googleReviews: jsonb("google_reviews").default([]),
  tags: jsonb("tags").default([]), // string[]
  isActive: boolean("is_active").default(true),
  source: text("source").default("manual"), // "manual" | "ai_generated" | "auto_discover"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPoiSchema = createInsertSchema(pois).omit({
  id: true,
  createdAt: true,
});

export type InsertPoi = z.infer<typeof insertPoiSchema>;
export type Poi = typeof pois.$inferSelect;
