import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  userId: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const createNotificationInputSchema = z.object({
  userId: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().positive()),
  tripId: z.union([z.string(), z.number()]).optional(),
  title: z.string().min(1),
  message: z.string(),
  type: z.string().optional(),
  isRead: z.boolean().optional(),
}).passthrough();

export const updateNotificationInputSchema = z.object({
  isRead: z.boolean().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

export const markReadInputSchema = z.object({
  userId: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int().positive()),
});
