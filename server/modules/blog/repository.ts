import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  blogPosts,
  blogPostDestinations,
  blogPostTags,
  blogLikes,
  blogBookmarks,
  blogComments,
  communityTags,
  users,
  userFollows,
  destinations,
  trips,
} from "../../../shared/schema";

interface ListFilters {
  category?: string;
  destinationId?: number;
  authorId?: number;
  tagSlug?: string;
  search?: string;
  sort?: "latest" | "popular" | "trending";
  limit?: number;
  offset?: number;
  followingOnly?: boolean; // posts from users I follow
  likedOnly?: boolean; // posts I have liked
  bookmarkedOnly?: boolean; // posts I have bookmarked
}

export const blogRepo = {
  async listPosts(filters: ListFilters = {}, viewerId?: number) {
    let query = db
      .select({
        postId: blogPosts.postId,
        authorId: blogPosts.authorId,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        coverImage: blogPosts.coverImage,
        category: blogPosts.category,
        readMinutes: blogPosts.readMinutes,
        status: blogPosts.status,
        viewCount: blogPosts.viewCount,
        likeCount: blogPosts.likeCount,
        commentCount: blogPosts.commentCount,
        bookmarkCount: blogPosts.bookmarkCount,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
        authorName: sql<string>`COALESCE(${users.fullName}, ${users.userName})`,
        authorHandle: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
      })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.authorId, users.userId))
      .$dynamic();

    const conds: any[] = [eq(blogPosts.status, "published")];
    if (filters.category) conds.push(eq(blogPosts.category, filters.category));
    if (filters.authorId) conds.push(eq(blogPosts.authorId, filters.authorId));
    if (filters.search) {
      conds.push(
        sql`(${blogPosts.title} ILIKE ${`%${filters.search}%`} OR ${blogPosts.excerpt} ILIKE ${`%${filters.search}%`})`,
      );
    }
    if (filters.destinationId) {
      const linkedPostIds = await db
        .select({ postId: blogPostDestinations.postId })
        .from(blogPostDestinations)
        .where(eq(blogPostDestinations.destinationId, filters.destinationId));
      const ids = linkedPostIds.map((r) => r.postId);
      if (ids.length === 0) return [];
      conds.push(inArray(blogPosts.postId, ids));
    }

    // Viewer-scoped filters (Threads-style menu)
    if (viewerId) {
      if (filters.followingOnly) {
        const followedRows = await db
          .select({ followedId: userFollows.followedId })
          .from(userFollows)
          .where(eq(userFollows.followerId, viewerId));
        const followedIds = followedRows.map((r) => r.followedId);
        if (followedIds.length === 0) return [];
        conds.push(inArray(blogPosts.authorId, followedIds));
      }
      if (filters.likedOnly) {
        const likedRows = await db
          .select({ postId: blogLikes.postId })
          .from(blogLikes)
          .where(eq(blogLikes.userId, viewerId));
        const likedIds = likedRows.map((r) => r.postId);
        if (likedIds.length === 0) return [];
        conds.push(inArray(blogPosts.postId, likedIds));
      }
      if (filters.bookmarkedOnly) {
        const bmRows = await db
          .select({ postId: blogBookmarks.postId })
          .from(blogBookmarks)
          .where(eq(blogBookmarks.userId, viewerId));
        const bmIds = bmRows.map((r) => r.postId);
        if (bmIds.length === 0) return [];
        conds.push(inArray(blogPosts.postId, bmIds));
      }
    } else if (filters.followingOnly || filters.likedOnly || filters.bookmarkedOnly) {
      // Anonymous user requesting viewer-scoped filter → empty
      return [];
    }

    query = query.where(and(...conds));

    // Sort
    if (filters.sort === "popular") {
      query = query.orderBy(desc(blogPosts.likeCount), desc(blogPosts.publishedAt));
    } else if (filters.sort === "trending") {
      query = query.orderBy(desc(blogPosts.viewCount), desc(blogPosts.publishedAt));
    } else {
      query = query.orderBy(desc(blogPosts.publishedAt));
    }

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.offset(filters.offset);

    const rows = await query;

    // Attach viewer flags + tags + destinations
    const postIds = rows.map((r) => r.postId);
    if (postIds.length === 0) return [];

    const [tagsRows, destRows, likedRows, bookmarkedRows] = await Promise.all([
      db
        .select({
          postId: blogPostTags.postId,
          tagId: communityTags.tagId,
          name: communityTags.name,
          color: communityTags.color,
        })
        .from(blogPostTags)
        .innerJoin(communityTags, eq(blogPostTags.tagId, communityTags.tagId))
        .where(inArray(blogPostTags.postId, postIds)),
      db
        .select({
          postId: blogPostDestinations.postId,
          destinationId: destinations.destinationId,
          name: destinations.name,
        })
        .from(blogPostDestinations)
        .innerJoin(destinations, eq(blogPostDestinations.destinationId, destinations.destinationId))
        .where(inArray(blogPostDestinations.postId, postIds)),
      viewerId
        ? db
            .select({ postId: blogLikes.postId })
            .from(blogLikes)
            .where(and(inArray(blogLikes.postId, postIds), eq(blogLikes.userId, viewerId)))
        : Promise.resolve([]),
      viewerId
        ? db
            .select({ postId: blogBookmarks.postId })
            .from(blogBookmarks)
            .where(and(inArray(blogBookmarks.postId, postIds), eq(blogBookmarks.userId, viewerId)))
        : Promise.resolve([]),
    ]);

    const tagsByPost = new Map<number, any[]>();
    for (const t of tagsRows) {
      if (!tagsByPost.has(t.postId)) tagsByPost.set(t.postId, []);
      tagsByPost.get(t.postId)!.push({ tagId: t.tagId, name: t.name, color: t.color });
    }
    const destsByPost = new Map<number, any[]>();
    for (const d of destRows) {
      if (!destsByPost.has(d.postId)) destsByPost.set(d.postId, []);
      destsByPost.get(d.postId)!.push({ destinationId: d.destinationId, name: d.name });
    }
    const likedSet = new Set(likedRows.map((r) => r.postId));
    const bookmarkedSet = new Set(bookmarkedRows.map((r) => r.postId));

    return rows.map((r) => ({
      ...r,
      tags: tagsByPost.get(r.postId) || [],
      destinationsList: destsByPost.get(r.postId) || [],
      isLikedByViewer: likedSet.has(r.postId),
      isBookmarkedByViewer: bookmarkedSet.has(r.postId),
    }));
  },

  async getPost(postId: number, viewerId?: number) {
    const [post] = await db
      .select({
        postId: blogPosts.postId,
        authorId: blogPosts.authorId,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        content: blogPosts.content,
        coverImage: blogPosts.coverImage,
        images: blogPosts.images,
        category: blogPosts.category,
        readMinutes: blogPosts.readMinutes,
        status: blogPosts.status,
        viewCount: blogPosts.viewCount,
        likeCount: blogPosts.likeCount,
        commentCount: blogPosts.commentCount,
        bookmarkCount: blogPosts.bookmarkCount,
        referencedTripId: blogPosts.referencedTripId,
        publishedAt: blogPosts.publishedAt,
        createdAt: blogPosts.createdAt,
        updatedAt: blogPosts.updatedAt,
        authorName: sql<string>`COALESCE(${users.fullName}, ${users.userName})`,
        authorHandle: users.userName,
        authorAvatar: users.avatarUrl,
        authorLevel: users.reviewerLevel,
        authorReviewCount: users.reviewCount,
      })
      .from(blogPosts)
      .innerJoin(users, eq(blogPosts.authorId, users.userId))
      .where(eq(blogPosts.postId, postId));
    if (!post) return null;

    const [tagsRows, destRows, likedRows, bookmarkedRows] = await Promise.all([
      db
        .select({
          tagId: communityTags.tagId,
          name: communityTags.name,
          color: communityTags.color,
        })
        .from(blogPostTags)
        .innerJoin(communityTags, eq(blogPostTags.tagId, communityTags.tagId))
        .where(eq(blogPostTags.postId, postId)),
      db
        .select({
          destinationId: destinations.destinationId,
          name: destinations.name,
          images: destinations.images,
        })
        .from(blogPostDestinations)
        .innerJoin(destinations, eq(blogPostDestinations.destinationId, destinations.destinationId))
        .where(eq(blogPostDestinations.postId, postId)),
      viewerId
        ? db
            .select()
            .from(blogLikes)
            .where(and(eq(blogLikes.postId, postId), eq(blogLikes.userId, viewerId)))
        : Promise.resolve([]),
      viewerId
        ? db
            .select()
            .from(blogBookmarks)
            .where(and(eq(blogBookmarks.postId, postId), eq(blogBookmarks.userId, viewerId)))
        : Promise.resolve([]),
    ]);

    return {
      ...post,
      tags: tagsRows,
      destinationsList: destRows,
      isLikedByViewer: likedRows.length > 0,
      isBookmarkedByViewer: bookmarkedRows.length > 0,
    };
  },

  async incrementView(postId: number) {
    await db
      .update(blogPosts)
      .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.postId, postId));
  },

  async createPost(data: {
    authorId: number;
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    coverImage?: string;
    images?: string[];
    category?: string;
    readMinutes?: number;
    referencedTripId?: number | null;
    tagIds?: number[];
    destinationIds?: number[];
  }) {
    const [post] = await db
      .insert(blogPosts)
      .values({
        authorId: data.authorId,
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        coverImage: data.coverImage,
        images: data.images as any,
        category: data.category,
        readMinutes: data.readMinutes ?? 5,
        referencedTripId: data.referencedTripId ?? null,
      })
      .returning();

    if (data.tagIds?.length) {
      await db
        .insert(blogPostTags)
        .values(data.tagIds.map((tagId) => ({ postId: post.postId, tagId })));
    }
    if (data.destinationIds?.length) {
      await db
        .insert(blogPostDestinations)
        .values(
          data.destinationIds.map((destinationId) => ({ postId: post.postId, destinationId })),
        );
    }
    return post;
  },

  async updatePost(
    postId: number,
    data: Partial<{
      title: string;
      excerpt: string;
      content: string;
      coverImage: string;
      category: string;
      readMinutes: number;
      tagNames: string[];
      destinationIds: number[];
    }>,
  ) {
    // Only update direct columns; tags + destinations handled separately
    const directUpdate: Record<string, any> = { updatedAt: new Date() };
    if (data.title !== undefined) directUpdate.title = data.title;
    if (data.excerpt !== undefined) directUpdate.excerpt = data.excerpt;
    if (data.content !== undefined) directUpdate.content = data.content;
    if (data.coverImage !== undefined) directUpdate.coverImage = data.coverImage;
    if (data.category !== undefined) directUpdate.category = data.category;
    if (data.readMinutes !== undefined) directUpdate.readMinutes = data.readMinutes;

    const [post] = await db
      .update(blogPosts)
      .set(directUpdate)
      .where(eq(blogPosts.postId, postId))
      .returning();

    // Replace tags if provided
    if (data.tagNames !== undefined) {
      await db.delete(blogPostTags).where(eq(blogPostTags.postId, postId));
      if (data.tagNames.length > 0) {
        const tagIds = await this.ensureTags(data.tagNames);
        if (tagIds.length > 0) {
          await db.insert(blogPostTags).values(tagIds.map((tagId) => ({ postId, tagId })));
        }
      }
    }
    // Replace destinations if provided
    if (data.destinationIds !== undefined) {
      await db.delete(blogPostDestinations).where(eq(blogPostDestinations.postId, postId));
      if (data.destinationIds.length > 0) {
        // Validate destination IDs actually exist to avoid FK violation
        const validRows = await db
          .select({ id: destinations.destinationId })
          .from(destinations)
          .where(inArray(destinations.destinationId, data.destinationIds));
        const validIds = validRows.map((r) => r.id);
        if (validIds.length > 0) {
          await db
            .insert(blogPostDestinations)
            .values(validIds.map((destinationId) => ({ postId, destinationId })));
        }
      }
    }
    return post;
  },

  async deletePost(postId: number, authorId: number) {
    const result = await db
      .delete(blogPosts)
      .where(and(eq(blogPosts.postId, postId), eq(blogPosts.authorId, authorId)))
      .returning();
    return result.length > 0;
  },

  // ─── Likes ──
  async toggleLike(postId: number, userId: number) {
    const [existing] = await db
      .select()
      .from(blogLikes)
      .where(and(eq(blogLikes.postId, postId), eq(blogLikes.userId, userId)));

    if (existing) {
      await db
        .delete(blogLikes)
        .where(and(eq(blogLikes.postId, postId), eq(blogLikes.userId, userId)));
      await db
        .update(blogPosts)
        .set({ likeCount: sql`GREATEST(0, ${blogPosts.likeCount} - 1)` })
        .where(eq(blogPosts.postId, postId));
      return { liked: false };
    } else {
      await db.insert(blogLikes).values({ postId, userId });
      await db
        .update(blogPosts)
        .set({ likeCount: sql`${blogPosts.likeCount} + 1` })
        .where(eq(blogPosts.postId, postId));
      return { liked: true };
    }
  },

  // ─── Bookmarks ──
  async toggleBookmark(postId: number, userId: number) {
    const [existing] = await db
      .select()
      .from(blogBookmarks)
      .where(and(eq(blogBookmarks.postId, postId), eq(blogBookmarks.userId, userId)));

    if (existing) {
      await db
        .delete(blogBookmarks)
        .where(and(eq(blogBookmarks.postId, postId), eq(blogBookmarks.userId, userId)));
      await db
        .update(blogPosts)
        .set({ bookmarkCount: sql`GREATEST(0, ${blogPosts.bookmarkCount} - 1)` })
        .where(eq(blogPosts.postId, postId));
      return { bookmarked: false };
    } else {
      await db.insert(blogBookmarks).values({ postId, userId });
      await db
        .update(blogPosts)
        .set({ bookmarkCount: sql`${blogPosts.bookmarkCount} + 1` })
        .where(eq(blogPosts.postId, postId));
      return { bookmarked: true };
    }
  },

  // ─── Comments ──
  async listComments(postId: number) {
    return db
      .select({
        commentId: blogComments.commentId,
        postId: blogComments.postId,
        authorId: blogComments.authorId,
        parentCommentId: blogComments.parentCommentId,
        content: blogComments.content,
        likeCount: blogComments.likeCount,
        createdAt: blogComments.createdAt,
        authorName: sql<string>`COALESCE(${users.fullName}, ${users.userName})`,
        authorHandle: users.userName,
        authorAvatar: users.avatarUrl,
      })
      .from(blogComments)
      .innerJoin(users, eq(blogComments.authorId, users.userId))
      .where(eq(blogComments.postId, postId))
      .orderBy(blogComments.createdAt);
  },

  async createComment(data: {
    postId: number;
    authorId: number;
    parentCommentId?: number | null;
    content: string;
  }) {
    const [comment] = await db.insert(blogComments).values(data).returning();
    await db
      .update(blogPosts)
      .set({ commentCount: sql`${blogPosts.commentCount} + 1` })
      .where(eq(blogPosts.postId, data.postId));
    return comment;
  },

  async deleteComment(commentId: number, authorId: number) {
    const [comment] = await db
      .delete(blogComments)
      .where(and(eq(blogComments.commentId, commentId), eq(blogComments.authorId, authorId)))
      .returning();
    if (comment) {
      await db
        .update(blogPosts)
        .set({ commentCount: sql`GREATEST(0, ${blogPosts.commentCount} - 1)` })
        .where(eq(blogPosts.postId, comment.postId));
    }
    return !!comment;
  },

  // ─── User bookmarks list ──
  async listUserBookmarks(userId: number) {
    const rows = await db
      .select({ postId: blogBookmarks.postId, createdAt: blogBookmarks.createdAt })
      .from(blogBookmarks)
      .where(eq(blogBookmarks.userId, userId))
      .orderBy(desc(blogBookmarks.createdAt));
    return rows;
  },

  // ─── Tags ──
  async listTags() {
    return db.select().from(communityTags).orderBy(desc(communityTags.usageCount));
  },

  async ensureTags(names: string[]): Promise<number[]> {
    if (names.length === 0) return [];
    const slugify = (s: string) =>
      s
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 60);
    const ids: number[] = [];
    for (const name of names) {
      const slug = slugify(name);
      const [existing] = await db.select().from(communityTags).where(eq(communityTags.slug, slug));
      if (existing) ids.push(existing.tagId);
      else {
        const [created] = await db.insert(communityTags).values({ name, slug }).returning();
        ids.push(created.tagId);
      }
    }
    return ids;
  },

  async createTag(input: { name: string; color?: string | null; description?: string | null }) {
    const slug = input.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 60);
    const [created] = await db
      .insert(communityTags)
      .values({
        name: input.name,
        slug,
        color: input.color ?? undefined,
        description: input.description ?? undefined,
      })
      .returning();
    return created;
  },

  async updateTag(
    tagId: number,
    input: Partial<{ name: string; color: string | null; description: string | null }>,
  ) {
    const updates: any = {};
    if (input.name !== undefined) {
      updates.name = input.name;
      updates.slug = input.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 60);
    }
    if (input.color !== undefined) updates.color = input.color;
    if (input.description !== undefined) updates.description = input.description;
    const [updated] = await db
      .update(communityTags)
      .set(updates)
      .where(eq(communityTags.tagId, tagId))
      .returning();
    return updated;
  },

  async deleteTag(tagId: number): Promise<boolean> {
    const result = await db.delete(communityTags).where(eq(communityTags.tagId, tagId)).returning();
    return result.length > 0;
  },
};
