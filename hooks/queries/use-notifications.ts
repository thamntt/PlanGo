import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { mapNotification } from "@/lib/mappers";
import type { Notification } from "@/lib/storage";
import { queryKeys } from "./keys";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export function useNotifications(userId?: number | string) {
  return useQuery<Notification[]>({
    queryKey: queryKeys.notificationList(userId !== undefined ? Number(userId) : undefined),
    queryFn: async () => {
      const route = userId !== undefined ? `/api/notifications?userId=${userId}` : "/api/notifications";
      const res = await apiRequest("GET", route);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapNotification);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation<void, Error, { userId: number | string }>({
    mutationFn: async ({ userId }) => {
      await apiRequest("PATCH", "/api/notifications/mark-read", { userId: Number(userId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications() }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation<void, Error, string | number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications() }),
  });
}
