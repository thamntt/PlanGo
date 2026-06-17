import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  tripInvitations,
  trips,
  users,
  type TripInvitation,
  type InsertTripInvitation,
} from "../../../shared/schema";

/**
 * Joins each invitation row with the inviter, invitee, and trip header so
 * the FE can render "X mời bạn tham gia chuyến Y" without N+1 round-trips.
 */
const SELECT_WITH_JOINS = {
  invitationId: tripInvitations.invitationId,
  tripId: tripInvitations.tripId,
  inviterUserId: tripInvitations.inviterUserId,
  inviteeUserId: tripInvitations.inviteeUserId,
  role: tripInvitations.role,
  status: tripInvitations.status,
  message: tripInvitations.message,
  createdAt: tripInvitations.createdAt,
  respondedAt: tripInvitations.respondedAt,
  // Joined fields
  tripTitle: trips.title,
  tripStartDate: trips.startDate,
  tripEndDate: trips.endDate,
  tripStatus: trips.status,
  tripInvitationToken: trips.invitationToken,
};

export const invitationRepo = {
  async create(data: InsertTripInvitation) {
    const [row] = await db.insert(tripInvitations).values(data).returning();
    return row;
  },

  async findById(id: number) {
    const [row] = await db
      .select(SELECT_WITH_JOINS)
      .from(tripInvitations)
      .innerJoin(trips, eq(tripInvitations.tripId, trips.tripId))
      .where(eq(tripInvitations.invitationId, id));
    return row;
  },

  async findPendingBetween(tripId: number, inviteeUserId: number) {
    const [row] = await db
      .select()
      .from(tripInvitations)
      .where(
        and(
          eq(tripInvitations.tripId, tripId),
          eq(tripInvitations.inviteeUserId, inviteeUserId),
          eq(tripInvitations.status, "pending"),
        ),
      );
    return row;
  },

  async listReceived(inviteeUserId: number) {
    const invitations = await db
      .select(SELECT_WITH_JOINS)
      .from(tripInvitations)
      .innerJoin(trips, eq(tripInvitations.tripId, trips.tripId))
      .where(
        and(
          eq(tripInvitations.inviteeUserId, inviteeUserId),
          eq(tripInvitations.status, "pending"),
        ),
      )
      .orderBy(desc(tripInvitations.createdAt));

    // Hydrate inviter name + avatar in a single batch query.
    const inviterIds = Array.from(
      new Set(invitations.map((i) => i.inviterUserId).filter(Boolean)),
    );
    let inviterMap = new Map<number, { fullName: string | null; userName: string | null; avatarUrl: string | null }>();
    if (inviterIds.length > 0) {
      const rows = await db
        .select({
          userId: users.userId,
          fullName: users.fullName,
          userName: users.userName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.userId, inviterIds));
      inviterMap = new Map(rows.map((r) => [r.userId, r]));
    }

    return invitations.map((inv) => {
      const inviter = inviterMap.get(inv.inviterUserId);
      return {
        ...inv,
        inviterName: inviter?.fullName || inviter?.userName || null,
        inviterUserName: inviter?.userName || null,
        inviterAvatarUrl: inviter?.avatarUrl || null,
      };
    });
  },

  async listSent(inviterUserId: number, opts?: { tripId?: number; status?: string }) {
    const conds = [eq(tripInvitations.inviterUserId, inviterUserId)];
    if (opts?.tripId) conds.push(eq(tripInvitations.tripId, opts.tripId));
    if (opts?.status) conds.push(eq(tripInvitations.status, opts.status));

    const invitations = await db
      .select(SELECT_WITH_JOINS)
      .from(tripInvitations)
      .innerJoin(trips, eq(tripInvitations.tripId, trips.tripId))
      .where(and(...conds))
      .orderBy(desc(tripInvitations.createdAt));

    // Hydrate invitee details for inviter-facing list (so we show "Đã mời
    // X" with avatar + name).
    const inviteeIds = Array.from(
      new Set(invitations.map((i) => i.inviteeUserId).filter(Boolean)),
    );
    let inviteeMap = new Map<number, { fullName: string | null; userName: string | null; avatarUrl: string | null }>();
    if (inviteeIds.length > 0) {
      const rows = await db
        .select({
          userId: users.userId,
          fullName: users.fullName,
          userName: users.userName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.userId, inviteeIds));
      inviteeMap = new Map(rows.map((r) => [r.userId, r]));
    }

    return invitations.map((inv) => {
      const invitee = inviteeMap.get(inv.inviteeUserId);
      return {
        ...inv,
        inviteeName: invitee?.fullName || invitee?.userName || null,
        inviteeUserName: invitee?.userName || null,
        inviteeAvatarUrl: invitee?.avatarUrl || null,
      };
    });
  },

  async update(id: number, data: Partial<TripInvitation>) {
    const [row] = await db
      .update(tripInvitations)
      .set(data)
      .where(eq(tripInvitations.invitationId, id))
      .returning();
    return row;
  },

  async countPending(inviteeUserId: number) {
    const rows = await db
      .select({ id: tripInvitations.invitationId })
      .from(tripInvitations)
      .where(
        and(
          eq(tripInvitations.inviteeUserId, inviteeUserId),
          eq(tripInvitations.status, "pending"),
        ),
      );
    return rows.length;
  },
};
