import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { mapDestination, mapDestinationType } from "@/lib/mappers";
import type { Destination, DestinationType } from "@/lib/storage";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export function useDestinations(typeId?: number) {
  return useQuery<Destination[]>({
    queryKey: queryKeys.destinationList(typeId),
    queryFn: async () => {
      const route = typeId !== undefined ? `/api/destinations?typeId=${typeId}` : "/api/destinations";
      const res = await apiRequest("GET", route);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapDestination);
    },
  });
}

export function useDestination(id: string | number | undefined) {
  return useQuery<Destination | null>({
    queryKey: queryKeys.destinationDetail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await apiRequest("GET", `/api/destinations/${id}`);
      const data = await unwrap<any>(res);
      return data ? mapDestination(data) : null;
    },
    enabled: id !== undefined && id !== null && id !== "",
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
