import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  contentReports,
  blogPosts,
  forumThreads,
  forumReplies,
  blogComments,
  users,
} from "../../../shared/schema";

export type ContentType = "blog" | "forum_thread" | "forum_reply" | "blog_comment";

interface CreateReportInput {
  reporterId: number;
  contentType: ContentType;
  contentRefId: number;
  reason: string; // 'spam'|'harassment'|'misinformation'|'illegal'|'other'
  details?: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REPORTS_PER_AUTHOR_PER_DAY = 2;

export const moderationRepo = {
  /**
   * Create a report. Throws on cooldown / dup.
   * Resolves the content's author so we can enforce reporter cooldown
   * (cannot mass-report same author > N times / day).
   */
  async createReport(input: CreateReportInput) {
    // Check dup — same reporter / same content
    const ref = String(input.contentRefId);
    const [existing] = await db
      .select({ x: contentReports.reportId })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.reporterId, input.reporterId),
          eq(contentReports.contentType, input.contentType),
          eq(contentReports.contentRefId, ref),
        ),
      );
    if (existing) {
      throw new Error("Bạn đã báo cáo nội dung này rồi");
    }

    // Cooldown: cannot report same author > N times / day
    const authorId = await this.getContentAuthor(input.contentType, input.contentRefId);
    if (authorId === input.reporterId) {
      throw new Error("Không thể báo cáo nội dung của chính mình");
    }
    if (authorId) {
      const since = new Date(Date.now() - ONE_DAY_MS);
      const recentReports = await db
        .select({
          contentType: contentReports.contentType,
          contentRefId: contentReports.contentRefId,
        })
        .from(contentReports)
        .where(
          and(
            eq(contentReports.reporterId, input.reporterId),
            gte(contentReports.createdAt, since),
          ),
        );

      // For each recent report, check if its content also belongs to authorId
      let count = 0;
      for (const r of recentReports) {
        const a = await this.getContentAuthor(r.contentType as ContentType, Number(r.contentRefId));
        if (a === authorId) count++;
      }
      if (count >= MAX_REPORTS_PER_AUTHOR_PER_DAY) {
        throw new Error(
          "Bạn đã báo cáo nhiều nội dung của tác giả này hôm nay. Vui lòng thử lại ngày mai.",
        );
      }
    }

    const [created] = await db
      .insert(contentReports)
      .values({
        contentType: input.contentType,
        contentRefId: ref,
        reporterId: input.reporterId,
        reason: input.reason,
        details: input.details,
        status: "pending",
      })
      .returning();
    return created;
  },

  /** Get the author of a piece of content (for cooldown + notification) */
  async getContentAuthor(contentType: ContentType, contentRefId: number): Promise<number | null> {
    if (contentType === "blog") {
      const [r] = await db
        .select({ a: blogPosts.authorId })
        .from(blogPosts)
        .where(eq(blogPosts.postId, contentRefId));
      return r?.a ?? null;
    }
    if (contentType === "forum_thread") {
      const [r] = await db
        .select({ a: forumThreads.authorId })
        .from(forumThreads)
        .where(eq(forumThreads.threadId, contentRefId));
      return r?.a ?? null;
    }
    if (contentType === "forum_reply") {
      const [r] = await db
        .select({ a: forumReplies.authorId })
        .from(forumReplies)
        .where(eq(forumReplies.replyId, contentRefId));
      return r?.a ?? null;
    }
    if (contentType === "blog_comment") {
      const [r] = await db
        .select({ a: blogComments.authorId })
        .from(blogComments)
        .where(eq(blogComments.commentId, contentRefId));
      return r?.a ?? null;
    }
    return null;
  },

  /** Admin queue — sorted by recent reports, with content metadata */
  async listQueue(status: string = "pending", limit = 50) {
    return db
      .select({
        reportId: contentReports.reportId,
        contentType: contentReports.contentType,
        contentRefId: contentReports.contentRefId,
        reporterId: contentReports.reporterId,
        reason: contentReports.reason,
        details: contentReports.details,
        status: contentReports.status,
        createdAt: contentReports.createdAt,
        reporterName: users.userName,
      })
      .from(contentReports)
      .leftJoin(users, eq(contentReports.reporterId, users.userId))
      .where(eq(contentReports.status, status))
      .orderBy(desc(contentReports.createdAt))
      .limit(limit);
  },

  /** Aggregate count per content — to sort queue by hotness */
  async listQueueGrouped(limit = 50) {
    const rows = await db
      .select({
        contentType: contentReports.contentType,
        contentRefId: contentReports.contentRefId,
        reportCount: sql<number>`count(*)::int`,
        latestAt: sql<string>`max(${contentReports.createdAt})`,
      })
      .from(contentReports)
      .where(eq(contentReports.status, "pending"))
      .groupBy(contentReports.contentType, contentReports.contentRefId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows;
  },

  /** Admin resolves a report: status = 'dismissed' (keep content) or 'resolved' (delete content) */
  async resolveReport(reportId: number, status: "resolved" | "dismissed", _adminId: number) {
    const [updated] = await db
      .update(contentReports)
      .set({ status })
      .where(eq(contentReports.reportId, reportId))
      .returning();
    return updated;
  },

  /** Resolve ALL reports for a piece of content (when admin deletes/keeps it) */
  async resolveAllForContent(
    contentType: ContentType,
    contentRefId: number,
    status: "resolved" | "dismissed",
  ) {
    await db
      .update(contentReports)
      .set({ status })
      .where(
        and(
          eq(contentReports.contentType, contentType),
          eq(contentReports.contentRefId, String(contentRefId)),
          eq(contentReports.status, "pending"),
        ),
      );
  },

  /** List a user's own reports — show outcomes for transparency */
  async listMyReports(userId: number) {
    return db
      .select({
        reportId: contentReports.reportId,
        contentType: contentReports.contentType,
        contentRefId: contentReports.contentRefId,
        reason: contentReports.reason,
        status: contentReports.status,
        createdAt: contentReports.createdAt,
      })
      .from(contentReports)
      .where(eq(contentReports.reporterId, userId))
      .orderBy(desc(contentReports.createdAt))
      .limit(100);
  },
};
