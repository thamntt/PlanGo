import { db } from "../server/db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  // 1. Verify column exists
  const cols = await db.execute(
    sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio'`,
  );
  console.log("BIO column meta:", cols.rows);

  // 2. Inspect thamnt123 row
  const rows = await db.execute(
    sql`SELECT user_id, user_name, bio FROM users WHERE user_name = 'thamnt123'`,
  );
  console.log("thamnt123 row:", rows.rows);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
