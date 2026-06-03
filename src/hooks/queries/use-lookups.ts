import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import { mapExpenseType, mapPoiType, mapPreference } from "@/lib/mappers";
import type { ExpenseType, PoiType, Preference } from "@/types";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export function useExpenseTypes() {
  return useQuery<ExpenseType[]>({
    queryKey: queryKeys.expenseTypes(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/expense-types");
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapExpenseType);
    },
  });
}

export function usePoiTypes() {
  return useQuery<PoiType[]>({
    queryKey: queryKeys.poiTypes(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/poi-types");
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapPoiType);
    },
  });
}

export function usePreferences() {
  return useQuery<Preference[]>({
    queryKey: queryKeys.preferences(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/preferences");
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapPreference);
    },
  });
}
