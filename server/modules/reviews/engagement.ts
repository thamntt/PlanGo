/**
 * Review engagement: helpful votes, threaded replies, content reports.
 * Phase 1.5 community features around existing trip_reviews.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  reviewVotes,
  reviewReplies,
  contentReports,
  users,
  tripReviews,
} from "../../../shared/schema";

export const engagementRepo = {
  // ─── Helpful votes ───────────────────────────────────────
  async setVote(
    reviewUserId: number,
    reviewTripId: number,
    voterUserId: number,
    voteType: "helpful" | "not_helpful",
  ) {
    // Upsert: replaces existing vote (PK conflict)
    await db
      .insert(reviewVotes)
      .values({ reviewUserId, reviewTripId, voterUserId, voteType })
      .onConflictDoUpdate({
        target: [reviewVotes.reviewUserId, reviewVotes.reviewTripId, reviewVotes.voterUserId],
        set: { voteType },
      });
    return engagementRepo.getVoteSummary(reviewUserId, reviewTripId, voterUserId);
  },

  async removeVote(reviewUserId: number, reviewTripId: number, voterUserId: number) {
    await db
      .delete(reviewVotes)
      .where(
        and(
          eq(reviewVotes.reviewUserId, reviewUserId),
          eq(reviewVotes.reviewTripId, reviewTripId),
          eq(reviewVotes.voterUserId, voterUserId),
        ),
      );
    return engagementRepo.getVoteSummary(reviewUserId, reviewTripId, voterUserId);
  },

  async getVoteSummary(reviewUserId: number, reviewTripId: number, voterUserId?: number) {
    const counts = await db
      .select({
        voteType: reviewVotes.voteType,
        count: sql<string>`count(*)`,
      })
      .from(reviewVotes)
      .where(
        and(eq(reviewVotes.reviewUserId, reviewUserId), eq(reviewVotes.reviewTripId, reviewTripId)),
      )
      .groupBy(reviewVotes.voteType);

    let helpful = 0;
    let notHelpful = 0;
    for (const c of counts) {
      const n = parseInt(c.count, 10);
      if (c.voteType === "helpful") helpful = n;
      else if (c.voteType === "not_helpful") notHelpful = n;
    }

    let myVote: "helpful" | "not_helpful" | null = null;
    if (voterUserId) {
      const [mine] = await db
        .select({ voteType: reviewVotes.voteType })
        .from(reviewVotes)
        .where(
          and(
            eq(reviewVotes.reviewUserId, reviewUserId),
            eq(reviewVotes.reviewTripId, reviewTripId),
            eq(reviewVotes.voterUserId, voterUserId),
          ),
        );
      if (mine) myVote = mine.voteType as any;
    }

    return { helpful, notHelpful, myVote };
  },

  // ─── Replies ─────────────────────────────────────────────
  async listReplies(parentReviewUserId: number, parentReviewTripId: number) {
    return db
      .select({
        replyId: reviewReplies.replyId,
        parentReviewUserId: reviewReplies.parentReviewUserId,
        parentReviewTripId: reviewReplies.parentReviewTripId,
        authorId: reviewReplies.authorId,
        authorName: users.userName,
        authorAvatarUrl: users.avatarUrl,
        content: reviewReplies.content,
        createdAt: reviewReplies.createdAt,
      })
      .from(reviewReplies)
      .innerJoin(users, eq(reviewReplies.authorId, users.userId))
      .where(
        and(
          eq(reviewReplies.parentReviewUserId, parentReviewUserId),
          eq(reviewReplies.parentReviewTripId, parentReviewTripId),
        ),
      )
      .orderBy(reviewReplies.createdAt);
  },

  async createReply(data: {
    parentReviewUserId: number;
    parentReviewTripId: number;
    authorId: number;
    content: string;
  }) {
    const [r] = await db.insert(reviewReplies).values(data).returning();
    return r;
  },

  async deleteReply(replyId: number, authorId: number) {
    const result = await db
      .delete(reviewReplies)
      .where(and(eq(reviewReplies.replyId, replyId), eq(reviewReplies.authorId, authorId)))
      .returning();
    return result.length > 0;
  },

  // ─── Reports ─────────────────────────────────────────────
  async createReport(data: {
    contentType: "review" | "reply" | "blog" | "qa";
    contentRefId: string;
    reporterId: number;
    reason: string;
    details?: string;
  }) {
    const [r] = await db.insert(contentReports).values(data).returning();
    return r;
  },

  async listReports(filters?: { status?: string }) {
    if (filters?.status) {
      return db
        .select()
        .from(contentReports)
        .where(eq(contentReports.status, filters.status))
        .orderBy(desc(contentReports.createdAt));
    }
    return db.select().from(contentReports).orderBy(desc(contentReports.createdAt));
  },

  async updateReportStatus(reportId: number, status: string) {
    const [r] = await db
      .update(contentReports)
      .set({ status })
      .where(eq(contentReports.reportId, reportId))
      .returning();
    return r;
  },

  // ─── Reviewer stats (badge level) ────────────────────────
  /**
   * Compute reviewer level from review_count + helpful_received.
   * Updated lazily after vote/review changes.
   */
  async recomputeReviewerStats(userId: number) {
    const [reviewCountRow] = await db
      .select({ c: sql<string>`count(*)` })
      .from(tripReviews)
      .where(eq(tripReviews.userId, userId));
    const [helpfulRow] = await db
      .select({ c: sql<string>`count(*)` })
      .from(reviewVotes)
      .innerJoin(
        tripReviews,
        and(
          eq(reviewVotes.reviewUserId, tripReviews.userId),
          eq(reviewVotes.reviewTripId, tripReviews.tripId),
        ),
      )
      .where(and(eq(tripReviews.userId, userId), eq(reviewVotes.voteType, "helpful")));

    const reviewCount = parseInt(reviewCountRow?.c ?? "0", 10);
    const helpfulReceived = parseInt(helpfulRow?.c ?? "0", 10);

    let level: "newcomer" | "active" | "top" | "legend" = "newcomer";
    if (reviewCount >= 50 && helpfulReceived >= 500) level = "legend";
    else if (reviewCount >= 20 && helpfulReceived >= 100) level = "top";
    else if (reviewCount >= 5) level = "active";

    await db
      .update(users)
      .set({ reviewCount, helpfulReceived, reviewerLevel: level })
      .where(eq(users.userId, userId));

    return { reviewCount, helpfulReceived, reviewerLevel: level };
  },
};
