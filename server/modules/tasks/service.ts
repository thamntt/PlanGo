import { tripTaskRepo } from "./repository";
import { tripRepo } from "../trips/repository";
import { errors, AppError } from "../../lib/errors";
import type { CreateTaskInput, UpdateTaskInput } from "./schema";

function normalizeDueDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // Accept yyyy-mm-dd or full ISO. Fall through to Date() if neither.
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function listTasks(tripId: number) {
  // Make sure the trip exists so the FE gets a 404 instead of an empty list
  // when the URL is bogus — easier debugging than a silent empty state.
  const trip = await tripRepo.getTrip(tripId);
  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");
  return tripTaskRepo.listByTrip(tripId);
}

export async function createTask(
  tripId: number,
  input: CreateTaskInput,
  createdByUserId: number,
) {
  const trip = await tripRepo.getTrip(tripId);
  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");

  try {
    const nextOrder = (await tripTaskRepo.getMaxOrderIndex(tripId)) + 1;
    return await tripTaskRepo.create({
      tripId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category || null,
      assigneeUserId: input.assigneeUserId ?? null,
      dueDate: normalizeDueDate(input.dueDate),
      isCompleted: !!input.isCompleted,
      completedAt: input.isCompleted ? new Date() : null,
      completedByUserId: input.isCompleted ? createdByUserId : null,
      createdByUserId,
      orderIndex: input.orderIndex ?? nextOrder,
    });
  } catch (err: any) {
    // Translate the cryptic Postgres "relation does not exist" error into a
    // clear hint so the user knows they need to run the migration.
    const msg = String(err?.message || err);
    if (/relation .*trip_tasks.* does not exist/i.test(msg)) {
      throw new AppError(
        "BAD_REQUEST",
        "Bảng trip_tasks chưa tồn tại — hãy chạy `npm run db:push` để tạo trước khi dùng tính năng Việc cần làm.",
      );
    }
    throw err;
  }
}

export async function updateTask(
  taskId: number,
  input: UpdateTaskInput,
  actorUserId: number,
) {
  const existing = await tripTaskRepo.getById(taskId);
  if (!existing) throw errors.notFound("Task");

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.description !== undefined) update.description = input.description?.trim() || null;
  if (input.category !== undefined) update.category = input.category || null;
  if (input.assigneeUserId !== undefined) update.assigneeUserId = input.assigneeUserId ?? null;
  if (input.dueDate !== undefined) update.dueDate = normalizeDueDate(input.dueDate);
  if (input.orderIndex !== undefined) update.orderIndex = input.orderIndex;

  // isCompleted transition handling — stamp completedAt/by on flip, clear on
  // un-flip. Keep them as-is when the value doesn't change.
  if (input.isCompleted !== undefined && input.isCompleted !== existing.isCompleted) {
    update.isCompleted = input.isCompleted;
    if (input.isCompleted) {
      update.completedAt = new Date();
      update.completedByUserId = actorUserId;
    } else {
      update.completedAt = null;
      update.completedByUserId = null;
    }
  }

  const updated = await tripTaskRepo.update(taskId, update as any);
  if (!updated) throw errors.notFound("Task");
  return updated;
}

export async function deleteTask(taskId: number) {
  const ok = await tripTaskRepo.delete(taskId);
  if (!ok) throw errors.notFound("Task");
}

export async function reorderTasks(tripId: number, taskIds: number[]) {
  const trip = await tripRepo.getTrip(tripId);
  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");
  await tripTaskRepo.reorder(tripId, taskIds);
}

export async function clearCompletedTasks(tripId: number) {
  const rows = await tripTaskRepo.listByTrip(tripId);
  const completedIds = rows.filter((r) => r.isCompleted).map((r) => r.taskId);
  await tripTaskRepo.deleteBulk(completedIds);
  return completedIds.length;
}
