import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import { mapReview } from "@/lib/mappers";
import type { Review } from "@/types";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export interface ReviewFilters {
  tripId?: number;
  itemId?: number;
  destinationId?: number;
}

export function useReviews(filters?: ReviewFilters) {
  return useQuery<Review[]>({
    queryKey: queryKeys.reviewList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.tripId) params.set("tripId", String(filters.tripId));
      if (filters?.itemId) params.set("itemId", String(filters.itemId));
      if (filters?.destinationId) params.set("destinationId", String(filters.destinationId));
      const route = params.toString() ? `/api/reviews?${params}` : "/api/reviews";
      const res = await apiRequest("GET", route);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapReview);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation<Review, Error, Omit<Review, "id" | "createdAt">>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/reviews", input);
      const data = await unwrap<any>(res);
      return mapReview(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviews() }),
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation<
    Review,
    Error,
    {
      id: string | number;
      data: Partial<Review> & { userId?: number | string; type?: "trip" | "item" };
    }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/reviews/${id}`, data);
      const result = await unwrap<any>(res);
      return mapReview(result);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviews() }),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { id: string | number; userId: string | number; type?: "trip" | "item" }
  >({
    mutationFn: async ({ id, userId, type }) => {
      const params = new URLSearchParams({ userId: String(userId) });
      if (type) params.set("type", type);
      await apiRequest("DELETE", `/api/reviews/${id}?${params}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reviews() }),
  });
}
