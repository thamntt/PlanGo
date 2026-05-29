import { z } from "zod";

const numericId = z.union([z.string(), z.number()]).transform((v) => Number(v)).pipe(z.number().int().positive());

export const shareTripInputSchema = z.object({
  tripId: numericId.optional(),
  id: numericId.optional(),
  shareCode: z.string().optional(),
  sharePermission: z.enum(["viewer", "editor"]).optional(),
  role: z.enum(["viewer", "editor"]).optional(),
  itinerary: z.object({
    id: numericId.optional(),
    sharePermission: z.enum(["viewer", "editor"]).optional(),
  }).optional(),
}).refine((d) => d.tripId || d.id || d.itinerary?.id, { message: "tripId required" });

export const shareCodeParamSchema = z.object({
  code: z.string().min(1),
});

export const joinSharedTripInputSchema = z.object({
  shareCode: z.string().min(1),
  userId: numericId.optional(),
  role: z.enum(["viewer", "editor"]).optional(),
  companion: z.object({
    userId: numericId,
    role: z.enum(["viewer", "editor"]).optional(),
  }).optional(),
}).refine((d) => d.userId || d.companion?.userId, { message: "userId required" });

export const companionInputSchema = z.object({
  shareCode: z.string().min(1),
  userId: numericId,
  role: z.enum(["viewer", "editor"]).optional(),
});
