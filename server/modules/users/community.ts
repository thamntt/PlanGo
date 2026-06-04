import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { users, userFollows, blogPosts, forumThreads, forumReplies } from "../../../shared/schema";

export const userCommunityRepo = {
  /**
   * Public profile (with viewer-aware flags).
   * Used by /api/users/:id/profile
   */
  async getProfile(userId: number, viewerId?: number) {
    const [u] = await db
      .select({
        userId: users.userId,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        reviewerLevel: users.reviewerLevel,
        reviewCount: users.reviewCount,
        helpfulReceived: users.helpfulReceived,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.userId, userId));

    if (!u) return null;

    const [postRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(and(eq(blogPosts.authorId, userId), eq(blogPosts.status, "published")));

    const [threadRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(forumThreads)
      .where(eq(forumThreads.authorId, userId));

    const [replyRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(forumReplies)
      .where(eq(forumReplies.authorId, userId));

    const [followerRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.followedId, userId));

    const [followingRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));

    let isFollowing = false;
    if (viewerId && viewerId !== userId) {
      const [f] = await db
        .select({ x: userFollows.followerId })
        .from(userFollows)
        .where(and(eq(userFollows.followerId, viewerId), eq(userFollows.followedId, userId)));
      isFollowing = !!f;
    }

    return {
      ...u,
      postCount: postRow?.c ?? 0,
      threadCount: threadRow?.c ?? 0,
      replyCount: replyRow?.c ?? 0,
      followerCount: followerRow?.c ?? 0,
      followingCount: followingRow?.c ?? 0,
      isFollowing,
      isOwnProfile: viewerId === userId,
    };
  },

  /** Toggle follow. Returns the new state. */
  async toggleFollow(viewerId: number, followedId: number) {
    if (viewerId === followedId) {
      throw new Error("Cannot follow yourself");
    }
    const [existing] = await db
      .select({ x: userFollows.followerId })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, viewerId), eq(userFollows.followedId, followedId)));

    if (existing) {
      await db
        .delete(userFollows)
        .where(and(eq(userFollows.followerId, viewerId), eq(userFollows.followedId, followedId)));
      return { following: false };
    }

    await db.insert(userFollows).values({
      followerId: viewerId,
      followedId,
    });
    return { following: true };
  },

  /** List followers of a user */
  async listFollowers(userId: number) {
    return db
      .select({
        userId: users.userId,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        reviewerLevel: users.reviewerLevel,
        followedAt: userFollows.createdAt,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followerId, users.userId))
      .where(eq(userFollows.followedId, userId))
      .orderBy(desc(userFollows.createdAt));
  },

  /** List who a user is following */
  async listFollowing(userId: number) {
    return db
      .select({
        userId: users.userId,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        reviewerLevel: users.reviewerLevel,
        followedAt: userFollows.createdAt,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followedId, users.userId))
      .where(eq(userFollows.followerId, userId))
      .orderBy(desc(userFollows.createdAt));
  },
};
