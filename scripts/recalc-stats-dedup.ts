/**
 * Recalc destination + POI stats using NEW dedup-by-user logic.
 * Each user counts once per destination (latest review wins).
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
  console.log("🔄 Recalc destination stats với dedup-by-user...\n");

  const allDests = await db.select().from(destinations);
  for (const d of allDests) {
    // Dedup: pick latest review per user via DISTINCT ON
    const result = await db.execute<{ count: string; avg_rating: string | null }>(sql`
      WITH latest_per_user AS (
        SELECT DISTINCT ON (tr.user_id)
          tr.user_id, tr.rating
        FROM trip_reviews tr
        INNER JOIN trips t ON t.trip_id = tr.trip_id
        WHERE t.destination_id = ${d.destinationId}
        ORDER BY tr.user_id, tr.created_at DESC
      )
      SELECT COUNT(*)::text AS count, AVG(rating)::text AS avg_rating
      FROM latest_per_user
    `);
    const row = result.rows[0];
    const count = parseInt(row?.count ?? "0", 10);
    const avg = row?.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : "0.00";
    await db
      .update(destinations)
      .set({ reviewCounts: count, rating: avg })
      .where(eq(destinations.destinationId, d.destinationId));
    console.log(`  ✓ ${d.name}: ${count} unique reviewers, avg ${avg}⭐`);
  }

  console.log("\n🔄 Recalc POI stats với dedup-by-user (mỗi user 1 review/POI)...\n");
  const allPois = await db.select({ poiId: pois.poiId, name: pois.name }).from(pois);
  for (const p of allPois) {
    const result = await db.execute<{ count: string; avg_rating: string | null }>(sql`
      WITH latest_per_user AS (
        SELECT DISTINCT ON (ir.user_id)
          ir.user_id, ir.rating
        FROM item_reviews ir
        INNER JOIN itinerary_items it ON it.item_id = ir.item_id
        WHERE it.poi_id = ${p.poiId}
        ORDER BY ir.user_id, ir.created_at DESC
      )
      SELECT COUNT(*)::text AS count, AVG(rating)::text AS avg_rating
      FROM latest_per_user
    `);
    const row = result.rows[0];
    const count = parseInt(row?.count ?? "0", 10);
    const avg = row?.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : "0.00";
    await db.update(pois).set({ reviewCounts: count, rating: avg }).where(eq(pois.poiId, p.poiId));
  }
  console.log(`✓ Recalc ${allPois.length} POIs\n`);

  console.log("🎉 Done — destinations + POIs giờ chỉ count unique users (latest review)");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
