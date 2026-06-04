import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";

export type ReportContentType = "blog" | "forum_thread" | "forum_reply" | "blog_comment";
export type ReportReason =
  | "spam"
  | "harassment"
  | "misinformation"
  | "illegal"
  | "offensive"
  | "other";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

export function useReportContent() {
  return useMutation<
    any,
    Error,
    {
      contentType: ReportContentType;
      contentRefId: number;
      reason: ReportReason;
      details?: string;
    }
  >({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/community/report", input);
      return unwrap(res);
    },
  });
}
