import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

export interface BlogPost {
  postId: number;
  authorId: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string;
  coverImage?: string | null;
  images?: string[] | null;
  category?: string | null;
  readMinutes?: number | null;
  status?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  referencedTripId?: number | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  authorName: string;
  authorHandle?: string;
  authorRole?: string | null;
  authorAvatar?: string | null;
  authorLevel?: string | null;
  authorReviewCount?: number;
  tags: { tagId: number; name: string; color?: string | null }[];
  destinationsList: { destinationId: number; name: string; images?: string[] | null }[];
  isLikedByViewer: boolean;
  isBookmarkedByViewer: boolean;
}

export interface BlogComment {
  commentId: number;
  postId: number;
  authorId: number;
  parentCommentId?: number | null;
  content: string;
  likeCount: number;
  createdAt: string;
  authorName: string;
  authorHandle?: string;
  authorRole?: string | null;
  authorAvatar?: string | null;
}

export interface BlogFilters {
  category?: string;
  destinationId?: number;
  authorId?: number;
  search?: string;
  sort?: "latest" | "popular" | "trending";
  limit?: number;
  offset?: number;
  followingOnly?: boolean;
  likedOnly?: boolean;
  bookmarkedOnly?: boolean;
}

const KEY = ["blog"];

export function useBlogPosts(filters: BlogFilters = {}) {
  return useQuery<BlogPost[]>({
    queryKey: [...KEY, "posts", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.destinationId) params.set("destinationId", String(filters.destinationId));
      if (filters.authorId) params.set("authorId", String(filters.authorId));
      if (filters.search) params.set("q", filters.search);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.offset) params.set("offset", String(filters.offset));
      if (filters.followingOnly) params.set("followingOnly", "true");
      if (filters.likedOnly) params.set("likedOnly", "true");
      if (filters.bookmarkedOnly) params.set("bookmarkedOnly", "true");
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/blog/posts${qs ? "?" + qs : ""}`);
      return unwrap<BlogPost[]>(res);
    },
    staleTime: 60 * 1000,
  });
}

export function useBlogPost(postId?: number) {
  return useQuery<BlogPost | null>({
    queryKey: [...KEY, "post", postId],
    queryFn: async () => {
      if (!postId) return null;
      const res = await apiRequest("GET", `/api/blog/posts/${postId}`);
      return unwrap<BlogPost>(res);
    },
    enabled: !!postId,
  });
}

export function useToggleBlogLike() {
  const qc = useQueryClient();
  return useMutation<{ liked: boolean }, Error, number>({
    mutationFn: async (postId) => {
      const res = await apiRequest("POST", `/api/blog/posts/${postId}/like`);
      return unwrap(res);
    },
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: [...KEY, "post", postId] });
      qc.invalidateQueries({ queryKey: [...KEY, "posts"] });
    },
  });
}

export function useToggleBlogBookmark() {
  const qc = useQueryClient();
  return useMutation<{ bookmarked: boolean }, Error, number>({
    mutationFn: async (postId) => {
      const res = await apiRequest("POST", `/api/blog/posts/${postId}/bookmark`);
      return unwrap(res);
    },
    onSuccess: (_data, postId) => {
      qc.invalidateQueries({ queryKey: [...KEY, "post", postId] });
      qc.invalidateQueries({ queryKey: [...KEY, "posts"] });
    },
  });
}

export function useBlogComments(postId?: number) {
  return useQuery<BlogComment[]>({
    queryKey: [...KEY, "comments", postId],
    queryFn: async () => {
      if (!postId) return [];
      const res = await apiRequest("GET", `/api/blog/posts/${postId}/comments`);
      return unwrap<BlogComment[]>(res);
    },
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}

export function useCreateBlogComment() {
  const qc = useQueryClient();
  return useMutation<
    BlogComment,
    Error,
    { postId: number; content: string; parentCommentId?: number | null }
  >({
    mutationFn: async ({ postId, content, parentCommentId }) => {
      const res = await apiRequest("POST", `/api/blog/posts/${postId}/comments`, {
        content,
        parentCommentId,
      });
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "comments", vars.postId] });
      qc.invalidateQueries({ queryKey: [...KEY, "post", vars.postId] });
    },
  });
}

export function useDeleteBlogComment() {
  const qc = useQueryClient();
  return useMutation<void, Error, { commentId: number; postId: number }>({
    mutationFn: async ({ commentId }) => {
      await apiRequest("DELETE", `/api/blog/comments/${commentId}`);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "comments", vars.postId] });
      qc.invalidateQueries({ queryKey: [...KEY, "post", vars.postId] });
    },
  });
}

type BlogInput = {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  images?: string[];
  category?: string;
  readMinutes?: number;
  tagNames?: string[];
  destinationIds?: number[];
  referencedTripId?: number | null;
};

export function useUpdateBlogPost() {
  const qc = useQueryClient();
  return useMutation<BlogPost, Error, { postId: number; input: Partial<BlogInput> }>({
    mutationFn: async ({ postId, input }) => {
      const res = await apiRequest("PUT", `/api/blog/posts/${postId}`, input);
      return unwrap(res);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, "posts"] });
      qc.invalidateQueries({ queryKey: [...KEY, "post", vars.postId] });
    },
  });
}

export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation<BlogPost, Error, BlogInput>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/blog/posts", input);
      return unwrap(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "posts"] }),
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (postId) => {
      await apiRequest("DELETE", `/api/blog/posts/${postId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "posts"] }),
  });
}
