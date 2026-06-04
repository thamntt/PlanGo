import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { notifications, type Notification, type InsertNotification } from "../../../shared/schema";

export const notificationRepo = {
  async getNotification(id: number) {
    const [r] = await db.select().from(notifications).where(eq(notifications.notificationId, id));
    return r;
  },

  async getNotifications() {
    return db.select().from(notifications);
  },

  async getNotificationsByUser(userId: number) {
    return db.select().from(notifications).where(eq(notifications.userId, userId));
  },

  async createNotification(data: InsertNotification) {
    const [r] = await db.insert(notifications).values(data).returning();
    return r;
  },

  async updateNotification(id: number, data: Partial<Notification>) {
    const [r] = await db
      .update(notifications)
      .set(data)
      .where(eq(notifications.notificationId, id))
      .returning();
    return r;
  },

  async deleteNotification(id: number) {
    const r = await db
      .delete(notifications)
      .where(eq(notifications.notificationId, id))
      .returning();
    return r.length > 0;
  },

  async markNotificationsRead(userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  },
};
