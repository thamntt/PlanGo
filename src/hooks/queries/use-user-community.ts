import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

export interface UserProfile {
  userId: number;
  userName: string;
  fullName?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  reviewerLevel?: string | null;
  reviewCount: number;
  helpfulReceived: number;
  createdAt?: string;
  postCount: number;
  threadCount: number;
  replyCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
}

export interface FollowEdge {
  userId: number;
  userName: string;
  avatarUrl?: string | null;
  reviewerLevel?: string | null;
  followedAt?: string;
}

const KEY = ["userCommunity"];

export function useUserProfile(userId?: number) {
  return useQuery<UserProfile | null>({
    queryKey: [...KEY, "profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await apiRequest("GET", `/api/users/${userId}/profile`);
      return unwrap<UserProfile>(res);
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation<{ following: boolean }, Error, number>({
    mutationFn: async (userId) => {
      const res = await apiRequest("POST", `/api/users/${userId}/follow`);
      return unwrap(res);
    },
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: [...KEY, "profile", userId] });
      qc.invalidateQueries({ queryKey: [...KEY, "followers", userId] });
    },
  });
}

export function useFollowers(userId?: number) {
  return useQuery<FollowEdge[]>({
    queryKey: [...KEY, "followers", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest("GET", `/api/users/${userId}/followers`);
      return unwrap<FollowEdge[]>(res);
    },
    enabled: !!userId,
  });
}

export function useFollowing(userId?: number) {
  return useQuery<FollowEdge[]>({
    queryKey: [...KEY, "following", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest("GET", `/api/users/${userId}/following`);
      return unwrap<FollowEdge[]>(res);
    },
    enabled: !!userId,
  });
}
