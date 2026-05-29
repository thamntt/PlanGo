import { eq } from "drizzle-orm";
import { db } from "../db";
import { notes, type Note, type InsertNote } from "../../shared/schema";

export const noteRepo = {
  async getNote(id: number) {
    const [r] = await db.select().from(notes).where(eq(notes.noteId, id));
    return r;
  },

  async getNotesByItem(itemId: number) {
    return db.select().from(notes).where(eq(notes.itemId, itemId));
  },

  async getNotesByExpense(expenseId: number) {
    return db.select().from(notes).where(eq(notes.expenseId, expenseId));
  },

  async createNote(data: InsertNote) {
    const [r] = await db.insert(notes).values(data).returning();
    return r;
  },

  async updateNote(id: number, data: Partial<Note>) {
    const [r] = await db.update(notes).set(data).where(eq(notes.noteId, id)).returning();
    return r;
  },

  async deleteNote(id: number) {
    const r = await db.delete(notes).where(eq(notes.noteId, id)).returning();
    return r.length > 0;
  },
};
