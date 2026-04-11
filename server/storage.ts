import { eq, and, desc, asc } from "drizzle-orm";
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
  seedDestinationTypes(): Promise<void>;

  // POI Types
  getPoiType(id: number): Promise<PoiType | undefined>;
  getPoiTypes(): Promise<PoiType[]>;
  createPoiType(data: InsertPoiType): Promise<PoiType>;
  seedPoiTypes(): Promise<void>;

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

  // Reviews
  getReviews(filters?: { tripId?: number; itemId?: number; destinationId?: number }): Promise<any[]>;
  getTripReviews(tripId: number): Promise<TripReview[]>;
  createTripReview(data: InsertTripReview): Promise<TripReview>;
  updateTripReview(tripId: number, userId: number, data: Partial<TripReview>): Promise<TripReview | undefined>;
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
  updateItemReview(itemId: number, userId: number, data: Partial<ItemReview>): Promise<ItemReview | undefined>;
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
  
  // Dashboard Stats
  getAdminStats(): Promise<any>;
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

  async getDestinationTypeByName(name: string) {
    const [r] = await db
      .select()
      .from(destinationType)
      .where(eq(destinationType.typeName, name));
    return r;
  }

  async seedDestinationTypes() {
    const existing = await this.getDestinationTypes();
    const defaults = [
      { typeName: "Thành phố", description: "Các khu vực đô thị lớn" },
      { typeName: "Biển đảo", description: "Các bãi biển và hòn đảo" },
      { typeName: "Núi non", description: "Các vùng cao nguyên và núi" },
      { typeName: "Nghỉ dưỡng", description: "Các khu resort và spa" },
      { typeName: "Nông thôn", description: "Vùng quê và trang trại" },
      { typeName: "Di tích", description: "Địa điểm lịch sử và văn hóa" },
      { typeName: "Khác", description: "Các loại hình khác" },
    ];

    for (const def of defaults) {
      const found = existing.find((e: any) => e.typeName === def.typeName);
      if (!found) {
        await this.createDestinationType(def);
      }
    }
  }

  async seedPoiTypes() {
    const existing = await this.getPoiTypes();
    const defaults = [
      { typeName: "attraction", description: "Địa điểm tham quan, danh lam thắng cảnh" },
      { typeName: "restaurant", description: "Nhà hàng, quán ăn" },
      { typeName: "cafe", description: "Quán cà phê" },
      { typeName: "hotel", description: "Khách sạn, nhà nghỉ" },
      { typeName: "shopping", description: "Trung tâm mua sắm, chợ" },
      { typeName: "other", description: "Loại hình khác" },
    ];

    for (const def of defaults) {
      const found = existing.find((e: any) => e.typeName === def.typeName);
      if (!found) {
        await this.createPoiType(def);
      }
    }
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
  async createDestination(data: any) {
    const payload = { ...data };
    
    // Auto-resolve category string to destinationTypeId
    if (payload.category && !payload.destinationTypeId) {
      const typeMap: Record<string, string> = {
        'City': 'Thành phố',
        'Island': 'Biển đảo',
        'Mountain': 'Núi non',
        'Resort': 'Nghỉ dưỡng',
        'Countryside': 'Nông thôn',
        'Historical': 'Di tích',
        'Other': 'Khác'
      };
      
      const typeName = typeMap[payload.category] || payload.category;
      const type = await this.getDestinationTypeByName(typeName);
      if (type) {
        payload.destinationTypeId = type.destinationtypeId;
      }
      delete payload.category;
    }

    const [r] = await db.insert(destinations).values(payload).returning();
    return r;
  }
  async updateDestination(id: number, data: any) {
    const payload = { ...data };

    // Auto-resolve category string to destinationTypeId
    if (payload.category && !payload.destinationTypeId) {
      const typeMap: Record<string, string> = {
        'City': 'Thành phố',
        'Island': 'Biển đảo',
        'Mountain': 'Núi non',
        'Resort': 'Nghỉ dưỡng',
        'Countryside': 'Nông thôn',
        'Historical': 'Di tích',
        'Other': 'Khác'
      };
      
      const typeName = typeMap[payload.category] || payload.category;
      const type = await this.getDestinationTypeByName(typeName);
      if (type) {
        payload.destinationTypeId = type.destinationtypeId;
      }
      delete payload.category;
    }

    const [r] = await db
      .update(destinations)
      .set(payload)
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
        days: { 
          orderBy: (days, { asc }) => [asc(days.dayIndex)],
          with: { 
            items: {
              orderBy: (items, { asc }) => [asc(items.orderIndex)]
            } 
          } 
        }, 
        members: { with: { user: true } }, 
        expenses: { with: { expenseType: true, paidByInfo: true } }, 
        destination: true 
      }
    }); 
  }
  async getTrips() { 
    return db.query.trips.findMany({
      with: { 
        days: { 
          orderBy: (days, { asc }) => [asc(days.dayIndex)],
          with: { 
            items: {
              orderBy: (items, { asc }) => [asc(items.orderIndex)]
            } 
          } 
        }, 
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
        days: { 
          orderBy: (days, { asc }) => [asc(days.dayIndex)],
          with: { 
            items: {
              orderBy: (items, { asc }) => [asc(items.orderIndex)]
            } 
          } 
        }, 
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
         days: { 
           orderBy: (days, { asc }) => [asc(days.dayIndex)],
           with: { 
             items: {
               orderBy: (items, { asc }) => [asc(items.orderIndex)]
             } 
           } 
         }, 
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
        days: { 
          orderBy: (days, { asc }) => [asc(days.dayIndex)],
          with: { 
            items: {
              orderBy: (items, { asc }) => [asc(items.orderIndex)]
            } 
          } 
        }, 
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

  async getReviews(filters?: { tripId?: number; itemId?: number; destinationId?: number }) {
    // 1. Fetch Trip Reviews with Destination Mapping
    const tripRevQuery = db.select({
      id: tripReviews.tripId, 
      userId: tripReviews.userId,
      tripId: tripReviews.tripId,
      rating: tripReviews.rating,
      comment: tripReviews.comment,
      userName: users.userName,
      destinationId: trips.destinationId,
    })
    .from(tripReviews)
    .innerJoin(users, eq(tripReviews.userId, users.userId))
    .innerJoin(trips, eq(tripReviews.tripId, trips.tripId));

    if (filters?.tripId) {
      tripRevQuery.where(eq(tripReviews.tripId, filters.tripId));
    } else if (filters?.destinationId) {
      tripRevQuery.where(eq(trips.destinationId, filters.destinationId));
    }

    // 2. Fetch Item Reviews with Destination Mapping
    const itemRevQuery = db.select({
      id: itemReviews.itemId,
      userId: itemReviews.userId,
      itemId: itemReviews.itemId,
      rating: itemReviews.rating,
      comment: itemReviews.comment,
      userName: users.userName,
      destinationId: itineraryDay.tripId, 
      poiId: itineraryItems.poiId,
      activityId: itineraryItems.itemId,
    })
    .from(itemReviews)
    .innerJoin(users, eq(itemReviews.userId, users.userId))
    .innerJoin(itineraryItems, eq(itemReviews.itemId, itineraryItems.itemId))
    .innerJoin(itineraryDay, eq(itineraryItems.dayId, itineraryDay.dayId))
    .innerJoin(trips, eq(itineraryDay.tripId, trips.tripId));

    if (filters?.itemId) {
      itemRevQuery.where(eq(itemReviews.itemId, filters.itemId));
    } else if (filters?.tripId) {
      itemRevQuery.where(eq(itineraryDay.tripId, filters.tripId));
    } else if (filters?.destinationId) {
      itemRevQuery.where(eq(trips.destinationId, filters.destinationId));
    }

    const [tripResults, itemResults] = await Promise.all([
      tripRevQuery,
      itemRevQuery
    ]);

    // Map and combine
    const mappedTrips = tripResults.map(r => ({
      ...r,
      type: 'trip',
      itineraryId: r.tripId,
    }));

    const mappedItems = itemResults.map(r => ({
      ...r,
      type: 'item',
      activityId: r.itemId,
    }));

    let all = [...mappedTrips, ...mappedItems];

    // Filter if needed
    if (filters?.tripId) all = all.filter(r => (r as any).tripId === filters.tripId);
    if (filters?.itemId) all = all.filter(r => (r as any).itemId === filters.itemId);
    if (filters?.destinationId) all = all.filter(r => r.destinationId === filters.destinationId);

    return all.sort((a, b) => (b as any).id - (a as any).id);
  }

  async getTripReviews(tripId: number) {
    return db.select().from(tripReviews).where(eq(tripReviews.tripId, tripId));
  }
  
  async createTripReview(data: InsertTripReview) {
    const [r] = await db.insert(tripReviews).values(data).returning();
    
    // Update destination stats
    const trip = await this.getTrip(data.tripId);
    if (trip?.destinationId) {
      await this.updateDestinationStats(trip.destinationId);
    }
    
    return r;
  }
  
  async updateTripReview(tid: number, uid: number, data: Partial<TripReview>) {
    const [r] = await db
      .update(tripReviews)
      .set(data)
      .where(and(eq(tripReviews.tripId, tid), eq(tripReviews.userId, uid)))
      .returning();

    if (r) {
      const trip = await this.getTrip(tid);
      if (trip?.destinationId) {
        await this.updateDestinationStats(trip.destinationId);
      }
    }
    return r;
  }
  
  async deleteTripReview(tid: number, uid: number) {
    const trip = await this.getTrip(tid);
    const res = await db.delete(tripReviews).where(and(eq(tripReviews.tripId, tid), eq(tripReviews.userId, uid))).returning();
    
    if (trip?.destinationId) {
      await this.updateDestinationStats(trip.destinationId);
    }
    
    return res.length > 0;
  }

  private async updateDestinationStats(destinationId: number) {
    // Get all reviews for trips to this destination
    const reviews = await db.select({
      rating: tripReviews.rating
    })
    .from(tripReviews)
    .innerJoin(trips, eq(tripReviews.tripId, trips.tripId))
    .where(eq(trips.destinationId, destinationId));

    const count = reviews.length;
    const avgRating = count > 0 
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count 
      : 0;

    await db.update(destinations)
      .set({ 
        reviewCounts: count, 
        rating: avgRating.toFixed(2) 
      })
      .where(eq(destinations.destinationId, destinationId));
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
    
    // Update POI stats if applicable
    const item = await this.getItineraryItem(data.itemId);
    if (item?.poiId) {
      await this.updatePoiStats(item.poiId);
    }

    return r;
  }

  async updateItemReview(itemId: number, userId: number, data: Partial<ItemReview>) {
    const [r] = await db
      .update(itemReviews)
      .set(data)
      .where(and(eq(itemReviews.itemId, itemId), eq(itemReviews.userId, userId)))
      .returning();

    if (r) {
      const item = await this.getItineraryItem(itemId);
      if (item?.poiId) {
        await this.updatePoiStats(item.poiId);
      }
    }
    return r;
  }

  async deleteItemReview(itemId: number, userId: number) {
    const item = await this.getItineraryItem(itemId);
    const res = await db.delete(itemReviews).where(and(eq(itemReviews.itemId, itemId), eq(itemReviews.userId, userId))).returning();
    
    if (item?.poiId) {
      await this.updatePoiStats(item.poiId);
    }
    
    return res.length > 0;
  }

  private async updatePoiStats(poiId: number) {
    const reviews = await db.select({
      rating: itemReviews.rating
    })
    .from(itemReviews)
    .innerJoin(itineraryItems, eq(itemReviews.itemId, itineraryItems.itemId))
    .where(eq(itineraryItems.poiId, poiId));

    const count = reviews.length;
    const avgRating = count > 0 
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count 
      : 0;

    await db.update(pois)
      .set({ 
        reviewCounts: count, 
        rating: avgRating.toFixed(2) 
      })
      .where(eq(pois.poiId, poiId));
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

  async getAdminStats(): Promise<any> {
    const allUsers = await this.getUsers();
    const allTrips = await this.getTrips();
    const allDestinations = await this.getDestinations();
    const allDestTypes = await this.getDestinationTypes();

    // 1. User Status Distribution
    const userStatus = allUsers.reduce((acc: any, u) => {
      const status = u.status || 'active';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // 2. Trip Status Distribution
    const tripStatus = allTrips.reduce((acc: any, t) => {
      const status = t.status || 'draft';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // 3. Destination Type Distribution
    const typeIdToName = allDestTypes.reduce((acc: any, t: any) => {
      acc[t.destinationtypeId] = t.typeName;
      return acc;
    }, {});

    const destinationTypes = allDestinations.reduce((acc: any, d) => {
      const typeName = d.destinationTypeId ? typeIdToName[d.destinationTypeId] : 'Khác';
      acc[typeName] = (acc[typeName] || 0) + 1;
      return acc;
    }, {});

    // 4. Monthly Growth (last 6 months)
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const now = new Date();
    const tripGrowth = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = months[d.getMonth()];
      const year = d.getFullYear();
      const monthNum = d.getMonth();
      
      const count = allTrips.filter(t => {
        const createdAt = new Date(t.createdAt || '');
        return createdAt.getMonth() === monthNum && createdAt.getFullYear() === year;
      }).length;
      
      tripGrowth.push({ month: monthLabel, value: count });
    }

    return {
      userStatus,
      tripStatus,
      destinationTypes,
      tripGrowth,
      counts: {
        users: allUsers.length,
        trips: allTrips.length,
        destinations: allDestinations.length,
      }
    };
  }
}

export const storage = new DatabaseStorage();
