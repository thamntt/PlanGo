import { db } from "../server/db";
import { itineraryItems, expenses, expenseType } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function checkUsage() {
  console.log("--- Expense Type Usage ---");
  const types = await db.select().from(expenseType);
  console.log("Existing types:", JSON.stringify(types, null, 2));

  const itemUsage = await db.select({
    id: itineraryItems.expenseTypeId,
    count: sql<number>`count(*)`
  }).from(itineraryItems).groupBy(itineraryItems.expenseTypeId);
  console.log("Itinerary Items Usage:", JSON.stringify(itemUsage, null, 2));

  const expenseUsage = await db.select({
    id: expenses.expenseTypeId,
    count: sql<number>`count(*)`
  }).from(expenses).groupBy(expenses.expenseTypeId);
  console.log("Expenses Usage:", JSON.stringify(expenseUsage, null, 2));

  process.exit(0);
}

checkUsage().catch(err => {
  console.error(err);
  process.exit(1);
});
