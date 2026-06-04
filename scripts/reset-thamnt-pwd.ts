import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";

(async () => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const hash = await bcrypt.hash("123456", 10);
  await pool.query(`UPDATE users SET password=$1 WHERE user_id=2`, [hash]);
  console.log("✓ Reset thamnt123 password → 123456");
  await pool.end();
})();
