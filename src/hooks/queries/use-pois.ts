import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import { mapPoi } from "@/lib/mappers";
import type { POI } from "@/types";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export function usePois(destinationId?: number) {
  return useQuery<POI[]>({
    queryKey: queryKeys.poiList(destinationId),
    queryFn: async () => {
      const route = destinationId !== undefined ? `/api/pois?destinationId=${destinationId}` : "/api/pois";
      const res = await apiRequest("GET", route);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapPoi);
    },
  });
}

export function usePoi(id: string | number | undefined) {
  return useQuery<POI | null>({
    queryKey: queryKeys.poiDetail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await apiRequest("GET", `/api/pois/${id}`);
      const data = await unwrap<any>(res);
      return data ? mapPoi(data) : null;
    },
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useCreatePoi() {
  const qc = useQueryClient();
  return useMutation<POI, Error, Omit<POI, "id">>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", "/api/pois", input);
      const data = await unwrap<any>(res);
      return mapPoi(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pois() }),
  });
}

export function useUpdatePoi() {
  const qc = useQueryClient();
  return useMutation<POI, Error, { id: string | number; data: Partial<POI> }>({
    mutationFn: async ({ id, data }) => {
      const res = await apiRequest("PUT", `/api/pois/${id}`, data);
      const result = await unwrap<any>(res);
      return mapPoi(result);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.pois() });
      qc.invalidateQueries({ queryKey: queryKeys.poiDetail(vars.id) });
    },
  });
}

export function useDeletePoi() {
  const qc = useQueryClient();
  return useMutation<void, Error, string | number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/pois/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pois() }),
  });
}
