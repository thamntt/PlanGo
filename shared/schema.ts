import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  serial,
  real,
  boolean,
  timestamp,
  jsonb,
  time,
  date,
  decimal,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==============================================================================
// BẢNG ĐỘC LẬP (Không chứa Foreign Key)
// ==============================================================================

export const users = pgTable("users", {
  userId: serial("user_id").primaryKey(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const destinationType = pgTable("destination_type", {
  destinationtypeId: serial("destinationtype_id").primaryKey(),
  typeName: varchar("type_name", { length: 255 }).notNull(),
  description: text("description"),
});

export const poiType = pgTable("poi_type", {
  poitypeId: serial("poitype_id").primaryKey(),
  typeName: varchar("type_name", { length: 255 }).notNull(),
  description: text("description"),
});

export const preferences = pgTable("preferences", {
  preferenceId: serial("preference_id").primaryKey(),
  preferenceName: varchar("preference_name", { length: 255 }).notNull(),
});

export const expenseType = pgTable("expensetype", {
  expenseTypeId: serial("expense_type_id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
});

// ==============================================================================
// BẢNG CẤP 1 (Chứa Foreign Key tham chiếu đến bảng độc lập)
// ==============================================================================

export const destinations = pgTable("destinations", {
  destinationId: serial("destination_id").primaryKey(),
  destinationTypeId: integer("destinationtype_id").references(() => destinationType.destinationtypeId),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  googlePlaceId: varchar("google_place_id", { length: 255 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  images: jsonb("images"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  reviewCounts: integer("review_counts").default(0),
  active: boolean("active").default(true),
});

// ==============================================================================
// BẢNG CẤP 2
// ==============================================================================

export const pois = pgTable("pois", {
  poiId: serial("poi_id").primaryKey(),
  poitypeId: integer("poitype_id").references(() => poiType.poitypeId),
  destinationId: integer("destination_id").references(() => destinations.destinationId),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  address: text("address"),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  reviewCounts: integer("review_counts").default(0),
  googlePlaceId: varchar("google_place_id", { length: 255 }),
  description: text("description"),
});

export const trips = pgTable("trips", {
  tripId: serial("trip_id").primaryKey(),
  destinationId: integer("destination_id").references(() => destinations.destinationId),
  ownerId: integer("owner_id").references(() => users.userId),
  title: varchar("title", { length: 255 }).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  numPeople: integer("num_people"),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  invitationToken: varchar("invitation_token", { length: 255 }),
});

// ==============================================================================
// BẢNG CẤP 3
// ==============================================================================

export const poiOpeningHours = pgTable("poi_opening_hours", {
  poiId: integer("poi_id").notNull().references(() => pois.poiId, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  openTime: time("open_time"),
  closeTime: time("close_time"),
}, (table) => ({
  pk: primaryKey({ columns: [table.poiId, table.dayOfWeek] }),
}));

export const poiPreferences = pgTable("poi_preferences", {
  poiId: integer("poi_id").notNull().references(() => pois.poiId, { onDelete: "cascade" }),
  preferenceId: integer("preference_id").notNull().references(() => preferences.preferenceId, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.poiId, table.preferenceId] }),
}));

export const tripMembers = pgTable("trip_members", {
  tripId: integer("trip_id").notNull().references(() => trips.tripId, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.userId, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tripId, table.userId] }),
}));

export const tripPreferences = pgTable("trip_preferences", {
  tripId: integer("trip_id").notNull().references(() => trips.tripId, { onDelete: "cascade" }),
  preferenceId: integer("preference_id").notNull().references(() => preferences.preferenceId, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.tripId, table.preferenceId] }),
}));

export const itineraryDay = pgTable("itineraryday", {
  dayId: serial("day_id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "cascade" }),
  date: date("date"),
  dayIndex: integer("day_index"),
});

export const tripReviews = pgTable("trip_reviews", {
  userId: integer("user_id").notNull().references(() => users.userId, { onDelete: "cascade" }),
  tripId: integer("trip_id").notNull().references(() => trips.tripId, { onDelete: "cascade" }),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.tripId] }),
}));


export const notifications = pgTable("notifications", {
  notificationId: serial("notification_id").primaryKey(),
  userId: integer("user_id").references(() => users.userId, { onDelete: "cascade" }),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "set null" }), // NULLable
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  type: varchar("type", { length: 50 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==============================================================================
// BẢNG CẤP 4
// ==============================================================================

export const itineraryItems = pgTable("itinerary_items", {
  itemId: serial("item_id").primaryKey(),
  dayId: integer("day_id").references(() => itineraryDay.dayId, { onDelete: "cascade" }),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "cascade" }),
  poiId: integer("poi_id").references(() => pois.poiId),

  customName: varchar("custom_name", { length: 255 }),
  startTime: time("start_time"),
  duration: integer("duration"),
  orderIndex: integer("order_index"),
  note: text("note"),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 50 }),
  expenseTypeId: integer("expense_type_id").references(() => expenseType.expenseTypeId),
  activityType: varchar("activity_type", { length: 50 }),
});

export const itemReviews = pgTable("item_reviews", {
  userId: integer("user_id").notNull().references(() => users.userId, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => itineraryItems.itemId, { onDelete: "cascade" }),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.itemId] }),
}));


export const expenses = pgTable("expenses", {
  expenseId: serial("expense_id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => itineraryItems.itemId, { onDelete: "set null" }),
  paidBy: integer("paid_by").references(() => users.userId),
  expenseTypeId: integer("expense_type_id").references(() => expenseType.expenseTypeId),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  splitMethod: varchar("split_method", { length: 50 }),
});

// ==============================================================================
// BẢNG CẤP 5
// ==============================================================================

export const expenseSplits = pgTable("expense_splits", {
  splitId: serial("split_id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.expenseId, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.userId, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
});

export const notes = pgTable("notes", {
  noteId: serial("note_id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.expenseId, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => itineraryItems.itemId, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.userId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type DestinationType = typeof destinationType.$inferSelect;
export type InsertDestinationType = typeof destinationType.$inferInsert;

export type PoiType = typeof poiType.$inferSelect;
export type InsertPoiType = typeof poiType.$inferInsert;

export type Preference = typeof preferences.$inferSelect;
export type InsertPreference = typeof preferences.$inferInsert;

export type ExpenseType = typeof expenseType.$inferSelect;
export type InsertExpenseType = typeof expenseType.$inferInsert;

export type Destination = typeof destinations.$inferSelect;
export type InsertDestination = typeof destinations.$inferInsert;

export type Poi = typeof pois.$inferSelect;
export type InsertPoi = typeof pois.$inferInsert;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

export type PoiOpeningHours = typeof poiOpeningHours.$inferSelect;
export type InsertPoiOpeningHours = typeof poiOpeningHours.$inferInsert;

export type PoiPreference = typeof poiPreferences.$inferSelect;
export type InsertPoiPreference = typeof poiPreferences.$inferInsert;

export type TripMember = typeof tripMembers.$inferSelect;
export type InsertTripMember = typeof tripMembers.$inferInsert;

export type TripPreference = typeof tripPreferences.$inferSelect;
export type InsertTripPreference = typeof tripPreferences.$inferInsert;

export type ItineraryDay = typeof itineraryDay.$inferSelect;
export type InsertItineraryDay = typeof itineraryDay.$inferInsert;

export type TripReview = typeof tripReviews.$inferSelect;
export type InsertTripReview = typeof tripReviews.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type InsertItineraryItem = typeof itineraryItems.$inferInsert;

export type ItemReview = typeof itemReviews.$inferSelect;
export type InsertItemReview = typeof itemReviews.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type InsertExpenseSplit = typeof expenseSplits.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

// ==============================================================================
// RELATIONS
// ==============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripMembers: many(tripMembers),
  tripReviews: many(tripReviews),
  notifications: many(notifications),
  paidExpenses: many(expenses),
  expenseSplits: many(expenseSplits),
  notes: many(notes),
  itemReviews: many(itemReviews),
}));

export const destinationTypeRelations = relations(destinationType, ({ many }) => ({
  destinations: many(destinations),
}));

export const poiTypeRelations = relations(poiType, ({ many }) => ({
  pois: many(pois),
}));

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
  destinationType: one(destinationType, {
    fields: [destinations.destinationTypeId],
    references: [destinationType.destinationtypeId],
  }),
  pois: many(pois),
  trips: many(trips),
}));

export const poisRelations = relations(pois, ({ one, many }) => ({
  poiType: one(poiType, {
    fields: [pois.poitypeId],
    references: [poiType.poitypeId],
  }),
  destination: one(destinations, {
    fields: [pois.destinationId],
    references: [destinations.destinationId],
  }),
  openingHours: many(poiOpeningHours),
  poiPreferences: many(poiPreferences),
  itineraryItems: many(itineraryItems),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  destination: one(destinations, {
    fields: [trips.destinationId],
    references: [destinations.destinationId],
  }),
  owner: one(users, {
    fields: [trips.ownerId],
    references: [users.userId],
  }),
  members: many(tripMembers),
  tripPreferences: many(tripPreferences),
  days: many(itineraryDay),
  reviews: many(tripReviews),
  notifications: many(notifications),
  expenses: many(expenses),
}));

export const itineraryDayRelations = relations(itineraryDay, ({ one, many }) => ({
  trip: one(trips, {
    fields: [itineraryDay.tripId],
    references: [trips.tripId],
  }),
  items: many(itineraryItems),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one, many }) => ({
  day: one(itineraryDay, {
    fields: [itineraryItems.dayId],
    references: [itineraryDay.dayId],
  }),
  poi: one(pois, {
    fields: [itineraryItems.poiId],
    references: [pois.poiId],
  }),
  itemReviews: many(itemReviews),
  expenses: many(expenses),
  notes: many(notes),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(trips, {
    fields: [expenses.tripId],
    references: [trips.tripId],
  }),
  item: one(itineraryItems, {
    fields: [expenses.itemId],
    references: [itineraryItems.itemId],
  }),
  paidByInfo: one(users, {
    fields: [expenses.paidBy],
    references: [users.userId],
  }),
  expenseType: one(expenseType, {
    fields: [expenses.expenseTypeId],
    references: [expenseType.expenseTypeId],
  }),
  splits: many(expenseSplits),
  notes: many(notes),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.expenseId],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.userId],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  expense: one(expenses, {
    fields: [notes.expenseId],
    references: [expenses.expenseId],
  }),
  item: one(itineraryItems, {
    fields: [notes.itemId],
    references: [itineraryItems.itemId],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.userId],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.userId],
  }),
  trip: one(trips, {
    fields: [notifications.tripId],
    references: [trips.tripId],
  }),
}));

export const itemReviewsRelations = relations(itemReviews, ({ one }) => ({
  user: one(users, {
    fields: [itemReviews.userId],
    references: [users.userId],
  }),
  item: one(itineraryItems, {
    fields: [itemReviews.itemId],
    references: [itineraryItems.itemId],
  }),
}));

export const tripReviewsRelations = relations(tripReviews, ({ one }) => ({
  user: one(users, {
    fields: [tripReviews.userId],
    references: [users.userId],
  }),
  trip: one(trips, {
    fields: [tripReviews.tripId],
    references: [trips.tripId],
  }),
}));

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  trip: one(trips, {
    fields: [tripMembers.tripId],
    references: [trips.tripId],
  }),
  user: one(users, {
    fields: [tripMembers.userId],
    references: [users.userId],
  }),
}));

export const poiPreferencesRelations = relations(poiPreferences, ({ one }) => ({
  poi: one(pois, {
    fields: [poiPreferences.poiId],
    references: [pois.poiId],
  }),
  preference: one(preferences, {
    fields: [poiPreferences.preferenceId],
    references: [preferences.preferenceId],
  }),
}));

export const tripPreferencesRelations = relations(tripPreferences, ({ one }) => ({
  trip: one(trips, {
    fields: [tripPreferences.tripId],
    references: [trips.tripId],
  }),
  preference: one(preferences, {
    fields: [tripPreferences.preferenceId],
    references: [preferences.preferenceId],
  }),
}));
