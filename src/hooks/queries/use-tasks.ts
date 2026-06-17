import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/query-client";
import type { TripTask } from "@/types";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json)
    return json.data as T;
  return json as T;
}

function mapTask(t: any): TripTask {
  return {
    id: String(t.taskId ?? t.id ?? ""),
    tripId: String(t.tripId ?? ""),
    title: t.title || "",
    description: t.description ?? null,
    category: (t.category as TripTask["category"]) ?? null,
    assigneeUserId: t.assigneeUserId != null ? String(t.assigneeUserId) : null,
    assigneeName: t.assigneeName ?? t.assigneeUserName ?? null,
    assigneeAvatarUrl: t.assigneeAvatarUrl ?? null,
    dueDate: t.dueDate ?? null,
    isCompleted: !!t.isCompleted,
    completedAt: t.completedAt ?? null,
    completedByUserId: t.completedByUserId != null ? String(t.completedByUserId) : null,
    createdByUserId: t.createdByUserId != null ? String(t.createdByUserId) : null,
    orderIndex: Number(t.orderIndex ?? 0),
    createdAt: t.createdAt ?? new Date().toISOString(),
  };
}

const tasksKey = (tripId: string | number) => ["trip-tasks", String(tripId)] as const;

export function useTripTasks(tripId: string | number | undefined) {
  return useQuery<TripTask[]>({
    queryKey: tasksKey(tripId ?? ""),
    enabled: !!tripId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/trips/${tripId}/tasks`);
      const data = await unwrap<any[]>(res);
      return (data ?? []).map(mapTask);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

type CreateInput = {
  title: string;
  description?: string | null;
  category?: TripTask["category"];
  assigneeUserId?: string | number | null;
  dueDate?: string | null;
};

export function useCreateTripTask(tripId: string | number) {
  const qc = useQueryClient();
  return useMutation<TripTask, Error, CreateInput>({
    mutationFn: async (input) => {
      const res = await apiRequest("POST", `/api/trips/${tripId}/tasks`, {
        ...input,
        assigneeUserId: input.assigneeUserId ? Number(input.assigneeUserId) : null,
      });
      const data = await unwrap<any>(res);
      return mapTask(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(tripId) }),
  });
}

type UpdateInput = Partial<CreateInput> & { isCompleted?: boolean; orderIndex?: number };

export function useUpdateTripTask(tripId: string | number) {
  const qc = useQueryClient();
  return useMutation<TripTask, Error, { taskId: string | number; data: UpdateInput }>({
    mutationFn: async ({ taskId, data }) => {
      const payload: any = { ...data };
      if (payload.assigneeUserId !== undefined) {
        payload.assigneeUserId = payload.assigneeUserId
          ? Number(payload.assigneeUserId)
          : null;
      }
      const res = await apiRequest("PUT", `/api/tasks/${taskId}`, payload);
      const resJson = await unwrap<any>(res);
      return mapTask(resJson);
    },
    // Optimistic — flipping a checkbox should feel instant.
    onMutate: async ({ taskId, data }) => {
      await qc.cancelQueries({ queryKey: tasksKey(tripId) });
      const prev = qc.getQueryData<TripTask[]>(tasksKey(tripId));
      if (prev) {
        const merged: TripTask[] = prev.map((t) =>
          String(t.id) === String(taskId) ? ({ ...t, ...data } as TripTask) : t,
        );
        qc.setQueryData<TripTask[]>(tasksKey(tripId), merged);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(tasksKey(tripId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey(tripId) }),
  });
}

export function useDeleteTripTask(tripId: string | number) {
  const qc = useQueryClient();
  return useMutation<void, Error, string | number>({
    mutationFn: async (taskId) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: tasksKey(tripId) });
      const prev = qc.getQueryData<TripTask[]>(tasksKey(tripId));
      if (prev) {
        qc.setQueryData<TripTask[]>(
          tasksKey(tripId),
          prev.filter((t) => String(t.id) !== String(taskId)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(tasksKey(tripId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey(tripId) }),
  });
}

export function useClearCompletedTasks(tripId: string | number) {
  const qc = useQueryClient();
  return useMutation<{ deleted: number }, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/trips/${tripId}/tasks/completed`);
      return await unwrap<any>(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(tripId) }),
  });
}
