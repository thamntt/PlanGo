import { z } from "zod";

export const listPoisQuerySchema = z.object({
  destinationId: z.string().regex(/^\d+$/).transform(Number).optional(),
});
export type ListPoisQuery = z.infer<typeof listPoisQuerySchema>;

export const createPoiInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  destinationId: z.union([z.string(), z.number()]).optional(),
  poitypeId: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  address: z.string().nullable().optional(),
  estimatedCost: z.union([z.string(), z.number()]).optional(),
  rating: z.union([z.string(), z.number()]).optional(),
  reviewCount: z.union([z.string(), z.number()]).optional(),
  reviewCounts: z.union([z.string(), z.number()]).optional(),
  googlePlaceId: z.string().optional(),
  openHours: z.string().optional(),
}).passthrough(); // legacy FE sends extra fields we strip in service

export type CreatePoiInput = z.infer<typeof createPoiInputSchema>;
export const updatePoiInputSchema = createPoiInputSchema.partial();
export type UpdatePoiInput = z.infer<typeof updatePoiInputSchema>;

export const createPoiTypeInputSchema = z.object({
  typeName: z.string().min(1),
  description: z.string().nullable().optional(),
});
export const updatePoiTypeInputSchema = createPoiTypeInputSchema.partial();
