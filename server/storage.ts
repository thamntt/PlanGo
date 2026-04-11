import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  // Lookup tables
  destinationType,
  poiType,
  expenseType,
  preferences,
  // Core entities
  users,
  destinations,
  pois,
  poiOpeningHours,
  poiPreferences,
  trips,
  tripMembers,
  tripPreferences,
  tripReviews,
  itineraryDay,
  itineraryItems,
  itemReviews,
  expenses,
  expenseSplits,
  notes,
  notifications,
  // Types
  type DestinationType,
  type InsertDestinationType,
  type PoiType,
  type InsertPoiType,
  type ExpenseType,
  type InsertExpenseType,
  type Preference,
  type InsertPreference,
  type User,
  type InsertUser,
  type Destination,
  type InsertDestination,
  type Poi,
  type InsertPoi,
  type PoiOpeningHours,
  type InsertPoiOpeningHours,
  type PoiPreference,
  type InsertPoiPreference,
  type Trip,
  type InsertTrip,
  type TripMember,
  type InsertTripMember,
  type TripPreference,
  type InsertTripPreference,
  type TripReview,
  type InsertTripReview,
  type ItineraryDay,
  type InsertItineraryDay,
  type ItineraryItem,
  type InsertItineraryItem,
  type ItemReview,
  type InsertItemReview,
  type Expense,
  type InsertExpense,
  type ExpenseSplit,
  type InsertExpenseSplit,
  type Note,
  type InsertNote,
  type Notification,
  type InsertNotification,
} from "../shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Destination Types
  getDestinationType(id: number): Promise<DestinationType | undefined>;
  getDestinationTypes(): Promise<DestinationType[]>;
  createDestinationType(data: InsertDestinationType): Promise<DestinationType>;

  // POI Types
  getPoiType(id: number): Promise<PoiType | undefined>;
  getPoiTypes(): Promise<PoiType[]>;
  createPoiType(data: InsertPoiType): Promise<PoiType>;

  // Expense Types
  getExpenseType(id: number): Promise<ExpenseType | undefined>;
  getExpenseTypes(): Promise<ExpenseType[]>;
  createExpenseType(data: InsertExpenseType): Promise<ExpenseType>;

  // Preferences
  getPreference(id: number): Promise<Preference | undefined>;
  getPreferences(): Promise<Preference[]>;
  createPreference(data: InsertPreference): Promise<Preference>;

  // Destinations
  getDestination(id: number): Promise<Destination | undefined>;
  getDestinationByName(name: string): Promise<Destination | undefined>;
  getDestinations(): Promise<Destination[]>;
  createDestination(dest: InsertDestination): Promise<Destination>;
  updateDestination(
    id: number,
    data: Partial<Destination>,
  ): Promise<Destination | undefined>;
  deleteDestination(id: number): Promise<boolean>;

  // POIs
  getPoi(id: number): Promise<Poi | undefined>;
  getPois(): Promise<Poi[]>;
  getPoisByDestination(destinationId: number): Promise<Poi[]>;
  getPoiByGooglePlaceId(placeId: string): Promise<Poi | undefined>;
  getPoiByName(name: string): Promise<Poi | undefined>;
  createPoi(poi: InsertPoi): Promise<Poi>;
  updatePoi(id: number, data: Partial<Poi>): Promise<Poi | undefined>;
  deletePoi(id: number): Promise<boolean>;

  // POI Opening Hours
  getPoiOpeningHours(poiId: number): Promise<PoiOpeningHours[]>;
  createPoiOpeningHours(data: InsertPoiOpeningHours): Promise<PoiOpeningHours>;
  deletePoiOpeningHours(poiId: number): Promise<boolean>;

  // POI Preferences
  getPoiPreferences(poiId: number): Promise<PoiPreference[]>;
  addPoiPreference(data: InsertPoiPreference): Promise<PoiPreference>;
  removePoiPreference(poiId: number, preferenceId: number): Promise<boolean>;

  // Trips
  getTrip(id: number): Promise<Trip | undefined>;
  getTrips(): Promise<Trip[]>;
  getTripsByOwner(ownerId: number): Promise<Trip[]>;
  getTripsByMember(userId: number): Promise<Trip[]>;
  getTripByInvitationToken(token: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, data: Partial<Trip>): Promise<Trip | undefined>;
  deleteTrip(id: number): Promise<boolean>;

  // Trip Members
  getTripMembers(tripId: number): Promise<TripMember[]>;
  addTripMember(data: InsertTripMember): Promise<TripMember>;
  updateTripMember(
    tripId: number,
    userId: number,
    data: Partial<TripMember>,
  ): Promise<TripMember | undefined>;
  removeTripMember(tripId: number, userId: number): Promise<boolean>;

  // Trip Preferences
  getTripPreferences(tripId: number): Promise<TripPreference[]>;
  addTripPreference(data: InsertTripPreference): Promise<TripPreference>;
  removeTripPreference(tripId: number, preferenceId: number): Promise<boolean>;

  // Trip Reviews
  getTripReviews(tripId: number): Promise<TripReview[]>;
  createTripReview(data: InsertTripReview): Promise<TripReview>;
  deleteTripReview(tripId: number, userId: number): Promise<boolean>;

  // Itinerary Days
  getItineraryDay(id: number): Promise<ItineraryDay | undefined>;
  getItineraryDaysByTrip(tripId: number): Promise<ItineraryDay[]>;
  createItineraryDay(data: InsertItineraryDay): Promise<ItineraryDay>;
  updateItineraryDay(
    id: number,
    data: Partial<ItineraryDay>,
  ): Promise<ItineraryDay | undefined>;
  deleteItineraryDay(id: number): Promise<boolean>;

  // Itinerary Items
  getItineraryItem(id: number): Promise<ItineraryItem | undefined>;
  getItineraryItemsByDay(dayId: number): Promise<ItineraryItem[]>;
  createItineraryItem(data: InsertItineraryItem): Promise<ItineraryItem>;
  updateItineraryItem(
    id: number,
    data: Partial<ItineraryItem>,
  ): Promise<ItineraryItem | undefined>;
  deleteItineraryItem(id: number): Promise<boolean>;

  // Item Reviews
  getItemReviews(itemId: number): Promise<ItemReview[]>;
  createItemReview(data: InsertItemReview): Promise<ItemReview>;
  deleteItemReview(itemId: number, userId: number): Promise<boolean>;

  // Expenses
  getExpense(id: number): Promise<Expense | undefined>;
  getExpensesByTrip(tripId: number): Promise<Expense[]>;
  createExpense(data: InsertExpense): Promise<Expense>;
  updateExpense(
    id: number,
    data: Partial<Expense>,
  ): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<boolean>;

  // Expense Splits
  getExpenseSplits(expenseId: number): Promise<ExpenseSplit[]>;
  createExpenseSplit(data: InsertExpenseSplit): Promise<ExpenseSplit>;
  deleteExpenseSplits(expenseId: number): Promise<boolean>;

  // Notes
  getNote(id: number): Promise<Note | undefined>;
  getNotesByItem(itemId: number): Promise<Note[]>;
  getNotesByExpense(expenseId: number): Promise<Note[]>;
  createNote(data: InsertNote): Promise<Note>;
  updateNote(id: number, data: Partial<Note>): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;

  // Notifications
  getNotification(id: number): Promise<Notification | undefined>;
  getNotifications(): Promise<Notification[]>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notif: InsertNotification): Promise<Notification>;
  updateNotification(
    id: number,
    data: Partial<Notification>,
  ): Promise<Notification | undefined>;
  deleteNotification(id: number): Promise<boolean>;
  markNotificationsRead(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.userId, id));
    return row;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.userName, username));
    return row;
  }
  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  async createUser(data: InsertUser): Promise<User> {
    const [row] = await db.insert(users).values(data).returning();
    return row;
  }
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    if (Object.keys(data).length === 0) {
      return this.getUser(id);
    }
    const [row] = await db
      .update(users)
      .set(data)
      .where(eq(users.userId, id))
      .returning();
    return row;
  }
  async deleteUser(id: number): Promise<boolean> {
    const res = await db.delete(users).where(eq(users.userId, id)).returning();
    return res.length > 0;
  }

  // Lookup tables
  async getDestinationType(id: number) {
    const [r] = await db
      .select()
      .from(destinationType)
      .where(eq(destinationType.destinationtypeId, id));
    return r;
  }
  async getDestinationTypes() {
    return db.select().from(destinationType);
  }
  async createDestinationType(data: InsertDestinationType) {
    const [r] = await db.insert(destinationType).values(data).returning();
    return r;
  }

  async getPoiType(id: number) {
    const [r] = await db
      .select()
      .from(poiType)
      .where(eq(poiType.poitypeId, id));
    return r;
  }
  async getPoiTypes() {
    return db.select().from(poiType);
  }
  async createPoiType(data: InsertPoiType) {
    const [r] = await db.insert(poiType).values(data).returning();
    return r;
  }

  async getExpenseType(id: number) {
    const [r] = await db
      .select()
      .from(expenseType)
      .where(eq(expenseType.expenseTypeId, id));
    return r;
  }
  async getExpenseTypes() {
    return db.select().from(expenseType);
  }
  async createExpenseType(data: InsertExpenseType) {
    const [r] = await db.insert(expenseType).values(data).returning();
    return r;
  }

  async getPreference(id: number) {
    const [r] = await db
      .select()
      .from(preferences)
      .where(eq(preferences.preferenceId, id));
    return r;
  }
  async getPreferences() {
    return db.select().from(preferences);
  }
  async createPreference(data: InsertPreference) {
    const [r] = await db.insert(preferences).values(data).returning();
    return r;
  }

  // Destinations
  async getDestination(id: number) {
    const [r] = await db
      .select()
      .from(destinations)
      .where(eq(destinations.destinationId, id));
    return r;
  }
  async getDestinationByName(name: string) {
    const [r] = await db
      .select()
      .from(destinations)
      .where(eq(destinations.name, name));
    return r;
  }
  async getDestinations() {
    return db.select().from(destinations);
  }
  async createDestination(data: InsertDestination) {
    const [r] = await db.insert(destinations).values(data).returning();
    return r;
  }
  async updateDestination(id: number, data: Partial<Destination>) {
    const [r] = await db
      .update(destinations)
      .set(data)
      .where(eq(destinations.destinationId, id))
      .returning();
    return r;
  }
  async deleteDestination(id: number) {
    const r = await db
      .delete(destinations)
      .where(eq(destinations.destinationId, id))
      .returning();
    return r.length > 0;
  }

  // POIs
  async getPoi(id: number) {
    const [r] = await db.select().from(pois).where(eq(pois.poiId, id));
    return r;
  }
  async getPois() {
    return db.select().from(pois);
  }
  async getPoisByDestination(did: number) {
    return db.select().from(pois).where(eq(pois.destinationId, did));
  }
  async getPoiByGooglePlaceId(placeId: string) {
    const [r] = await db
      .select()
      .from(pois)
      .where(eq(pois.googlePlaceId, placeId));
    return r;
  }
  async getPoiByName(name: string) {
    const [r] = await db.select().from(pois).where(eq(pois.name, name));
    return r;
  }
  async createPoi(data: InsertPoi) {
    const [r] = await db.insert(pois).values(data).returning();
    return r;
  }
  async updatePoi(id: number, data: Partial<Poi>) {
    const [r] = await db
      .update(pois)
      .set(data)
      .where(eq(pois.poiId, id))
      .returning();
    return r;
  }
  async deletePoi(id: number) {
    const r = await db.delete(pois).where(eq(pois.poiId, id)).returning();
    return r.length > 0;
  }

  // POI Opening Hours & Preferences
  async getPoiOpeningHours(poiId: number) {
    return db
      .select()
      .from(poiOpeningHours)
      .where(eq(poiOpeningHours.poiId, poiId));
  }
  async createPoiOpeningHours(data: InsertPoiOpeningHours) {
    const [r] = await db.insert(poiOpeningHours).values(data).returning();
    return r;
  }
  async deletePoiOpeningHours(poiId: number) {
    const r = await db
      .delete(poiOpeningHours)
      .where(eq(poiOpeningHours.poiId, poiId))
      .returning();
    return r.length > 0;
  }

  async getPoiPreferences(poiId: number) {
    return db
      .select()
      .from(poiPreferences)
      .where(eq(poiPreferences.poiId, poiId));
  }
  async addPoiPreference(data: InsertPoiPreference) {
    const [r] = await db.insert(poiPreferences).values(data).returning();
    return r;
  }
  async removePoiPreference(poiId: number, prefId: number) {
    const r = await db
      .delete(poiPreferences)
      .where(
        and(
          eq(poiPreferences.poiId, poiId),
          eq(poiPreferences.preferenceId, prefId),
        ),
      )
      .returning();
    return r.length > 0;
  }

  // Trips
  async getTrip(id: number) { 
    return db.query.trips.findFirst({
      where: eq(trips.tripId, id),
      with: { 
        days: { with: { items: true } }, 
        members: { with: { user: true } }, 
        expenses: { with: { expenseType: true, paidByInfo: true } }, 
        destination: true 
      }
    }); 
  }
  async getTrips() { 
    return db.query.trips.findMany({
      with: { 
        days: { with: { items: true } }, 
        members: { with: { user: true } }, 
        expenses: { with: { expenseType: true, paidByInfo: true } }, 
        destination: true 
      }
    }); 
  }
  async getTripsByOwner(ownerId: number) { 
    return db.query.trips.findMany({
      where: eq(trips.ownerId, ownerId),
      with: { 
        days: { with: { items: true } }, 
        members: { with: { user: true } }, 
        expenses: { with: { expenseType: true, paidByInfo: true } }, 
        destination: true 
      },
      orderBy: (trips, { desc }) => [desc(trips.createdAt)]
    }); 
  }
  async getTripsByMember(userId: number) {
    const mem = await db
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.userId, userId));
    if (!mem.length) return [];
    
    const tripIds = mem.map(m => m.tripId);
    const allTrips = await db.query.trips.findMany({
       with: { 
         days: { with: { items: true } }, 
         members: { with: { user: true } }, 
         expenses: { with: { expenseType: true, paidByInfo: true } }, 
         destination: true 
       },
       orderBy: (trips, { desc }) => [desc(trips.createdAt)]
    });
    return allTrips.filter(t => tripIds.includes(t.tripId));
  }
  async getTripByInvitationToken(token: string) { 
    return db.query.trips.findFirst({
      where: eq(trips.invitationToken, token),
      with: { 
        days: { with: { items: true } }, 
        members: { with: { user: true } }, 
        expenses: { with: { expenseType: true, paidByInfo: true } }, 
        destination: true 
      }
    }); 
  }
  async createTrip(data: InsertTrip) {
    const [r] = await db.insert(trips).values(data).returning();
    return r;
  }
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
    ];

    const updateData: Record<string, any> = {};
    for (const field of validFields) {
      if (data[field as keyof Trip] !== undefined) {
        updateData[field] = data[field as keyof Trip];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getTrip(id);
    }

    try {
      await db.update(trips).set(updateData).where(eq(trips.tripId, id));
    } catch (err) {
      console.error("[UpdateTrip Error]", err);
      throw err;
    }
    
    return this.getTrip(id);
  }
  async deleteTrip(id: number) {
    const r = await db.delete(trips).where(eq(trips.tripId, id)).returning();
    return r.length > 0;
  }

  // Trip Members & Preferences & Reviews
  async getTripMembers(tripId: number) {
    return db.select().from(tripMembers).where(eq(tripMembers.tripId, tripId));
  }
  async addTripMember(data: InsertTripMember) {
    const [r] = await db.insert(tripMembers).values(data).returning();
    return r;
  }
  async updateTripMember(tid: number, uid: number, d: Partial<TripMember>) {
    const [r] = await db
      .update(tripMembers)
      .set(d)
      .where(and(eq(tripMembers.tripId, tid), eq(tripMembers.userId, uid)))
      .returning();
    return r;
  }
  async removeTripMember(tid: number, uid: number) {
    const r = await db
      .delete(tripMembers)
      .where(and(eq(tripMembers.tripId, tid), eq(tripMembers.userId, uid)))
      .returning();
    return r.length > 0;
  }

  async getTripPreferences(tripId: number) {
    return db
      .select()
      .from(tripPreferences)
      .where(eq(tripPreferences.tripId, tripId));
  }
  async addTripPreference(data: InsertTripPreference) {
    const [r] = await db.insert(tripPreferences).values(data).returning();
    return r;
  }
  async removeTripPreference(tid: number, pid: number) {
    const r = await db
      .delete(tripPreferences)
      .where(
        and(
          eq(tripPreferences.tripId, tid),
          eq(tripPreferences.preferenceId, pid),
        ),
      )
      .returning();
    return r.length > 0;
  }

  async getTripReviews(tripId: number) {
    return db.select().from(tripReviews).where(eq(tripReviews.tripId, tripId));
  }
  async createTripReview(data: InsertTripReview) {
    const [r] = await db.insert(tripReviews).values(data).returning();
    return r;
  }
  async deleteTripReview(tid: number, uid: number) {
    const r = await db
      .delete(tripReviews)
      .where(and(eq(tripReviews.tripId, tid), eq(tripReviews.userId, uid)))
      .returning();
    return r.length > 0;
  }

  // Itinerary
  async getItineraryDay(id: number) {
    const [r] = await db
      .select()
      .from(itineraryDay)
      .where(eq(itineraryDay.dayId, id));
    return r;
  }
  async getItineraryDaysByTrip(tripId: number) {
    return db
      .select()
      .from(itineraryDay)
      .where(eq(itineraryDay.tripId, tripId));
  }
  async createItineraryDay(data: InsertItineraryDay) {
    const [r] = await db.insert(itineraryDay).values(data).returning();
    return r;
  }
  async updateItineraryDay(id: number, data: Partial<ItineraryDay>) {
    const [r] = await db
      .update(itineraryDay)
      .set(data)
      .where(eq(itineraryDay.dayId, id))
      .returning();
    return r;
  }
  async deleteItineraryDay(id: number) {
    const r = await db
      .delete(itineraryDay)
      .where(eq(itineraryDay.dayId, id))
      .returning();
    return r.length > 0;
  }

  async getItineraryItem(id: number) {
    const [r] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.itemId, id));
    return r;
  }
  async getItineraryItemsByDay(dayId: number) {
    return db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.dayId, dayId));
  }
  async createItineraryItem(data: InsertItineraryItem) {
    const [r] = await db.insert(itineraryItems).values(data).returning();
    return r;
  }
  async updateItineraryItem(id: number, data: Partial<ItineraryItem>) {
    const [r] = await db
      .update(itineraryItems)
      .set(data)
      .where(eq(itineraryItems.itemId, id))
      .returning();
    return r;
  }
  async deleteItineraryItem(id: number) {
    const r = await db
      .delete(itineraryItems)
      .where(eq(itineraryItems.itemId, id))
      .returning();
    return r.length > 0;
  }

  // Item Reviews
  async getItemReviews(itemId: number) {
    return db.select().from(itemReviews).where(eq(itemReviews.itemId, itemId));
  }
  async createItemReview(data: InsertItemReview) {
    const [r] = await db.insert(itemReviews).values(data).returning();
    return r;
  }
  async deleteItemReview(itemId: number, userId: number) {
    const r = await db
      .delete(itemReviews)
      .where(
        and(eq(itemReviews.itemId, itemId), eq(itemReviews.userId, userId)),
      )
      .returning();
    return r.length > 0;
  }

  // Expenses
  async getExpense(id: number) {
    const [r] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.expenseId, id));
    return r;
  }
  async getExpensesByTrip(tripId: number) {
    return db.select().from(expenses).where(eq(expenses.tripId, tripId));
  }
  async createExpense(data: InsertExpense) {
    const [r] = await db.insert(expenses).values(data).returning();
    return r;
  }
  async updateExpense(id: number, data: Partial<Expense>) {
    const [r] = await db
      .update(expenses)
      .set(data)
      .where(eq(expenses.expenseId, id))
      .returning();
    return r;
  }
  async deleteExpense(id: number) {
    const r = await db
      .delete(expenses)
      .where(eq(expenses.expenseId, id))
      .returning();
    return r.length > 0;
  }

  async getExpenseSplits(expenseId: number) {
    return db
      .select()
      .from(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId));
  }
  async createExpenseSplit(data: InsertExpenseSplit) {
    const [r] = await db.insert(expenseSplits).values(data).returning();
    return r;
  }
  async deleteExpenseSplits(expenseId: number) {
    const r = await db
      .delete(expenseSplits)
      .where(eq(expenseSplits.expenseId, expenseId))
      .returning();
    return r.length > 0;
  }

  // Notes
  async getNote(id: number) {
    const [r] = await db.select().from(notes).where(eq(notes.noteId, id));
    return r;
  }
  async getNotesByItem(itemId: number) {
    return db.select().from(notes).where(eq(notes.itemId, itemId));
  }
  async getNotesByExpense(expenseId: number) {
    return db.select().from(notes).where(eq(notes.expenseId, expenseId));
  }
  async createNote(data: InsertNote) {
    const [r] = await db.insert(notes).values(data).returning();
    return r;
  }
  async updateNote(id: number, data: Partial<Note>) {
    const [r] = await db
      .update(notes)
      .set(data)
      .where(eq(notes.noteId, id))
      .returning();
    return r;
  }
  async deleteNote(id: number) {
    const r = await db.delete(notes).where(eq(notes.noteId, id)).returning();
    return r.length > 0;
  }

  // Notifications
  async getNotification(id: number) {
    const [r] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, id));
    return r;
  }
  async getNotifications() {
    return db.select().from(notifications);
  }
  async getNotificationsByUser(userId: number) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  }
  async createNotification(data: InsertNotification) {
    const [r] = await db.insert(notifications).values(data).returning();
    return r;
  }
  async updateNotification(id: number, data: Partial<Notification>) {
    const [r] = await db
      .update(notifications)
      .set(data)
      .where(eq(notifications.notificationId, id))
      .returning();
    return r;
  }
  async deleteNotification(id: number) {
    const r = await db
      .delete(notifications)
      .where(eq(notifications.notificationId, id))
      .returning();
    return r.length > 0;
  }
  async markNotificationsRead(userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
  }
}

export const storage = new DatabaseStorage();
