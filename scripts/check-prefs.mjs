import "dotenv/config";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const r = await pool.query("SELECT preference_id, preference_name FROM preferences ORDER BY preference_id");
console.table(r.rows);
await pool.end();
