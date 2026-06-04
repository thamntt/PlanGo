import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Xoá user id 13 (account vừa tạo)
    await client.query("DELETE FROM users WHERE user_id = 13");

    // 2. Insert lại với user_id = 2 explicit
    const email = "thamnguyen250804@gmail.com";
    const userName = "thamnt123";
    const password = "Tham@1234";
    const hashed = await bcrypt.hash(password, 10);

    const r = await client.query(
      `INSERT INTO users (user_id, user_name, email, password, role, status, email_verified)
       VALUES (2, $1, $2, $3, 'user', 'active', true)
       RETURNING user_id, user_name, email, role`,
      [userName, email, hashed],
    );

    // 3. Reset sequence để nextval > max(user_id) hiện có
    await client.query(
      `SELECT setval(pg_get_serial_sequence('users', 'user_id'), (SELECT MAX(user_id) FROM users))`,
    );

    await client.query("COMMIT");
    console.log("✅ Đã đổi user_id 13 → 2:");
    console.table(r.rows);

    // 4. Show toàn bộ users để confirm
    const all = await client.query(
      "SELECT user_id, user_name, email, role FROM users ORDER BY user_id",
    );
    console.log("\n📋 Tất cả users:");
    console.table(all.rows);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
