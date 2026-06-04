import { z } from "zod";

const numericId = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().int().positive());

export const listDestinationsQuerySchema = z.object({
  typeId: z.string().regex(/^\d+$/).transform(Number).optional(),
});
export type ListDestinationsQuery = z.infer<typeof listDestinationsQuerySchema>;

export const createDestinationInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  images: z.array(z.string()).nullable().optional(),
  rating: z.union([z.string(), z.number()]).optional(),
  reviewCount: z.union([z.string(), z.number()]).optional(),
  destinationTypeId: numericId.optional(),
  category: z.string().optional(),
  googlePlaceId: z.string().optional(),
  googlePhotos: z.any().optional(),
  tags: z.array(z.string()).optional(),
});
export type CreateDestinationInput = z.infer<typeof createDestinationInputSchema>;

export const updateDestinationInputSchema = createDestinationInputSchema.partial();
export type UpdateDestinationInput = z.infer<typeof updateDestinationInputSchema>;

export const createDestinationTypeInputSchema = z.object({
  typeName: z.string().min(1),
  description: z.string().nullable().optional(),
});
export const updateDestinationTypeInputSchema = createDestinationTypeInputSchema.partial();
