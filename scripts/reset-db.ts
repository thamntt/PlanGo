import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetDatabase() {
  console.log("🔥 Đang tiến hành dọn dẹp toàn bộ dữ liệu hệ thống...");
  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    await client.query("GRANT ALL ON SCHEMA public TO public;");
    console.log("✅ Xóa Schema Public thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi dọn dẹp Database:", err);
  } finally {
    client.release();
    await pool.end();
    console.log("Đóng kết nối DB. Sẵn sàng cho Drizzle Push!");
  }
}

resetDatabase();
