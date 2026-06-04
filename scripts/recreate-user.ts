import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const email = "thamnguyen250804@gmail.com";
  const userName = "thamnt123";
  const password = "Tham@1234";
  const hashed = await bcrypt.hash(password, 10);

  const r = await pool.query(
    `INSERT INTO users (user_name, email, password, role, status, email_verified)
     VALUES ($1, $2, $3, 'user', 'active', true)
     RETURNING user_id, user_name, email, role, created_at`,
    [userName, email, hashed],
  );
  console.log("✅ Đã tạo user:");
  console.table(r.rows);
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
