import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

export interface ForumPollOption {
  optionId: number;
  pollId: number;
  optionText: string;
  voteCount: number;
  position: number;
}

export interface ForumPoll {
  pollId: number;
  threadId: number;
  question?: string | null;
  closesAt?: string | null;
  createdAt: string;
  options: ForumPollOption[];
  totalVotes: number;
  myVote: number | null;
}

export interface ForumThread {
  threadId: number;
  authorId: number;
  title: string;
  body: string;
  destinationId?: number | null;
  destinationName?: string | null;
  category?: string | null;
  status: string;
  acceptedReplyId?: number | null;
  viewCount: number;
  replyCount: number;
  upvotes: number;
  downvotes: number;
  isPinned: boolean;
  lastReplyAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  authorName: string;
  authorHandle?: string;
  authorRole?: string | null;
  authorAvatar?: string | null;
  authorLevel?: string | null;
  tags: { tagId: number; name: string; color?: string | null }[];
  myVote: string | null;
  poll?: ForumPoll | null;
}

export interface ForumReply {
  replyId: number;
  threadId: number;
  authorId: number;
  parentReplyId?: number | null;
  body: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt?: string | null;
  authorName: string;
  authorHandle?: string;
  authorRole?: string | null;
  authorAvatar?: string | null;
  authorLevel?: string | null;
  myVote: string | null;
}

export interface ForumFilters {
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

const KEY = ["forum"];

export function useForumThreads(filters: ForumFilters = {}) {
  return useQuery<ForumThread[]>({
    queryKey: [...KEY, "threads", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.destinationId) params.set("destinationId", String(filters.destinationId));
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("q", filters.search);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.offset) params.set("offset", String(filters.offset));
      if (filters.authorId) params.set("authorId", String(filters.authorId));
      if (filters.followingOnly) params.set("followingOnly", "true");
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/forum/threads${qs ? "?" + qs : ""}`);
      return unwrap<ForumThread[]>(res);
    },
    staleTime: 15 * 1000,
    refetchOnMount: "always",
  });
}

export function useForumThread(threadId?: number) {
  return useQuery<ForumThread | null>({
    queryKey: [...KEY, "thread", threadId],
    queryFn: async () => {
      if (!threadId) return null;
      const res = await apiRequest("GET", `/api/forum/threads/${threadId}`);
      return unwrap<ForumThread>(res);
    },
    enabled: !!threadId,
  });
}

export function useForumReplies(threadId?: number) {
  return useQuery<ForumReply[]>({
    queryKey: [...KEY, "replies", threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const res = await apiRequest("GET", `/api/forum/threads/${threadId}/replies`);
      return unwrap<ForumReply[]>(res);
    },
    enabled: !!threadId,
    staleTime: 30 * 1000,
  });
}

export function useCreateForumThread() {
  const qc = useQueryClient();
  return useMutation<
    ForumThread,
    Error,
    {
      title: string;
      body: string;
      destinationId?: number | null;
      category?: string;
      tagNames?: string[];
      poll?: { question?: string; options: string[] } | null;
    }
  >({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/forum/threads", input);
      return unwrap(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "threads"] }),
  });
}

export function useCreateForumReply() {
  const qc = useQueryClient();
  return useMutation<
    ForumReply,
    Error,
    { threadId: number; body: string; parentReplyId?: number | null }
  >({
    mutationFn: async ({ threadId, body, parentReplyId }) => {
      const res = await apiRequest("POST", `/api/forum/threads/${threadId}/replies`, {
        body,
        parentReplyId,
      });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "replies", vars.threadId] });
      qc.invalidateQueries({ queryKey: [...KEY, "thread", vars.threadId] });
      qc.invalidateQueries({ queryKey: [...KEY, "threads"] });
    },
  });
}

export function useVoteThread() {
  const qc = useQueryClient();
  return useMutation<any, Error, { threadId: number; voteType: "up" | "down" | "clear" }>({
    mutationFn: async ({ threadId, voteType }) => {
      const res = await apiRequest("POST", `/api/forum/threads/${threadId}/vote`, { voteType });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "thread", vars.threadId] });
      qc.invalidateQueries({ queryKey: [...KEY, "threads"] });
    },
  });
}

export function useVoteReply() {
  const qc = useQueryClient();
  return useMutation<
    any,
    Error,
    { replyId: number; threadId: number; voteType: "up" | "down" | "clear" }
  >({
    mutationFn: async ({ replyId, voteType }) => {
      const res = await apiRequest("POST", `/api/forum/replies/${replyId}/vote`, { voteType });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "replies", vars.threadId] });
    },
  });
}

export function useVotePoll() {
  const qc = useQueryClient();
  return useMutation<
    { voted: number | null },
    Error,
    { pollId: number; optionId: number; threadId: number }
  >({
    mutationFn: async ({ pollId, optionId }) => {
      const res = await apiRequest("POST", `/api/forum/polls/${pollId}/vote`, { optionId });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "thread", vars.threadId] });
    },
  });
}

export function useAcceptReply() {
  const qc = useQueryClient();
  return useMutation<void, Error, { threadId: number; replyId: number }>({
    mutationFn: async ({ threadId, replyId }) => {
      await apiRequest("POST", `/api/forum/threads/${threadId}/accept/${replyId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "thread", vars.threadId] });
      qc.invalidateQueries({ queryKey: [...KEY, "replies", vars.threadId] });
      // Also refresh thread lists so "Đã giải đáp" badge updates everywhere
      qc.invalidateQueries({ queryKey: [...KEY, "threads"] });
    },
  });
}

export function useUpdateForumThread() {
  const qc = useQueryClient();
  return useMutation<
    ForumThread,
    Error,
    {
      threadId: number;
      input: {
        title?: string;
        body?: string;
        category?: string | null;
        destinationId?: number | null;
      };
    }
  >({
    mutationFn: async ({ threadId, input }) => {
      const res = await apiRequest("PUT", `/api/forum/threads/${threadId}`, input);
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "thread", vars.threadId] });
      qc.invalidateQueries({ queryKey: [...KEY, "threads"] });
    },
  });
}

export function useUpdateForumReply() {
  const qc = useQueryClient();
  return useMutation<ForumReply, Error, { replyId: number; threadId: number; body: string }>({
    mutationFn: async ({ replyId, body }) => {
      const res = await apiRequest("PUT", `/api/forum/replies/${replyId}`, { body });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "replies", vars.threadId] });
    },
  });
}

export function useDeleteForumThread() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (threadId) => {
      await apiRequest("DELETE", `/api/forum/threads/${threadId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "threads"] }),
  });
}

export function useDeleteForumReply() {
  const qc = useQueryClient();
  return useMutation<void, Error, { replyId: number; threadId: number }>({
    mutationFn: async ({ replyId }) => {
      await apiRequest("DELETE", `/api/forum/replies/${replyId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "replies", vars.threadId] });
    },
  });
}
