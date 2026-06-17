import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import { mapDestination, mapDestinationType } from "@/lib/mappers";
import type { Destination, DestinationType } from "@/types";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

// Destinations are reference-data — change rarely. Keep them fresh for 5 min,
// in-memory for 30 min so navigation between Explore ↔ Detail is instant.
const REF_DATA_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

export function useDestinations(typeId?: number) {
  return useQuery<Destination[]>({
    queryKey: queryKeys.destinationList(typeId),
    queryFn: async () => {
      const route =
        typeId !== undefined ? `/api/destinations?typeId=${typeId}` : "/api/destinations";
      const res = await apiRequest("GET", route);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapDestination);
    },
    ...REF_DATA_OPTIONS,
  });
}

export interface PopularDestination {
  destinationId: number;
  name: string;
  images: string[] | null;
  tripCount: number;
}

export function usePopularDestinations(limit = 10) {
  return useQuery<PopularDestination[]>({
    queryKey: ["destinations", "popular", limit],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/destinations/popular?limit=${limit}`);
      const data = await unwrap<any[]>(res);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDestination(id: string | number | undefined) {
  // Reject obviously invalid ids (router can yield the literal string "undefined")
  const validId =
    id !== undefined && id !== null && id !== "" && id !== "undefined" && id !== "null";
  return useQuery<Destination | null>({
    queryKey: queryKeys.destinationDetail(id ?? ""),
    queryFn: async () => {
      if (!validId) return null;
      const res = await apiRequest("GET", `/api/destinations/${id}`);
      const data = await unwrap<any>(res);
      return data ? mapDestination(data) : null;
    },
    enabled: validId,
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 8000),
    ...REF_DATA_OPTIONS,
  });
}

export function useDestinationTypes() {
  return useQuery<DestinationType[]>({
    queryKey: queryKeys.destinationTypes(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/destination-types");
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapDestinationType);
    },
    ...REF_DATA_OPTIONS,
  });
}

export function useCreateDestination() {
  const qc = useQueryClient();
  return useMutation<Destination, Error, Partial<Destination>>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/destinations", input);
      const data = await unwrap<any>(res);
      return mapDestination(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations() }),
  });
}

export function useUpdateDestination() {
  const qc = useQueryClient();
  return useMutation<Destination, Error, { id: string | number; data: Partial<Destination> }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/destinations/${id}`, data);
      const result = await unwrap<any>(res);
      return mapDestination(result);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.destinations() });
      qc.invalidateQueries({ queryKey: queryKeys.destinationDetail(vars.id) });
    },
  });
}

export function useDeleteDestination() {
  const qc = useQueryClient();
  return useMutation<void, Error, string | number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/destinations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.destinations() }),
  });
}
