import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  forumThreads,
  forumReplies,
  forumVotes,
  forumThreadTags,
  forumPolls,
  forumPollOptions,
  forumPollVotes,
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

const FORUM_LABEL_TO_KEY: Record<string, string[]> = {
  "câu hỏi": ["question"],
  "thảo luận": ["discussion"],
  mẹo: ["tip"],
  "mẹo hay": ["tip"],
  "gợi ý": ["recommendation"],
};

function resolveForumCategoryKeys(search: string): string[] {
  const q = search.trim().toLowerCase();
  const keys = new Set<string>();
  for (const [label, ks] of Object.entries(FORUM_LABEL_TO_KEY)) {
    if (label.includes(q) || q.includes(label)) ks.forEach((k) => keys.add(k));
  }
  return [...keys];
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
        updatedAt: forumThreads.updatedAt,
        authorName: sql<string>`COALESCE(${users.fullName}, ${users.userName})`,
        authorHandle: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
        authorRole: users.role,
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
      const q = `%${filters.search}%`;
      const catKeys = resolveForumCategoryKeys(filters.search);
      conds.push(
        sql`(
          ${forumThreads.title} ILIKE ${q}
          OR ${forumThreads.body} ILIKE ${q}
          OR ${destinations.name} ILIKE ${q}
          OR EXISTS (
            SELECT 1 FROM ${forumThreadTags} ftt
            JOIN ${communityTags} ct ON ct.tag_id = ftt.tag_id
            WHERE ftt.thread_id = ${forumThreads.threadId} AND ct.name ILIKE ${q}
          )
          ${catKeys.length ? sql`OR ${forumThreads.category} IN (${sql.join(catKeys.map((k) => sql`${k}`), sql`, `)})` : sql``}
        )`,
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
        updatedAt: forumThreads.updatedAt,
        authorName: sql<string>`COALESCE(${users.fullName}, ${users.userName})`,
        authorHandle: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
        authorRole: users.role,
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

    const poll = await this.getPollForThread(threadId, viewerId);

    return {
      ...thread,
      tags: tagsRows,
      myVote: (myThreadVote[0]?.voteType as string | undefined) || null,
      poll,
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

  /**
   * Edit thread title/body. Constraints:
   * - Owner only
   * - Within EDIT_WINDOW_MS (1 hour) of creation
   * - Thread status !== "solved" (can't edit a question that's already been answered)
   * Returns:
   *   { ok: false, reason: "not_owner" | "expired" | "solved" | "not_found" }
   *   { ok: true, thread }
   */
  async updateThread(
    threadId: number,
    authorId: number,
    input: {
      title?: string;
      body?: string;
      category?: string | null;
      destinationId?: number | null;
    },
  ): Promise<{ ok: false; reason: string } | { ok: true; thread: any }> {
    const EDIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const [thread] = await db
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.threadId, threadId));
    if (!thread) return { ok: false, reason: "not_found" };
    if (thread.authorId !== authorId) return { ok: false, reason: "not_owner" };
    if (thread.status === "solved") return { ok: false, reason: "solved" };
    const createdMs = new Date(thread.createdAt ?? Date.now()).getTime();
    if (Date.now() - createdMs > EDIT_WINDOW_MS) return { ok: false, reason: "expired" };
    const updates: any = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.body !== undefined) updates.body = input.body;
    if (input.category !== undefined) updates.category = input.category;
    if (input.destinationId !== undefined) updates.destinationId = input.destinationId;
    const [updated] = await db
      .update(forumThreads)
      .set(updates)
      .where(eq(forumThreads.threadId, threadId))
      .returning();
    return { ok: true, thread: updated };
  },

  async updateReply(replyId: number, authorId: number, body: string) {
    // No time limit (Reddit pattern); transparency via updatedAt indicator
    const [updated] = await db
      .update(forumReplies)
      .set({ body, updatedAt: new Date() })
      .where(and(eq(forumReplies.replyId, replyId), eq(forumReplies.authorId, authorId)))
      .returning();
    return updated || null;
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
        updatedAt: forumReplies.updatedAt,
        authorName: sql<string>`COALESCE(${users.fullName}, ${users.userName})`,
        authorHandle: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
        authorRole: users.role,
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
    // Only thread author can accept. Toggle: if already accepted → un-accept.
    const [thread] = await db
      .select()
      .from(forumThreads)
      .where(eq(forumThreads.threadId, threadId));
    if (!thread || thread.authorId !== authorId) return false;

    const isAlreadyAccepted = thread.acceptedReplyId === replyId;
    await db
      .update(forumThreads)
      .set(
        isAlreadyAccepted
          ? { acceptedReplyId: null, status: "open" }
          : { acceptedReplyId: replyId, status: "solved" },
      )
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

  // ─── Polls ────────────────────────────────────────────────
  async createPoll(input: { threadId: number; question?: string | null; options: string[] }) {
    const cleanOptions = input.options
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
      .slice(0, 6);
    if (cleanOptions.length < 2) {
      throw new Error("Thăm dò cần ít nhất 2 lựa chọn");
    }
    const [poll] = await db
      .insert(forumPolls)
      .values({
        threadId: input.threadId,
        question: input.question?.trim() || null,
      })
      .returning();
    await db.insert(forumPollOptions).values(
      cleanOptions.map((text, i) => ({
        pollId: poll.pollId,
        optionText: text,
        position: i,
      })),
    );
    return poll;
  },

  async getPollForThread(threadId: number, viewerId?: number) {
    const [poll] = await db.select().from(forumPolls).where(eq(forumPolls.threadId, threadId));
    if (!poll) return null;
    const options = await db
      .select()
      .from(forumPollOptions)
      .where(eq(forumPollOptions.pollId, poll.pollId))
      .orderBy(forumPollOptions.position);
    let myVote: number | null = null;
    if (viewerId) {
      const [v] = await db
        .select({ optionId: forumPollVotes.optionId })
        .from(forumPollVotes)
        .where(and(eq(forumPollVotes.pollId, poll.pollId), eq(forumPollVotes.userId, viewerId)));
      if (v) myVote = v.optionId;
    }
    const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
    return { ...poll, options, totalVotes, myVote };
  },

  async votePoll(pollId: number, optionId: number, userId: number) {
    // Verify option belongs to poll
    const [opt] = await db
      .select({ pollId: forumPollOptions.pollId })
      .from(forumPollOptions)
      .where(eq(forumPollOptions.optionId, optionId));
    if (!opt || opt.pollId !== pollId) {
      throw new Error("Option does not belong to poll");
    }

    // Check existing vote
    const [existing] = await db
      .select({ optionId: forumPollVotes.optionId })
      .from(forumPollVotes)
      .where(and(eq(forumPollVotes.pollId, pollId), eq(forumPollVotes.userId, userId)));

    if (existing) {
      if (existing.optionId === optionId) {
        // Same option → toggle off
        await db
          .delete(forumPollVotes)
          .where(and(eq(forumPollVotes.pollId, pollId), eq(forumPollVotes.userId, userId)));
        await db
          .update(forumPollOptions)
          .set({ voteCount: sql`GREATEST(0, ${forumPollOptions.voteCount} - 1)` })
          .where(eq(forumPollOptions.optionId, optionId));
        return { voted: null as number | null };
      }
      // Different option → switch
      await db
        .update(forumPollOptions)
        .set({ voteCount: sql`GREATEST(0, ${forumPollOptions.voteCount} - 1)` })
        .where(eq(forumPollOptions.optionId, existing.optionId));
      await db
        .update(forumPollVotes)
        .set({ optionId, createdAt: new Date() })
        .where(and(eq(forumPollVotes.pollId, pollId), eq(forumPollVotes.userId, userId)));
      await db
        .update(forumPollOptions)
        .set({ voteCount: sql`${forumPollOptions.voteCount} + 1` })
        .where(eq(forumPollOptions.optionId, optionId));
      return { voted: optionId };
    }

    // First-time vote
    await db.insert(forumPollVotes).values({ pollId, userId, optionId });
    await db
      .update(forumPollOptions)
      .set({ voteCount: sql`${forumPollOptions.voteCount} + 1` })
      .where(eq(forumPollOptions.optionId, optionId));
    return { voted: optionId };
  },
};
