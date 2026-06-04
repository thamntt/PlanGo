/**
 * Recalc destination + POI stats — TripAdvisor pattern.
 * Count ALL reviews (each visit/trip = a separate review), avg over all.
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq } from "drizzle-orm";
import { destinations, pois } from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

async function main() {
  console.log("🔄 Recalc destination stats — TripAdvisor pattern (count ALL reviews)\n");

  const allDests = await db.select().from(destinations);
  for (const d of allDests) {
    const result = await db.execute<{
      count: string;
      avg_rating: string | null;
      unique_users: string;
    }>(sql`
      SELECT
        COUNT(*)::text AS count,
        AVG(tr.rating)::text AS avg_rating,
        COUNT(DISTINCT tr.user_id)::text AS unique_users
      FROM trip_reviews tr
      INNER JOIN trips t ON t.trip_id = tr.trip_id
      WHERE t.destination_id = ${d.destinationId}
    `);
    const row = result.rows[0];
    const count = parseInt(row?.count ?? "0", 10);
    const uniqueUsers = parseInt(row?.unique_users ?? "0", 10);
    const avg = row?.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : "0.00";
    await db
      .update(destinations)
      .set({ reviewCounts: count, rating: avg })
      .where(eq(destinations.destinationId, d.destinationId));
    console.log(`  ✓ ${d.name}: ${count} reviews từ ${uniqueUsers} users, avg ${avg}⭐`);
  }

  console.log("\n🔄 Recalc POI stats — count ALL item reviews\n");
  const allPois = await db.select({ poiId: pois.poiId }).from(pois);
  for (const p of allPois) {
    const result = await db.execute<{ count: string; avg_rating: string | null }>(sql`
      SELECT COUNT(*)::text AS count, AVG(ir.rating)::text AS avg_rating
      FROM item_reviews ir
      INNER JOIN itinerary_items it ON it.item_id = ir.item_id
      WHERE it.poi_id = ${p.poiId}
    `);
    const row = result.rows[0];
    const count = parseInt(row?.count ?? "0", 10);
    const avg = row?.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : "0.00";
    await db.update(pois).set({ reviewCounts: count, rating: avg }).where(eq(pois.poiId, p.poiId));
  }
  console.log(`✓ Recalc ${allPois.length} POIs\n🎉 Done`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
