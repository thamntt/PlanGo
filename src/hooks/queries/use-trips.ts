import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import { mapItinerary } from "@/lib/mappers";
import type { Itinerary } from "@/types";
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
    // Short freshness window so optimistic mutations still feel instant, but
    // returning to the app (a joiner accepted an invite while we were on
    // another screen) refetches and surfaces the new member without F5.
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnMount: true,
    // KEEP the previous list visible while refetching — fixes the flicker
    // where Companions tab momentarily dropped to "just owner" during a
    // refetch because `itinerary.companions` briefly became empty.
    placeholderData: keepPreviousData,
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
    // Same window — detail mutations invalidate explicitly, so 60s of cache
    // freshness saves the cold detail fetch when bouncing between tabs.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.trips() });
      const prevDetail = qc.getQueryData<Itinerary>(queryKeys.tripDetail(id));
      const prevLists: Array<{ key: readonly unknown[]; data: Itinerary[] }> = [];
      qc.getQueriesData<Itinerary[]>({ queryKey: ["trips", "list"] }).forEach(
        ([key, listData]) => {
          if (listData) {
            prevLists.push({ key, data: listData });
            qc.setQueryData<Itinerary[]>(
              key,
              listData.map((t) =>
                String(t.id) === String(id) ? ({ ...t, ...data } as Itinerary) : t,
              ),
            );
          }
        },
      );
      if (prevDetail) {
        qc.setQueryData<Itinerary>(queryKeys.tripDetail(id), {
          ...prevDetail,
          ...data,
        } as Itinerary);
      }
      return { prevDetail, prevLists };
    },
    onError: (_err, vars, context: any) => {
      if (context?.prevDetail) {
        qc.setQueryData(queryKeys.tripDetail(vars.id), context.prevDetail);
      }
      if (context?.prevLists) {
        for (const entry of context.prevLists as Array<{
          key: readonly unknown[];
          data: Itinerary[];
        }>) {
          qc.setQueryData(entry.key, entry.data);
        }
      }
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tripDetail(vars.id) });
      qc.invalidateQueries({ queryKey: ["trips", "list"] });
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
  return useMutation<
    any,
    Error,
    {
      destination: string;
      startDate: string;
      endDate: string;
      budget?: string | number;
      totalBudget?: number;
      numPeople?: number;
      preferences?: string[];
      startingPoint?: string;
    }
  >({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/generate-itinerary", input);
      const json = await res.json();
      // BE returns { status, message, data: { days, ... } } — unwrap so the
      // caller can read `.days` directly.
      return "data" in json ? json.data : json;
    },
  });
}
