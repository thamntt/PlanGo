import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  expenses,
  expenseSplits,
  type Expense,
  type InsertExpense,
  type InsertExpenseSplit,
} from "../../../shared/schema";

export const expenseRepo = {
  async getExpense(id: number) {
    const [r] = await db.select().from(expenses).where(eq(expenses.expenseId, id));
    return r;
  },

  async getExpensesByTrip(tripId: number) {
    return db.select().from(expenses).where(eq(expenses.tripId, tripId));
  },

  async createExpense(data: InsertExpense) {
    const [r] = await db.insert(expenses).values(data).returning();
    return r;
  },

  async updateExpense(id: number, data: Partial<Expense>) {
    const [r] = await db.update(expenses).set(data).where(eq(expenses.expenseId, id)).returning();
    return r;
  },

  async deleteExpense(id: number) {
    const r = await db.delete(expenses).where(eq(expenses.expenseId, id)).returning();
    return r.length > 0;
  },

  // ─── Splits ───
  async getExpenseSplits(expenseId: number) {
    return db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  },

  async createExpenseSplit(data: InsertExpenseSplit) {
    const [r] = await db.insert(expenseSplits).values(data).returning();
    return r;
  },

  async deleteExpenseSplits(expenseId: number) {
    const r = await db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId)).returning();
    return r.length > 0;
  },
};
