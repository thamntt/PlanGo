import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  forumThreads,
  forumReplies,
  forumVotes,
  forumThreadTags,
  communityTags,
  users,
  userFollows,
  destinations,
} from "../../../shared/schema";

interface ListFilters {
  destinationId?: number;
  category?: string;
  status?: string;
  search?: string;
  sort?: "latest" | "popular" | "unanswered";
  limit?: number;
  offset?: number;
  authorId?: number;
  followingOnly?: boolean;
}

export const forumRepo = {
  async listThreads(filters: ListFilters = {}, viewerId?: number) {
    let query = db
      .select({
        threadId: forumThreads.threadId,
        authorId: forumThreads.authorId,
        title: forumThreads.title,
        body: forumThreads.body,
        destinationId: forumThreads.destinationId,
        category: forumThreads.category,
        status: forumThreads.status,
        acceptedReplyId: forumThreads.acceptedReplyId,
        viewCount: forumThreads.viewCount,
        replyCount: forumThreads.replyCount,
        upvotes: forumThreads.upvotes,
        downvotes: forumThreads.downvotes,
        isPinned: forumThreads.isPinned,
        lastReplyAt: forumThreads.lastReplyAt,
        createdAt: forumThreads.createdAt,
        authorName: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
        destinationName: destinations.name,
      })
      .from(forumThreads)
      .innerJoin(users, eq(forumThreads.authorId, users.userId))
      .leftJoin(destinations, eq(forumThreads.destinationId, destinations.destinationId))
      .$dynamic();

    const conds: any[] = [];
    if (filters.destinationId) conds.push(eq(forumThreads.destinationId, filters.destinationId));
    if (filters.category) conds.push(eq(forumThreads.category, filters.category));
    if (filters.status) conds.push(eq(forumThreads.status, filters.status));
    if (filters.search) {
      conds.push(
        sql`(${forumThreads.title} ILIKE ${`%${filters.search}%`} OR ${forumThreads.body} ILIKE ${`%${filters.search}%`})`,
      );
    }
    if (filters.sort === "unanswered") {
      conds.push(eq(forumThreads.replyCount, 0));
    }
    if (filters.authorId) conds.push(eq(forumThreads.authorId, filters.authorId));
    if (filters.followingOnly) {
      if (!viewerId) return [];
      const followedRows = await db
        .select({ followedId: userFollows.followedId })
        .from(userFollows)
        .where(eq(userFollows.followerId, viewerId));
      const followedIds = followedRows.map((r) => r.followedId);
      if (followedIds.length === 0) return [];
      conds.push(inArray(forumThreads.authorId, followedIds));
    }
    if (conds.length > 0) query = query.where(and(...conds));

    if (filters.sort === "popular") {
      query = query.orderBy(desc(forumThreads.upvotes), desc(forumThreads.createdAt));
    } else {
      query = query.orderBy(
        desc(forumThreads.isPinned),
        desc(forumThreads.lastReplyAt),
        desc(forumThreads.createdAt),
      );
    }

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);

    const rows = await query;

    const threadIds = rows.map((r) => r.threadId);
    if (threadIds.length === 0) return [];

    const [tagsRows, votesRows] = await Promise.all([
      db
        .select({
          threadId: forumThreadTags.threadId,
          tagId: communityTags.tagId,
          name: communityTags.name,
          color: communityTags.color,
        })
        .from(forumThreadTags)
        .innerJoin(communityTags, eq(forumThreadTags.tagId, communityTags.tagId))
        .where(inArray(forumThreadTags.threadId, threadIds)),
      viewerId
        ? db
            .select({ targetId: forumVotes.targetId, voteType: forumVotes.voteType })
            .from(forumVotes)
            .where(
              and(
                eq(forumVotes.userId, viewerId),
                eq(forumVotes.targetType, "thread"),
                inArray(forumVotes.targetId, threadIds),
              ),
            )
        : Promise.resolve([]),
    ]);

    const tagsByThread = new Map<number, any[]>();
    for (const t of tagsRows) {
      if (!tagsByThread.has(t.threadId)) tagsByThread.set(t.threadId, []);
      tagsByThread.get(t.threadId)!.push({ tagId: t.tagId, name: t.name, color: t.color });
    }
    const myVotes = new Map<number, string>();
    for (const v of votesRows) myVotes.set(v.targetId, v.voteType);

    return rows.map((r) => ({
      ...r,
      tags: tagsByThread.get(r.threadId) || [],
      myVote: myVotes.get(r.threadId) || null,
    }));
  },

  async getThread(threadId: number, viewerId?: number) {
    const [thread] = await db
      .select({
        threadId: forumThreads.threadId,
        authorId: forumThreads.authorId,
        title: forumThreads.title,
        body: forumThreads.body,
        destinationId: forumThreads.destinationId,
        category: forumThreads.category,
        status: forumThreads.status,
        acceptedReplyId: forumThreads.acceptedReplyId,
        viewCount: forumThreads.viewCount,
        replyCount: forumThreads.replyCount,
        upvotes: forumThreads.upvotes,
        downvotes: forumThreads.downvotes,
        isPinned: forumThreads.isPinned,
        lastReplyAt: forumThreads.lastReplyAt,
        createdAt: forumThreads.createdAt,
        authorName: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
        destinationName: destinations.name,
      })
      .from(forumThreads)
      .innerJoin(users, eq(forumThreads.authorId, users.userId))
      .leftJoin(destinations, eq(forumThreads.destinationId, destinations.destinationId))
      .where(eq(forumThreads.threadId, threadId));
    if (!thread) return null;

    const [tagsRows, myThreadVote] = await Promise.all([
      db
        .select({
          tagId: communityTags.tagId,
          name: communityTags.name,
          color: communityTags.color,
        })
        .from(forumThreadTags)
        .innerJoin(communityTags, eq(forumThreadTags.tagId, communityTags.tagId))
        .where(eq(forumThreadTags.threadId, threadId)),
      viewerId
        ? db
            .select({ voteType: forumVotes.voteType })
            .from(forumVotes)
            .where(
              and(
                eq(forumVotes.userId, viewerId),
                eq(forumVotes.targetType, "thread"),
                eq(forumVotes.targetId, threadId),
              ),
            )
        : Promise.resolve([]),
    ]);

    return {
      ...thread,
      tags: tagsRows,
      myVote: (myThreadVote[0]?.voteType as string | undefined) || null,
    };
  },

  async incrementView(threadId: number) {
    await db
      .update(forumThreads)
      .set({ viewCount: sql`${forumThreads.viewCount} + 1` })
      .where(eq(forumThreads.threadId, threadId));
  },

  async createThread(data: {
    authorId: number;
    title: string;
    body: string;
    destinationId?: number | null;
    category?: string;
    tagIds?: number[];
  }) {
    const [thread] = await db
      .insert(forumThreads)
      .values({
        authorId: data.authorId,
        title: data.title,
        body: data.body,
        destinationId: data.destinationId ?? null,
        category: data.category,
      })
      .returning();

    if (data.tagIds?.length) {
      await db
        .insert(forumThreadTags)
        .values(data.tagIds.map((tagId) => ({ threadId: thread.threadId, tagId })));
    }
    return thread;
  },

  async deleteThread(threadId: number, authorId: number) {
    const result = await db
      .delete(forumThreads)
      .where(and(eq(forumThreads.threadId, threadId), eq(forumThreads.authorId, authorId)))
      .returning();
    return result.length > 0;
  },

  // ─── Replies ──
  async listReplies(threadId: number, viewerId?: number) {
    const rows = await db
      .select({
        replyId: forumReplies.replyId,
        threadId: forumReplies.threadId,
        authorId: forumReplies.authorId,
        parentReplyId: forumReplies.parentReplyId,
        body: forumReplies.body,
        upvotes: forumReplies.upvotes,
        downvotes: forumReplies.downvotes,
        createdAt: forumReplies.createdAt,
        authorName: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
      })
      .from(forumReplies)
      .innerJoin(users, eq(forumReplies.authorId, users.userId))
      .where(eq(forumReplies.threadId, threadId))
      .orderBy(forumReplies.createdAt);

    if (rows.length === 0) return [];

    const replyIds = rows.map((r) => r.replyId);
    const myVotes = viewerId
      ? await db
          .select({ targetId: forumVotes.targetId, voteType: forumVotes.voteType })
          .from(forumVotes)
          .where(
            and(
              eq(forumVotes.userId, viewerId),
              eq(forumVotes.targetType, "reply"),
              inArray(forumVotes.targetId, replyIds),
            ),
          )
      : [];
    const myVotesMap = new Map<number, string>();
    for (const v of myVotes) myVotesMap.set(v.targetId, v.voteType);

    return rows.map((r) => ({ ...r, myVote: myVotesMap.get(r.replyId) || null }));
  },

  async createReply(data: {
    threadId: number;
    authorId: number;
    body: string;
    parentReplyId?: number | null;
  }) {
    const [reply] = await db.insert(forumReplies).values(data).returning();
    await db
      .update(forumThreads)
      .set({
        replyCount: sql`${forumThreads.replyCount} + 1`,
        lastReplyAt: new Date(),
      })
      .where(eq(forumThreads.threadId, data.threadId));
    return reply;
  },

  async deleteReply(replyId: number, authorId: number) {
    const [reply] = await db
      .delete(forumReplies)
      .where(and(eq(forumReplies.replyId, replyId), eq(forumReplies.authorId, authorId)))
      .returning();
    if (reply) {
      await db
        .update(forumThreads)
        .set({ replyCount: sql`GREATEST(0, ${forumThreads.replyCount} - 1)` })
        .where(eq(forumThreads.threadId, reply.threadId));
    }
    return !!reply;
  },

  async acceptReply(threadId: number, replyId: number, authorId: number) {
    // Only thread author can accept
    const [thread] = await db
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.threadId, threadId));
    if (!thread || thread.authorId !== authorId) return false;
    await db
      .update(forumThreads)
      .set({ acceptedReplyId: replyId, status: "solved" })
      .where(eq(forumThreads.threadId, threadId));
    return true;
  },

  // ─── Votes ──
  async vote(
    targetType: "thread" | "reply",
    targetId: number,
    userId: number,
    voteType: "up" | "down" | "clear",
  ) {
    const [existing] = await db
      .select()
      .from(forumVotes)
      .where(
        and(
          eq(forumVotes.userId, userId),
          eq(forumVotes.targetType, targetType),
          eq(forumVotes.targetId, targetId),
        ),
      );

    let upDelta = 0;
    let downDelta = 0;

    if (existing) {
      if (existing.voteType === "up") upDelta -= 1;
      else if (existing.voteType === "down") downDelta -= 1;

      if (voteType === "clear") {
        await db
          .delete(forumVotes)
          .where(
            and(
              eq(forumVotes.userId, userId),
              eq(forumVotes.targetType, targetType),
              eq(forumVotes.targetId, targetId),
            ),
          );
      } else {
        await db
          .update(forumVotes)
          .set({ voteType })
          .where(
            and(
              eq(forumVotes.userId, userId),
              eq(forumVotes.targetType, targetType),
              eq(forumVotes.targetId, targetId),
            ),
          );
        if (voteType === "up") upDelta += 1;
        else downDelta += 1;
      }
    } else if (voteType !== "clear") {
      await db.insert(forumVotes).values({ userId, targetType, targetId, voteType });
      if (voteType === "up") upDelta += 1;
      else downDelta += 1;
    }

    const table = targetType === "thread" ? forumThreads : forumReplies;
    const idCol = targetType === "thread" ? forumThreads.threadId : forumReplies.replyId;
    await db
      .update(table as any)
      .set({
        upvotes: sql`GREATEST(0, ${table.upvotes} + ${upDelta})`,
        downvotes: sql`GREATEST(0, ${table.downvotes} + ${downDelta})`,
      })
      .where(eq(idCol as any, targetId));

    return { upDelta, downDelta, newVote: voteType === "clear" ? null : voteType };
  },
};
