import "dotenv/config";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const r = await pool.query(
    "SELECT user_id, user_name, email, role, created_at FROM users ORDER BY user_id",
  );
  console.table(r.rows);
  await pool.end();
}
main();
