import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import * as svc from "./service";
import {
  createTaskInputSchema,
  updateTaskInputSchema,
  reorderTasksInputSchema,
  tripIdParamSchema,
  taskIdParamSchema,
} from "./schema";

async function listTasks(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const data = await svc.listTasks(tripId);
  sendResponse(res, 200, "Tasks retrieved", data);
}

async function createTask(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const actorId = Number(req.auth?.id || 0);
  const data = await svc.createTask(tripId, req.body, actorId);
  sendResponse(res, 201, "Task created", data);
}

async function updateTask(req: Request, res: Response) {
  const { taskId } = (req as any).validatedParams;
  const actorId = Number(req.auth?.id || 0);
  const data = await svc.updateTask(taskId, req.body, actorId);
  sendResponse(res, 200, "Task updated", data);
}

async function deleteTask(req: Request, res: Response) {
  const { taskId } = (req as any).validatedParams;
  await svc.deleteTask(taskId);
  sendResponse(res, 200, "Task deleted", null);
}

async function reorderTasks(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  await svc.reorderTasks(tripId, req.body.taskIds);
  sendResponse(res, 200, "Tasks reordered", null);
}

async function clearCompleted(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const deleted = await svc.clearCompletedTasks(tripId);
  sendResponse(res, 200, "Completed tasks cleared", { deleted });
}

export function registerTaskRoutes(app: Express) {
  app.get(
    "/api/trips/:tripId/tasks",
    requireAuth,
    validate({ params: tripIdParamSchema }),
    asyncHandler(listTasks),
  );
  app.post(
    "/api/trips/:tripId/tasks",
    requireAuth,
    validate({ params: tripIdParamSchema, body: createTaskInputSchema }),
    asyncHandler(createTask),
  );
  app.put(
    "/api/tasks/:taskId",
    requireAuth,
    validate({ params: taskIdParamSchema, body: updateTaskInputSchema }),
    asyncHandler(updateTask),
  );
  app.delete(
    "/api/tasks/:taskId",
    requireAuth,
    validate({ params: taskIdParamSchema }),
    asyncHandler(deleteTask),
  );
  app.post(
    "/api/trips/:tripId/tasks/reorder",
    requireAuth,
    validate({ params: tripIdParamSchema, body: reorderTasksInputSchema }),
    asyncHandler(reorderTasks),
  );
  app.delete(
    "/api/trips/:tripId/tasks/completed",
    requireAuth,
    validate({ params: tripIdParamSchema }),
    asyncHandler(clearCompleted),
  );
}
