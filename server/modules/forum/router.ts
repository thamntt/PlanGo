import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors } from "../../lib/errors";
import { requireAuth, optionalAuth } from "../../middlewares/auth";
import { forumRepo } from "./repository";
import { blogRepo } from "../blog/repository"; // reuse ensureTags

function viewerIdOf(req: Request): number | undefined {
  return req.auth?.id;
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
      authorId: req.query.authorId ? Number(req.query.authorId) : undefined,
      followingOnly: req.query.followingOnly === "true",
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
  const { title, body, destinationId, category, tagNames, poll } = req.body ?? {};
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
  // Optional poll
  if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
    try {
      await forumRepo.createPoll({
        threadId: thread.threadId,
        question: poll.question,
        options: poll.options,
      });
    } catch (err: any) {
      // Don't fail thread creation if poll is malformed; surface message
      console.error("[forum] poll create failed:", err?.message);
    }
  }
  sendResponse(res, 201, "Thread created", thread);
}

async function votePoll(req: Request, res: Response) {
  const pollId = Number(req.params.pollId);
  const optionId = Number(req.body?.optionId);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  if (!pollId || !optionId) throw errors.badRequest("pollId + optionId required");
  try {
    const r = await forumRepo.votePoll(pollId, optionId, userId);
    sendResponse(res, 200, "Vote saved", r);
  } catch (err: any) {
    throw errors.badRequest(err?.message || "Cannot vote");
  }
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

async function updateThread(req: Request, res: Response) {
  const threadId = Number(req.params.id);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const { title, body, category, destinationId } = req.body ?? {};
  const result = await forumRepo.updateThread(threadId, userId, {
    title,
    body,
    category,
    destinationId,
  });
  if (!result.ok) {
    if (result.reason === "not_found") throw errors.notFound("Thread");
    if (result.reason === "not_owner") throw errors.forbidden("Không phải tác giả");
    if (result.reason === "solved") {
      throw errors.badRequest("Câu hỏi đã được giải đáp, không thể sửa");
    }
    if (result.reason === "expired") {
      throw errors.badRequest("Đã quá 1 tiếng kể từ khi đăng, không thể sửa nữa");
    }
    throw errors.badRequest("Không sửa được");
  }
  sendResponse(res, 200, "Thread updated", result.thread);
}

async function updateReply(req: Request, res: Response) {
  const replyId = Number(req.params.replyId);
  const userId = viewerIdOf(req);
  if (!userId) throw errors.unauthorized();
  const { body } = req.body ?? {};
  if (!body || String(body).trim().length < 2) throw errors.badRequest("Body too short");
  const updated = await forumRepo.updateReply(replyId, userId, String(body).trim());
  if (!updated) throw errors.forbidden("Reply not found or not yours");
  sendResponse(res, 200, "Reply updated", updated);
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
  app.get("/api/forum/threads", optionalAuth, asyncHandler(listThreads));
  app.get("/api/forum/threads/:id", optionalAuth, asyncHandler(getThread));
  app.post("/api/forum/threads", requireAuth, asyncHandler(createThread));
  app.put("/api/forum/threads/:id", requireAuth, asyncHandler(updateThread));
  app.delete("/api/forum/threads/:id", requireAuth, asyncHandler(deleteThread));

  app.get("/api/forum/threads/:id/replies", optionalAuth, asyncHandler(listReplies));
  app.post("/api/forum/threads/:id/replies", requireAuth, asyncHandler(createReply));
  app.put("/api/forum/replies/:replyId", requireAuth, asyncHandler(updateReply));
  app.delete("/api/forum/replies/:replyId", requireAuth, asyncHandler(deleteReply));
  app.post("/api/forum/threads/:threadId/accept/:replyId", requireAuth, asyncHandler(acceptReply));

  app.post("/api/forum/threads/:id/vote", requireAuth, asyncHandler(voteThread));
  app.post("/api/forum/replies/:replyId/vote", requireAuth, asyncHandler(voteReply));

  app.post("/api/forum/polls/:pollId/vote", requireAuth, asyncHandler(votePoll));
}
