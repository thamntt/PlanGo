import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { destinations, tripReviews, trips } from "../../../shared/schema";
import { destinationTypeRepo } from "../lookups/repository";

const CATEGORY_MAP: Record<string, string> = {
  City: "Thành phố",
  Island: "Biển đảo",
  Mountain: "Núi non",
  Resort: "Nghỉ dưỡng",
  Countryside: "Nông thôn",
  Historical: "Di tích",
  Other: "Khác",
};

async function resolveCategoryToTypeId(payload: any) {
  if (payload.category && !payload.destinationTypeId) {
    const typeName = CATEGORY_MAP[payload.category] || payload.category;
    const type = await destinationTypeRepo.getDestinationTypeByName(typeName);
    if (type) payload.destinationTypeId = type.destinationtypeId;
    delete payload.category;
  }
}

export const destinationRepo = {
  async getDestination(id: number) {
    const [r] = await db.select().from(destinations).where(eq(destinations.destinationId, id));
    return r;
  },

  async getDestinationByName(name: string) {
    const [r] = await db.select().from(destinations).where(eq(destinations.name, name));
    return r;
  },

  async getDestinations(filters?: { destinationTypeId?: number }) {
    if (filters?.destinationTypeId) {
      return db
        .select()
        .from(destinations)
        .where(
          and(
            eq(destinations.destinationTypeId, filters.destinationTypeId),
            eq(destinations.active, true),
          ),
        );
    }
    return db.select().from(destinations).where(eq(destinations.active, true));
  },

  async createDestination(data: any) {
    const payload = { ...data };
    await resolveCategoryToTypeId(payload);
    const [r] = await db.insert(destinations).values(payload).returning();
    return r;
  },

  async updateDestination(id: number, data: any) {
    const payload = { ...data };
    await resolveCategoryToTypeId(payload);
    const [r] = await db
      .update(destinations)
      .set(payload)
      .where(eq(destinations.destinationId, id))
      .returning();
    return r;
  },

  async deleteDestination(id: number) {
    const r = await db
      .update(destinations)
      .set({ active: false })
      .where(eq(destinations.destinationId, id))
      .returning();
    return r.length > 0;
  },

  /**
   * Recalculate aggregate rating + review count for a destination.
   * TripAdvisor pattern: count ALL reviews (each visit = a separate review),
   * average rating across all reviews. The FE displays a secondary count of
   * unique reviewers ("X reviews from Y travelers") computed at render time.
   */
  async updateDestinationStats(destinationId: number) {
    const rows = await db
      .select({ rating: tripReviews.rating })
      .from(tripReviews)
      .innerJoin(trips, eq(tripReviews.tripId, trips.tripId))
      .where(eq(trips.destinationId, destinationId));

    const count = rows.length;
    const avgRating =
      count > 0 ? rows.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count : 0;

    await db
      .update(destinations)
      .set({ reviewCounts: count, rating: avgRating.toFixed(2) })
      .where(eq(destinations.destinationId, destinationId));
  },
};
