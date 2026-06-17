import { z } from "zod";

// ── Reusable primitives ──

const numericString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .pipe(z.number());

const positiveInt = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().int().positive());

const optionalNumeric = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)))
  .optional();

// ── Activity (nested in days) ──

export const activityInputSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  poiId: z.union([z.string(), z.number(), z.null()]).optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  time: z.string().nullable().optional(), // "HH:mm"
  duration: z.union([z.string(), z.number(), z.null()]).optional(),
  estimatedCost: z.union([z.string(), z.number(), z.null()]).optional(),
  actualCost: z.union([z.string(), z.number(), z.null()]).optional(),
  activityType: z
    .enum(["food", "sightseeing", "transport", "shopping", "hotel", "other"])
    .nullable()
    .optional(),
  expenseTypeId: z.union([z.string(), z.number(), z.null()]).optional(),
  latitude: z.union([z.string(), z.number(), z.null()]).optional(),
  longitude: z.union([z.string(), z.number(), z.null()]).optional(),
  address: z.string().nullable().optional(),
  googlePlaceId: z.string().nullable().optional(),
  destinationId: z.union([z.string(), z.number(), z.null()]).optional(),
  isCompleted: z.boolean().optional(),
  note: z.string().nullable().optional(),
  notes: z.array(z.string()).nullable().optional(), // legacy
});

export type ActivityInput = z.infer<typeof activityInputSchema>;

// ── Day (nested in trip) ──

export const dayInputSchema = z.object({
  day: z.number().int().positive().optional(),
  dayIndex: z.number().int().positive().optional(),
  dayId: z.union([z.string(), z.number(), z.null()]).optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  title: z.string().nullable().optional(),
  activities: z.array(activityInputSchema).nullable().optional(),
});

export type DayInput = z.infer<typeof dayInputSchema>;

// ── Expense (nested in trip update) ──

export const tripExpenseInputSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  paidByUserId: z.union([z.string(), z.number()]).optional(),
  userId: z.union([z.string(), z.number()]).optional(),
  activityId: z.union([z.string(), z.number()]).optional(),
  splitType: z.enum(["equal", "shares", "exact", "none"]).optional(),
  splits: z
    .array(
      z.object({
        userId: z.union([z.string(), z.number()]),
        amount: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),
  date: z.string().optional(),
  createdAt: z.string().optional(),
});

export type TripExpenseInput = z.infer<typeof tripExpenseInputSchema>;

// ── Trip create ──

export const createTripInputSchema = z.object({
  // Optional — service auto-derives from `destination` / `destinations` if
  // missing. FE doesn't always send it.
  title: z.string().min(1).optional(),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  budget: z.union([z.string(), z.number()]).optional(),
  numPeople: positiveInt.optional(),
  status: z.enum(["draft", "active", "completed"]).optional(),
  destination: z.string().optional(),
  destinationId: positiveInt.optional(),
  // Multi-destination breakdown — service uses this to build a chained title
  // ("Chuyến đi Đà Nẵng → Hội An → Huế") and to allocate days per city.
  destinations: z
    .array(
      z.object({
        name: z.string().min(1),
        days: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  startingPoint: z.string().optional(),
  totalBudget: z.number().nonnegative().optional(),
  ownerId: positiveInt.optional(),
  userId: positiveInt.optional(),
  preferences: z.array(z.string()).optional(),
  generatedByAi: z.boolean().optional(),
  days: z.array(dayInputSchema).optional(),
});

export type CreateTripInput = z.infer<typeof createTripInputSchema>;

// ── Trip update ──

export const updateTripInputSchema = createTripInputSchema.partial().extend({
  invitationToken: z.string().optional(),
  sharePermission: z.enum(["viewer", "editor"]).optional(),
  expenses: z.array(tripExpenseInputSchema).optional(),
});

export type UpdateTripInput = z.infer<typeof updateTripInputSchema>;

// ── List query ──

export const listTripsQuerySchema = z.object({
  ownerId: z.string().regex(/^\d+$/).transform(Number).optional(),
  memberId: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;

// ── Day create on trip ──

export const createDayInputSchema = z.object({
  date: z.string().optional(),
  dayIndex: z.number().int().positive(),
  title: z.string().optional(),
});

export type CreateDayInput = z.infer<typeof createDayInputSchema>;

// ── Item create on day ──

export const createItemInputSchema = z.object({
  tripId: positiveInt.optional(),
  poiId: positiveInt.optional(),
  customName: z.string().optional(),
  startTime: z.string().optional(),
  duration: z.number().int().positive().optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  estimatedCost: z.union([z.string(), z.number()]).optional(),
  status: z.enum(["pending", "completed", "skipped"]).optional(),
  expenseTypeId: positiveInt.optional(),
  activityType: z.string().optional(),
  note: z.string().nullable().optional(),
});

export type CreateItemInput = z.infer<typeof createItemInputSchema>;

// ── Expense create on trip ──

export const createTripExpenseInputSchema = z.object({
  description: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  paidBy: positiveInt.optional(),
  splitMethod: z.enum(["equal", "shares", "exact", "none"]).optional(),
  itemId: positiveInt.optional(),
  expenseTypeId: positiveInt.optional(),
});

export type CreateTripExpenseInput = z.infer<typeof createTripExpenseInputSchema>;
