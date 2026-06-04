import "dotenv/config";
import pg from "pg";

const TABLES = [
  "users",
  "destination_type",
  "poi_type",
  "preferences",
  "expensetype",
  "destinations",
  "pois",
  "trips",
  "poi_opening_hours",
  "poi_preferences",
  "trip_members",
  "trip_preferences",
  "itineraryday",
  "trip_reviews",
  "review_votes",
  "review_replies",
  "content_reports",
  "review_categories",
  "blog_posts",
  "community_tags",
  "blog_post_tags",
  "blog_post_destinations",
  "blog_likes",
  "blog_bookmarks",
  "blog_comments",
  "forum_threads",
  "forum_thread_tags",
  "forum_replies",
  "forum_votes",
  "notifications",
  "itinerary_items",
  "item_reviews",
  "expenses",
  "expense_splits",
  "notes",
  "user_follows",
];

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log("Table".padEnd(30) + "Rows");
  console.log("─".repeat(40));
  const empty: string[] = [];
  for (const t of TABLES) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS c FROM "${t}"`);
      const c = r.rows[0]?.c ?? 0;
      const marker = c === 0 ? " 🔴 EMPTY" : "";
      console.log(`${t.padEnd(30)}${c}${marker}`);
      if (c === 0) empty.push(t);
    } catch {
      console.log(`${t.padEnd(30)}— (no table)`);
    }
  }
  console.log("\nEmpty tables (need seed):", empty.join(", "));
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
