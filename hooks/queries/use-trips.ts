import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { mapItinerary } from "@/lib/mappers";
import type { Itinerary } from "@/lib/storage";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export interface ListTripsFilters {
  ownerId?: number;
  memberId?: number;
}

export function useTrips(filters?: ListTripsFilters) {
  return useQuery<Itinerary[]>({
    queryKey: queryKeys.tripList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.ownerId !== undefined) params.set("ownerId", String(filters.ownerId));
      if (filters?.memberId !== undefined) params.set("memberId", String(filters.memberId));
      const route = params.toString() ? `/api/trips?${params}` : "/api/trips";
      const res = await apiRequest("GET", route);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapItinerary);
    },
  });
}

export function useTrip(id: string | number | undefined) {
  return useQuery<Itinerary | null>({
    queryKey: queryKeys.tripDetail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await apiRequest("GET", `/api/trips/${id}`);
      const data = await unwrap<any>(res);
      return data ? mapItinerary(data) : null;
    },
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation<Itinerary, Error, Omit<Itinerary, "id" | "createdAt">>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/trips", input);
      const data = await unwrap<any>(res);
      return mapItinerary(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trips() });
    },
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation<Itinerary, Error, { id: string | number; data: Partial<Itinerary> }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/trips/${id}`, data);
      const result = await unwrap<any>(res);
      return mapItinerary(result);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tripDetail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.tripList() });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation<void, Error, string | number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/trips/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trips() });
    },
  });
}

export function useGenerateItinerary() {
  return useMutation<any, Error, {
    destination: string;
    startDate: string;
    endDate: string;
    budget?: string | number;
    totalBudget?: number;
    numPeople?: number;
    preferences?: string[];
    startingPoint?: string;
  }>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/generate-itinerary", input);
      return res.json();
    },
  });
}
