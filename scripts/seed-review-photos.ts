/**
 * Add sample photos to ~50% of trip reviews so the photo gallery + filter
 * UI has real data to render.
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, sql } from "drizzle-orm";
import { tripReviews } from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

// Curated Unsplash URLs (verified loadable) - travel photos
const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600",
  "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600",
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=600",
  "https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=600",
  "https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?w=600",
  "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=600",
  "https://images.unsplash.com/photo-1565967511849-76a60a516170?w=600",
  "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600",
  "https://images.unsplash.com/photo-1496939376851-89342e90adcd?w=600",
  "https://images.unsplash.com/photo-1528181304800-259b08848526?w=600",
  "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=600",
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600",
  "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=600",
  "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?w=600",
  "https://images.unsplash.com/photo-1555921015-5532091f6026?w=600",
  "https://images.unsplash.com/photo-1606918801925-e2c914c4b503?w=600",
  "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=600",
];

function pickN(arr: string[], n: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  console.log("📷 Seed photos vào trip_reviews...\n");

  const allReviews = await db
    .select({
      userId: tripReviews.userId,
      tripId: tripReviews.tripId,
    })
    .from(tripReviews);

  let added = 0;
  for (const r of allReviews) {
    // 50% reviews get photos; among those, varying counts 1-5
    if (Math.random() > 0.5) continue;
    const count = Math.floor(Math.random() * 4) + 1; // 1-4 photos
    const photos = pickN(PHOTO_POOL, count);
    await db
      .update(tripReviews)
      .set({ photos: photos as any })
      .where(and(eq(tripReviews.userId, r.userId), eq(tripReviews.tripId, r.tripId)));
    added++;
  }

  console.log(`✅ Added photos to ${added}/${allReviews.length} reviews`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
