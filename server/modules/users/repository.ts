import { eq, ilike } from "drizzle-orm";
import { db } from "../../db";
import {
  users,
  type User,
  type InsertUser,
} from "../../../shared/schema";

export const userRepo = {
  async getUser(id: number): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.userId, id));
    return row;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(ilike(users.email, email.toLowerCase()));
    return row;
  },

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.userName, username));
    return row;
  },

  async getUsers(search?: string): Promise<User[]> {
    if (search) {
      return db.select().from(users).where(ilike(users.userName, `%${search}%`));
    }
    return db.select().from(users);
  },

  async getUserByProviderIdentity(
    provider: string,
    providerUserId: string,
  ): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.providerUserId, providerUserId));
    if (!row) return undefined;
    return row.provider === provider ? row : undefined;
  },

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.resetToken, token));
    return row;
  },

  async createUser(data: InsertUser): Promise<User> {
    const [row] = await db.insert(users).values(data).returning();
    return row;
  },

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    if (Object.keys(data).length === 0) {
      return userRepo.getUser(id);
    }
    const [row] = await db.update(users).set(data).where(eq(users.userId, id)).returning();
    return row;
  },

  async deleteUser(id: number): Promise<boolean> {
    const res = await db.delete(users).where(eq(users.userId, id)).returning();
    return res.length > 0;
  },

  async seedAdminUser(): Promise<void> {
    const existing = await userRepo.getUserByEmail("admin@plango.vn");
    if (!existing) {
      await userRepo.createUser({
        userName: "admin",
        email: "admin@plango.vn",
        password: "admin123",
        role: "admin",
        status: "active",
      });
      console.log("[Seed] Admin user created: admin@plango.vn / admin123");
    }
  },
};
