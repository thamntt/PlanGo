import { z } from "zod";

export const generateItineraryInputSchema = z.object({
  destination: z.string().min(1, "destination is required"),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  budget: z.union([z.string(), z.number()]).optional(),
  totalBudget: z.number().nonnegative().optional(),
  numPeople: z.number().int().positive().optional(),
  preferences: z.array(z.string()).optional(),
  startingPoint: z.string().optional(),
});

export type GenerateItineraryInput = z.infer<typeof generateItineraryInputSchema>;
