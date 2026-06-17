import { z } from "zod";

const numericId = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().int().positive());

export const tripIdParamSchema = z.object({
  tripId: z.string().regex(/^\d+$/).transform(Number),
});

export const taskIdParamSchema = z.object({
  taskId: z.string().regex(/^\d+$/).transform(Number),
});

/**
 * Tasks accept ISO date strings or epoch numbers for `dueDate`; both get
 * normalised to a Date in the service. `category` is free-form on the
 * server — the FE will only use prep/during/after, but admin or future
 * features can introduce new ones without a migration.
 */
export const createTaskInputSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được trống").max(255),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  assigneeUserId: numericId.nullable().optional(),
  dueDate: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskInputSchema = createTaskInputSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const reorderTasksInputSchema = z.object({
  taskIds: z.array(numericId).min(1),
});
export type ReorderTasksInput = z.infer<typeof reorderTasksInputSchema>;
