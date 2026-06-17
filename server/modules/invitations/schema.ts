import { z } from "zod";

const numericId = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().int().positive());

export const createInvitationInputSchema = z.object({
  inviteeUserId: numericId,
  role: z.enum(["viewer", "editor"]).default("viewer"),
  message: z.string().max(500).nullable().optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;

export const invitationIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const tripIdParamSchema = z.object({
  tripId: z.string().regex(/^\d+$/).transform(Number),
});

export const sentQuerySchema = z.object({
  tripId: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]).optional(),
});
