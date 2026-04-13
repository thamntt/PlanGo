import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function standardize() {
  console.log("--- Starting Expense Type Standardization ---");

  const { db } = await import("../server/db");
  const { itineraryItems, expenses, expenseType } = await import("../shared/schema");
  const { eq, sql } = await import("drizzle-orm");

  // 1. Update existing records using redundant IDs
  const mapping = [
    { from: 7, to: 4 },  // Sightseeing -> Tham quan
    { from: 8, to: 1 },  // Dining -> Ăn uống
    { from: 9, to: 2 },  // Transport -> Di chuyển
    { from: 10, to: 5 }, // Shopping -> Mua sắm
    { from: 11, to: 3 }, // Accommodation -> Khách sạn
    { from: 12, to: 4 }, // Entertainment -> Tham quan
    { from: 13, to: 6 }, // Other -> Khác
  ];

  for (const m of mapping) {
    console.log(`Migrating ID ${m.from} to ${m.to}...`);
    await db.update(itineraryItems)
      .set({ expenseTypeId: m.to })
      .where(eq(itineraryItems.expenseTypeId, m.from));

    await db.update(expenses)
      .set({ expenseTypeId: m.to })
      .where(eq(expenses.expenseTypeId, m.from));
  }

  // 2. Standardize names for IDs 1-6
  const coreTypes = [
    { id: 1, name: "Ăn uống", description: "Chi phí ăn uống" },
    { id: 2, name: "Di chuyển", description: "Chi phí di chuyển" },
    { id: 3, name: "Khách sạn", description: "Chi phí lưu trú, khách sạn" },
    { id: 4, name: "Tham quan", description: "Chi phí vé tham quan, giải trí" },
    { id: 5, name: "Mua sắm", description: "Chi phí mua sắm quà cáp" },
    { id: 6, name: "Khác", description: "Các chi phí phát sinh khác" },
  ];

  for (const t of coreTypes) {
    console.log(`Updating core type ID ${t.id} to "${t.name}"...`);
    await db.update(expenseType)
      .set({ name: t.name, description: t.description })
      .where(eq(expenseType.expenseTypeId, t.id));
  }

  // 3. Delete redundant types (ID > 6)
  console.log("Deleting redundant types (ID > 6)...");
  await db.delete(expenseType)
    .where(sql`expense_type_id > 6`);

  console.log("--- Standardization Complete ---");
  process.exit(0);
}

standardize().catch(err => {
  console.error(err);
  process.exit(1);
});
