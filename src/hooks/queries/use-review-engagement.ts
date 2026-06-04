/**
 * React Query hooks for Phase 1.5 review engagement features:
 * - helpful votes (POST/DELETE)
 * - threaded replies (GET/POST/DELETE)
 * - content reports (POST)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

// ──────────────────────────────────────────────────────────────
// Votes
// ──────────────────────────────────────────────────────────────

export interface VoteSummary {
  helpful: number;
  notHelpful: number;
  myVote: "helpful" | "not_helpful" | null;
}

export function useVoteReview() {
  const qc = useQueryClient();
  return useMutation<
    VoteSummary,
    Error,
    { reviewUserId: number; reviewTripId: number; voteType: "helpful" | "not_helpful" }
  >({
    mutationFn: async ({ reviewUserId, reviewTripId, voteType }) => {
      const res = await apiRequest("POST", `/api/reviews/${reviewUserId}/${reviewTripId}/vote`, {
        voteType,
      });
      return unwrap<VoteSummary>(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["reviewVotes", vars.reviewUserId, vars.reviewTripId] });
    },
  });
}

export function useRemoveVote() {
  const qc = useQueryClient();
  return useMutation<VoteSummary, Error, { reviewUserId: number; reviewTripId: number }>({
    mutationFn: async ({ reviewUserId, reviewTripId }) => {
      const res = await apiRequest("DELETE", `/api/reviews/${reviewUserId}/${reviewTripId}/vote`);
      return unwrap<VoteSummary>(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["reviewVotes", vars.reviewUserId, vars.reviewTripId] });
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Replies
// ──────────────────────────────────────────────────────────────

export interface ReviewReply {
  replyId: number;
  parentReviewUserId: number;
  parentReviewTripId: number;
  authorId: number;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
}

export function useReviewReplies(reviewUserId?: number, reviewTripId?: number) {
  return useQuery<ReviewReply[]>({
    queryKey: ["reviewReplies", reviewUserId, reviewTripId],
    queryFn: async () => {
      if (!reviewUserId || !reviewTripId) return [];
      const res = await apiRequest("GET", `/api/reviews/${reviewUserId}/${reviewTripId}/replies`);
      return unwrap<ReviewReply[]>(res);
    },
    enabled: !!reviewUserId && !!reviewTripId,
    staleTime: 30 * 1000,
  });
}

export function useCreateReply() {
  const qc = useQueryClient();
  return useMutation<
    ReviewReply,
    Error,
    { reviewUserId: number; reviewTripId: number; content: string }
  >({
    mutationFn: async ({ reviewUserId, reviewTripId, content }) => {
      const res = await apiRequest("POST", `/api/reviews/${reviewUserId}/${reviewTripId}/replies`, {
        content,
      });
      return unwrap<ReviewReply>(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["reviewReplies", vars.reviewUserId, vars.reviewTripId] });
    },
  });
}

export function useDeleteReply() {
  const qc = useQueryClient();
  return useMutation<void, Error, { replyId: number; reviewUserId: number; reviewTripId: number }>({
    mutationFn: async ({ replyId }) => {
      await apiRequest("DELETE", `/api/reviews/replies/${replyId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["reviewReplies", vars.reviewUserId, vars.reviewTripId] });
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Reports
// ──────────────────────────────────────────────────────────────

export type ReportReason =
  | "spam"
  | "offensive"
  | "irrelevant"
  | "misleading"
  | "harassment"
  | "other";

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: "spam", label: "Spam / quảng cáo" },
  { key: "offensive", label: "Ngôn từ xúc phạm" },
  { key: "irrelevant", label: "Không liên quan" },
  { key: "misleading", label: "Sai sự thật" },
  { key: "harassment", label: "Quấy rối" },
  { key: "other", label: "Lý do khác" },
];

export function useReportContent() {
  return useMutation<
    any,
    Error,
    {
      contentType: "review" | "reply" | "blog" | "qa";
      contentRefId: string;
      reason: ReportReason;
      details?: string;
    }
  >({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/reports", input);
      return unwrap(res);
    },
  });
}
