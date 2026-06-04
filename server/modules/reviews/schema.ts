import { z } from "zod";

const numericId = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().int().positive());

export const listReviewsQuerySchema = z.object({
  tripId: z.string().regex(/^\d+$/).transform(Number).optional(),
  itemId: z.string().regex(/^\d+$/).transform(Number).optional(),
  destinationId: z.string().regex(/^\d+$/).transform(Number).optional(),
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const createReviewInputSchema = z.object({
  userId: numericId,
  tripId: numericId.optional(),
  itineraryId: numericId.optional(),
  itemId: numericId.optional(),
  activityId: numericId.optional(),
  poiId: numericId.optional(),
  rating: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().min(0).max(5)),
  comment: z.string().nullable().optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

export const updateReviewInputSchema = createReviewInputSchema.partial().extend({
  type: z.enum(["trip", "item"]).optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;

export const deleteReviewQuerySchema = z.object({
  userId: z.string().regex(/^\d+$/).transform(Number),
  type: z.enum(["trip", "item"]).optional(),
});
export type DeleteReviewQuery = z.infer<typeof deleteReviewQuerySchema>;
