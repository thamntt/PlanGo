import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import {
  validate,
  numericIdParam,
  numericTripIdParam,
  numericDayIdParam,
} from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import * as tripService from "./service";
import {
  createTripInputSchema,
  updateTripInputSchema,
  listTripsQuerySchema,
  createDayInputSchema,
  createItemInputSchema,
  createTripExpenseInputSchema,
} from "./schema";

// ══════════════════════════════════════════════════════════════
// Handlers (thin HTTP layer)
// ══════════════════════════════════════════════════════════════

async function listTrips(req: Request, res: Response) {
  const query = (req as any).validatedQuery as Zod.infer<typeof listTripsQuerySchema>;
  const data = await tripService.listTrips(query);
  sendResponse(res, 200, "Trips retrieved successfully", data);
}

async function getTripById(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await tripService.getTrip(id);
  sendResponse(res, 200, "Trip retrieved successfully", data);
}

async function createTrip(req: Request, res: Response) {
  const data = await tripService.createTrip(req.body);
  sendResponse(res, 201, "Trip created successfully", data);
}

async function updateTrip(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await tripService.updateTrip(id, req.body);
  sendResponse(res, 200, "Trip updated successfully", data);
}

async function deleteTrip(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  await tripService.deleteTrip(id);
  sendResponse(res, 200, "Trip deleted successfully", null);
}

async function getTripDays(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const data = await tripService.getTripDays(tripId);
  sendResponse(res, 200, "Days retrieved successfully", data);
}

async function createTripDay(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const data = await tripService.createTripDay(tripId, req.body);
  sendResponse(res, 201, "Day created successfully", data);
}

async function getDayItems(req: Request, res: Response) {
  const { dayId } = (req as any).validatedParams;
  const data = await tripService.getDayItems(dayId);
  sendResponse(res, 200, "Items retrieved successfully", data);
}

async function createDayItem(req: Request, res: Response) {
  const { dayId } = (req as any).validatedParams;
  const data = await tripService.createDayItem(dayId, req.body);
  sendResponse(res, 201, "Item created successfully", data);
}

async function getTripExpenses(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const data = await tripService.getTripExpenses(tripId);
  sendResponse(res, 200, "Expenses retrieved successfully", data);
}

async function createTripExpense(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const data = await tripService.createTripExpense(tripId, req.body);
  sendResponse(res, 201, "Expense created successfully", data);
}

// ══════════════════════════════════════════════════════════════
// Register
// ══════════════════════════════════════════════════════════════

export function registerTripRoutes(app: Express) {
  app.get(
    "/api/trips",
    requireAuth,
    validate({ query: listTripsQuerySchema }),
    asyncHandler(listTrips),
  );
  app.get(
    "/api/trips/:id",
    requireAuth,
    validate({ params: numericIdParam }),
    asyncHandler(getTripById),
  );
  app.post(
    "/api/trips",
    requireAuth,
    validate({ body: createTripInputSchema }),
    asyncHandler(createTrip),
  );
  app.put(
    "/api/trips/:id",
    requireAuth,
    validate({ params: numericIdParam, body: updateTripInputSchema }),
    asyncHandler(updateTrip),
  );
  app.delete(
    "/api/trips/:id",
    requireAuth,
    validate({ params: numericIdParam }),
    asyncHandler(deleteTrip),
  );

  app.get(
    "/api/trips/:tripId/days",
    requireAuth,
    validate({ params: numericTripIdParam }),
    asyncHandler(getTripDays),
  );
  app.post(
    "/api/trips/:tripId/days",
    requireAuth,
    validate({ params: numericTripIdParam, body: createDayInputSchema }),
    asyncHandler(createTripDay),
  );
  app.get(
    "/api/days/:dayId/items",
    requireAuth,
    validate({ params: numericDayIdParam }),
    asyncHandler(getDayItems),
  );
  app.post(
    "/api/days/:dayId/items",
    requireAuth,
    validate({ params: numericDayIdParam, body: createItemInputSchema }),
    asyncHandler(createDayItem),
  );

  app.get(
    "/api/trips/:tripId/expenses",
    requireAuth,
    validate({ params: numericTripIdParam }),
    asyncHandler(getTripExpenses),
  );
  app.post(
    "/api/trips/:tripId/expenses",
    requireAuth,
    validate({ params: numericTripIdParam, body: createTripExpenseInputSchema }),
    asyncHandler(createTripExpense),
  );
}

// Reference for Zod inference inside the file
declare namespace Zod {
  type infer<T> = T extends { _output: infer O } ? O : never;
}
