import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse, errors } from "../../lib/http";
import { requireAuth } from "../../middlewares/auth";
import { forumRepo } from "./repository";
import { blogRepo } from "../blog/repository"; // reuse ensureTags

function viewerIdOf(req: Request): number | undefined {
  return (req as any).user?.userId;
}

async function listThreads(req: Request, res: Response) {
  const data = await forumRepo.listThreads(
    {
      destinationId: req.query.destinationId ? Number(req.query.destinationId) : undefined,
      category: req.query.category as string,
      status: req.query.status as string,
      search: req.query.q as string,
      sort: (req.query.sort as any) || "latest",
      limit: req.query.limit ? Number(req.query.limit) : 30,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    },
    viewerIdOf(req),
  );
  sendResponse(res, 200, "Threads retrieved", data);
}

async function getThread(req: Request, res: Response) {
  const id = Number(req.params.id);
  const thread = await forumRepo.getThread(id, viewerIdOf(req));
  if (!thread) throw errors.notFound("Thread");
  forumRepo.incrementView(id).catch(() => {});
  sendResponse(res, 200, "Thread retrieved", thread);
}

async function createThread(req: Request, res: Response) {
  const authorId = viewerIdOf(req);
  if (!authorId) throw errors.unauthorized();
  const { title, body, destinationId, category, tagNames } = req.body ?? {};
  if (!title || !body) throw errors.badRequest("title + body required");
  const tagIds = tagNames?.length ? await blogRepo.ensureTags(tagNames) : [];
  const thread = await forumRepo.createThread({
    authorId,
    title,
    body,
    destinationId: destinationId || null,
    category,
    tagIds,
  });
  sendResponse(res, 201, "Thread created", thread);
}

async function deleteThread(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const ok = await forumRepo.deleteThread(id, userId);
  if (!ok) throw errors.notFound("Thread");
  sendResponse(res, 200, "Thread deleted", null);
}

async function listReplies(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = await forumRepo.listReplies(id, viewerIdOf(req));
  sendResponse(res, 200, "Replies retrieved", data);
}

async function createReply(req: Request, res: Response) {
  const id = Number(req.params.id);
  const authorId = viewerIdOf(req);
  if (!authorId) throw errors.unauthorized();
  const { body, parentReplyId } = req.body ?? {};
  if (!body || body.trim().length < 2) throw errors.badRequest("Body too short");
  const reply = await forumRepo.createReply({
    threadId: id,
    authorId,
    body: body.trim(),
    parentReplyId: parentReplyId || null,
  });
  sendResponse(res, 201, "Reply created", reply);
}

async function deleteReply(req: Request, res: Response) {
  const replyId = Number(req.params.replyId);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const ok = await forumRepo.deleteReply(replyId, userId);
  if (!ok) throw errors.notFound("Reply");
  sendResponse(res, 200, "Reply deleted", null);
}

async function acceptReply(req: Request, res: Response) {
  const threadId = Number(req.params.threadId);
  const replyId = Number(req.params.replyId);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const ok = await forumRepo.acceptReply(threadId, replyId, userId);
  if (!ok) throw errors.forbidden("Only thread author can accept");
  sendResponse(res, 200, "Reply accepted as best answer", null);
}

async function voteThread(req: Request, res: Response) {
  const id = Number(req.params.id);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const voteType = req.body?.voteType as "up" | "down" | "clear";
  if (!["up", "down", "clear"].includes(voteType)) throw errors.badRequest("voteType invalid");
  const r = await forumRepo.vote("thread", id, userId, voteType);
  sendResponse(res, 200, "Vote saved", r);
}

async function voteReply(req: Request, res: Response) {
  const replyId = Number(req.params.replyId);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const voteType = req.body?.voteType as "up" | "down" | "clear";
  if (!["up", "down", "clear"].includes(voteType)) throw errors.badRequest("voteType invalid");
  const r = await forumRepo.vote("reply", replyId, userId, voteType);
  sendResponse(res, 200, "Vote saved", r);
}

export function registerForumRoutes(app: Express) {
  app.get("/api/forum/threads", asyncHandler(listThreads));
  app.get("/api/forum/threads/:id", asyncHandler(getThread));
  app.post("/api/forum/threads", requireAuth, asyncHandler(createThread));
  app.delete("/api/forum/threads/:id", requireAuth, asyncHandler(deleteThread));

  app.get("/api/forum/threads/:id/replies", asyncHandler(listReplies));
  app.post("/api/forum/threads/:id/replies", requireAuth, asyncHandler(createReply));
  app.delete("/api/forum/replies/:replyId", requireAuth, asyncHandler(deleteReply));
  app.post("/api/forum/threads/:threadId/accept/:replyId", requireAuth, asyncHandler(acceptReply));

  app.post("/api/forum/threads/:id/vote", requireAuth, asyncHandler(voteThread));
  app.post("/api/forum/replies/:replyId/vote", requireAuth, asyncHandler(voteReply));
}
