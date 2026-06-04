import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors } from "../../lib/errors";
import { requireAuth, optionalAuth, requireAdmin } from "../../middlewares/auth";
import { blogRepo } from "./repository";

function viewerIdOf(req: Request): number | undefined {
  return req.auth?.id;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 260);
}

async function listPosts(req: Request, res: Response) {
  const data = await blogRepo.listPosts(
    {
      category: req.query.category as string,
      destinationId: req.query.destinationId ? Number(req.query.destinationId) : undefined,
      authorId: req.query.authorId ? Number(req.query.authorId) : undefined,
      tagSlug: req.query.tag as string,
      search: req.query.q as string,
      sort: (req.query.sort as any) || "latest",
      limit: req.query.limit ? Number(req.query.limit) : 30,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      followingOnly: req.query.followingOnly === "true",
      likedOnly: req.query.likedOnly === "true",
      bookmarkedOnly: req.query.bookmarkedOnly === "true",
    },
    viewerIdOf(req),
  );
  sendResponse(res, 200, "Blog posts retrieved", data);
}

async function getPost(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) throw errors.badRequest("Invalid post id");
  const post = await blogRepo.getPost(id, viewerIdOf(req));
  if (!post) throw errors.notFound("Blog post");
  blogRepo.incrementView(id).catch(() => {});
  sendResponse(res, 200, "Blog post retrieved", post);
}

async function createPost(req: Request, res: Response) {
  const authorId = viewerIdOf(req);
  if (!authorId) throw errors.unauthorized();
  const {
    title,
    content,
    excerpt,
    coverImage,
    images,
    category,
    readMinutes,
    tagNames,
    destinationIds,
    referencedTripId,
  } = req.body ?? {};
  if (!title || !content) throw errors.badRequest("title + content required");
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const tagIds = tagNames?.length ? await blogRepo.ensureTags(tagNames) : [];
  const post = await blogRepo.createPost({
    authorId,
    title,
    slug,
    excerpt,
    content,
    coverImage,
    images,
    category,
    readMinutes,
    tagIds,
    destinationIds,
    referencedTripId,
  });
  sendResponse(res, 201, "Blog post created", post);
}

async function updatePost(req: Request, res: Response) {
  const id = Number(req.params.id);
  const authorId = viewerIdOf(req);
  if (!authorId) throw errors.unauthorized();
  // Ownership check
  const existing = await blogRepo.getPost(id);
  if (!existing) throw errors.notFound("Blog post");
  if (existing.authorId !== authorId) throw errors.forbidden();
  const post = await blogRepo.updatePost(id, req.body ?? {});
  sendResponse(res, 200, "Blog post updated", post);
}

async function deletePost(req: Request, res: Response) {
  const id = Number(req.params.id);
  const authorId = viewerIdOf(req);
  if (!authorId) throw errors.unauthorized();
  const ok = await blogRepo.deletePost(id, authorId);
  if (!ok) throw errors.notFound("Blog post");
  sendResponse(res, 200, "Blog post deleted", null);
}

async function toggleLike(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const r = await blogRepo.toggleLike(id, userId);
  sendResponse(res, 200, "Like toggled", r);
}

async function toggleBookmark(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const r = await blogRepo.toggleBookmark(id, userId);
  sendResponse(res, 200, "Bookmark toggled", r);
}

async function listComments(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = await blogRepo.listComments(id);
  sendResponse(res, 200, "Comments retrieved", data);
}

async function createComment(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const { content, parentCommentId } = req.body ?? {};
  if (!content || content.trim().length < 2) throw errors.badRequest("Comment too short");
  const comment = await blogRepo.createComment({
    postId: id,
    authorId: userId,
    parentCommentId: parentCommentId || null,
    content: content.trim(),
  });
  sendResponse(res, 201, "Comment created", comment);
}

async function deleteComment(req: Request, res: Response) {
  const commentId = Number(req.params.commentId);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const ok = await blogRepo.deleteComment(commentId, userId);
  if (!ok) throw errors.notFound("Comment");
  sendResponse(res, 200, "Comment deleted", null);
}

async function listMyBookmarks(req: Request, res: Response) {
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const data = await blogRepo.listUserBookmarks(userId);
  sendResponse(res, 200, "Bookmarks retrieved", data);
}

async function listTags(req: Request, res: Response) {
  const data = await blogRepo.listTags();
  sendResponse(res, 200, "Tags retrieved", data);
}

async function createTag(req: Request, res: Response) {
  const { name, color, description } = req.body ?? {};
  if (!name || String(name).trim().length === 0) throw errors.badRequest("name required");
  const tag = await blogRepo.createTag({
    name: String(name).trim(),
    color: color || null,
    description: description || null,
  });
  sendResponse(res, 201, "Tag created", tag);
}

async function updateTag(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) throw errors.badRequest("Invalid tag id");
  const { name, color, description } = req.body ?? {};
  const tag = await blogRepo.updateTag(id, {
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(description !== undefined ? { description } : {}),
  });
  if (!tag) throw errors.notFound("Tag");
  sendResponse(res, 200, "Tag updated", tag);
}

async function deleteTag(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) throw errors.badRequest("Invalid tag id");
  const ok = await blogRepo.deleteTag(id);
  if (!ok) throw errors.notFound("Tag");
  sendResponse(res, 200, "Tag deleted", null);
}

export function registerBlogRoutes(app: Express) {
  app.get("/api/blog/posts", optionalAuth, asyncHandler(listPosts));
  app.get("/api/blog/posts/:id", optionalAuth, asyncHandler(getPost));
  app.post("/api/blog/posts", requireAuth, asyncHandler(createPost));
  app.put("/api/blog/posts/:id", requireAuth, asyncHandler(updatePost));
  app.delete("/api/blog/posts/:id", requireAuth, asyncHandler(deletePost));
  app.post("/api/blog/posts/:id/like", requireAuth, asyncHandler(toggleLike));
  app.post("/api/blog/posts/:id/bookmark", requireAuth, asyncHandler(toggleBookmark));
  app.get("/api/blog/posts/:id/comments", asyncHandler(listComments));
  app.post("/api/blog/posts/:id/comments", requireAuth, asyncHandler(createComment));
  app.delete("/api/blog/comments/:commentId", requireAuth, asyncHandler(deleteComment));
  app.get("/api/blog/me/bookmarks", requireAuth, asyncHandler(listMyBookmarks));
  app.get("/api/blog/tags", asyncHandler(listTags));
  app.post("/api/blog/tags", requireAdmin, asyncHandler(createTag));
  app.put("/api/blog/tags/:id", requireAdmin, asyncHandler(updateTag));
  app.delete("/api/blog/tags/:id", requireAdmin, asyncHandler(deleteTag));
}
