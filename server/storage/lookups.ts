import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  destinationType,
  poiType,
  expenseType,
  preferences,
  type DestinationType,
  type InsertDestinationType,
  type PoiType,
  type InsertPoiType,
  type ExpenseType,
  type InsertExpenseType,
  type Preference,
  type InsertPreference,
} from "../../shared/schema";

// ─── Destination Types ───
export const destinationTypeRepo = {
  async getDestinationType(id: number) {
    const [r] = await db.select().from(destinationType).where(eq(destinationType.destinationtypeId, id));
    return r;
  },

  async getDestinationTypes() {
    return db.select().from(destinationType);
  },

  async getDestinationTypeByName(name: string) {
    const [r] = await db.select().from(destinationType).where(eq(destinationType.typeName, name));
    return r;
  },

  async createDestinationType(data: InsertDestinationType) {
    const [r] = await db.insert(destinationType).values(data).returning();
    return r;
  },

  async updateDestinationType(id: number, data: Partial<DestinationType>) {
    const [r] = await db
      .update(destinationType)
      .set(data)
      .where(eq(destinationType.destinationtypeId, id))
      .returning();
    return r;
  },

  async deleteDestinationType(id: number) {
    const r = await db
      .delete(destinationType)
      .where(eq(destinationType.destinationtypeId, id))
      .returning();
    return r.length > 0;
  },

  async seedDestinationTypes() {
    const existing = await destinationTypeRepo.getDestinationTypes();
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
      if (!found) await destinationTypeRepo.createDestinationType(def);
    }
  },
};

// ─── POI Types ───
export const poiTypeRepo = {
  async getPoiType(id: number) {
    const [r] = await db.select().from(poiType).where(eq(poiType.poitypeId, id));
    return r;
  },

  async getPoiTypes() {
    return db.select().from(poiType);
  },

  async createPoiType(data: InsertPoiType) {
    const [r] = await db.insert(poiType).values(data).returning();
    return r;
  },

  async updatePoiType(id: number, data: Partial<PoiType>) {
    const [r] = await db.update(poiType).set(data).where(eq(poiType.poitypeId, id)).returning();
    return r;
  },

  async deletePoiType(id: number) {
    const r = await db.delete(poiType).where(eq(poiType.poitypeId, id)).returning();
    return r.length > 0;
  },

  async seedPoiTypes() {
    const existing = await poiTypeRepo.getPoiTypes();
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
      if (!found) await poiTypeRepo.createPoiType(def);
    }
  },
};

// ─── Expense Types ───
export const expenseTypeRepo = {
  async getExpenseType(id: number) {
    const [r] = await db.select().from(expenseType).where(eq(expenseType.expenseTypeId, id));
    return r;
  },

  async getExpenseTypes() {
    return db.select().from(expenseType);
  },

  async createExpenseType(data: InsertExpenseType) {
    const [r] = await db.insert(expenseType).values(data).returning();
    return r;
  },

  async updateExpenseType(id: number, data: Partial<ExpenseType>) {
    const [r] = await db.update(expenseType).set(data).where(eq(expenseType.expenseTypeId, id)).returning();
    return r;
  },

  async deleteExpenseType(id: number) {
    const r = await db.delete(expenseType).where(eq(expenseType.expenseTypeId, id)).returning();
    return r.length > 0;
  },
};

// ─── Preferences ───
export const preferenceRepo = {
  async getPreference(id: number) {
    const [r] = await db.select().from(preferences).where(eq(preferences.preferenceId, id));
    return r;
  },

  async getPreferenceByName(name: string) {
    const [r] = await db.select().from(preferences).where(eq(preferences.preferenceName, name));
    return r;
  },

  async getPreferences() {
    return db.select().from(preferences);
  },

  async createPreference(data: InsertPreference) {
    const [r] = await db.insert(preferences).values(data).returning();
    return r;
  },

  async updatePreference(id: number, data: Partial<Preference>) {
    const [r] = await db.update(preferences).set(data).where(eq(preferences.preferenceId, id)).returning();
    return r;
  },

  async deletePreference(id: number) {
    const r = await db.delete(preferences).where(eq(preferences.preferenceId, id)).returning();
    return r.length > 0;
  },

  async seedPreferences() {
    const { PREFERENCE_OPTIONS } = await import("../../lib/seed-data");
    const existing = await preferenceRepo.getPreferences();
    if (existing.length > 0) return;
    console.log("[Storage] Seeding preferences...");
    for (const name of PREFERENCE_OPTIONS) {
      await preferenceRepo.createPreference({ preferenceName: name });
    }
    console.log(`[Storage] Seeded ${PREFERENCE_OPTIONS.length} preferences.`);
  },
};
