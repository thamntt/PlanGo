import { eq, and, asc, inArray } from "drizzle-orm";
import { db } from "../../db";
import { tripTasks, users, type TripTask, type InsertTripTask } from "../../../shared/schema";

/**
 * Tasks come back with the assignee's display fields joined so the FE
 * doesn't need a second roundtrip. Ordered by orderIndex (manual drag order)
 * then createdAt as a tiebreaker — matches what users expect from a
 * Wanderlog-style checklist.
 */
export const tripTaskRepo = {
  async listByTrip(tripId: number) {
    const rows = await db
      .select({
        taskId: tripTasks.taskId,
        tripId: tripTasks.tripId,
        title: tripTasks.title,
        description: tripTasks.description,
        category: tripTasks.category,
        assigneeUserId: tripTasks.assigneeUserId,
        assigneeName: users.fullName,
        assigneeUserName: users.userName,
        assigneeAvatarUrl: users.avatarUrl,
        dueDate: tripTasks.dueDate,
        isCompleted: tripTasks.isCompleted,
        completedAt: tripTasks.completedAt,
        completedByUserId: tripTasks.completedByUserId,
        createdByUserId: tripTasks.createdByUserId,
        orderIndex: tripTasks.orderIndex,
        createdAt: tripTasks.createdAt,
      })
      .from(tripTasks)
      .leftJoin(users, eq(tripTasks.assigneeUserId, users.userId))
      .where(eq(tripTasks.tripId, tripId))
      .orderBy(asc(tripTasks.orderIndex), asc(tripTasks.createdAt));
    return rows;
  },

  async getById(taskId: number) {
    const [row] = await db.select().from(tripTasks).where(eq(tripTasks.taskId, taskId));
    return row;
  },

  async create(data: InsertTripTask) {
    const [row] = await db.insert(tripTasks).values(data).returning();
    return row;
  },

  async update(taskId: number, data: Partial<TripTask>) {
    const [row] = await db
      .update(tripTasks)
      .set(data)
      .where(eq(tripTasks.taskId, taskId))
      .returning();
    return row;
  },

  async delete(taskId: number) {
    const res = await db
      .delete(tripTasks)
      .where(eq(tripTasks.taskId, taskId))
      .returning();
    return res.length > 0;
  },

  async reorder(tripId: number, taskIds: number[]) {
    // Set orderIndex = position for each id. Run sequentially so a partial
    // failure leaves a coherent (if outdated) ordering instead of garbage.
    for (let i = 0; i < taskIds.length; i++) {
      await db
        .update(tripTasks)
        .set({ orderIndex: i })
        .where(and(eq(tripTasks.tripId, tripId), eq(tripTasks.taskId, taskIds[i])));
    }
  },

  async getMaxOrderIndex(tripId: number) {
    const rows = await db
      .select({ orderIndex: tripTasks.orderIndex })
      .from(tripTasks)
      .where(eq(tripTasks.tripId, tripId));
    return rows.reduce((max, r) => Math.max(max, r.orderIndex || 0), -1);
  },

  async deleteByTrip(tripId: number) {
    await db.delete(tripTasks).where(eq(tripTasks.tripId, tripId));
  },

  async deleteBulk(taskIds: number[]) {
    if (taskIds.length === 0) return;
    await db.delete(tripTasks).where(inArray(tripTasks.taskId, taskIds));
  },
};
