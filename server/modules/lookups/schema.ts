import { z } from "zod";

export const createTypeInputSchema = z
  .object({
    name: z.string().optional(),
    typeName: z.string().optional(),
    description: z.string().nullable().optional(),
  })
  .refine((d) => d.name || d.typeName, { message: "name or typeName required" });

export const updateTypeInputSchema = z.object({
  name: z.string().optional(),
  typeName: z.string().optional(),
  description: z.string().nullable().optional(),
});

export const createPreferenceInputSchema = z.object({
  preferenceName: z.string().min(1),
});

export const updatePreferenceInputSchema = createPreferenceInputSchema.partial();
