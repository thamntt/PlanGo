import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { validate, numericIdParam } from "../../middlewares/validate";
import { requireAdmin } from "../../middlewares/auth";
import {
  createDestinationInputSchema,
  updateDestinationInputSchema,
  listDestinationsQuerySchema,
  createDestinationTypeInputSchema,
  updateDestinationTypeInputSchema,
} from "./schema";
import * as svc from "./service";

async function listDestinations(req: Request, res: Response) {
  const data = await svc.listDestinations((req as any).validatedQuery);
  sendResponse(res, 200, "Destinations retrieved successfully", data);
}
async function getDestinationById(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.getDestinationById(id);
  sendResponse(res, 200, "Destination retrieved successfully", data);
}
async function createDestination(req: Request, res: Response) {
  const data = await svc.createDestination(req.body);
  sendResponse(res, 201, "Destination created successfully", data);
}
async function updateDestination(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.updateDestination(id, req.body);
  sendResponse(res, 200, "Destination updated successfully", data);
}
async function deleteDestination(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  await svc.deleteDestination(id);
  sendResponse(res, 200, "Destination deleted successfully", null);
}

async function listDestinationTypes(_req: Request, res: Response) {
  const data = await svc.listDestinationTypes();
  sendResponse(res, 200, "Types retrieved successfully", data);
}
async function createDestinationType(req: Request, res: Response) {
  const data = await svc.createDestinationType(req.body);
  sendResponse(res, 201, "Type created successfully", data);
}
async function updateDestinationType(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.updateDestinationType(id, req.body);
  sendResponse(res, 200, "Type updated successfully", data);
}
async function deleteDestinationType(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  await svc.deleteDestinationType(id);
  sendResponse(res, 200, "Type deleted successfully", null);
}

export function registerDestinationRoutes(app: Express) {
  app.get("/api/destinations", validate({ query: listDestinationsQuerySchema }), asyncHandler(listDestinations));
  app.get("/api/destinations/:id", validate({ params: numericIdParam }), asyncHandler(getDestinationById));
  app.post("/api/destinations", requireAdmin, validate({ body: createDestinationInputSchema }), asyncHandler(createDestination));
  app.put("/api/destinations/:id", requireAdmin, validate({ params: numericIdParam, body: updateDestinationInputSchema }), asyncHandler(updateDestination));
  app.delete("/api/destinations/:id", requireAdmin, validate({ params: numericIdParam }), asyncHandler(deleteDestination));

  app.get("/api/destination-types", asyncHandler(listDestinationTypes));
  app.post("/api/destination-types", requireAdmin, validate({ body: createDestinationTypeInputSchema }), asyncHandler(createDestinationType));
  app.put("/api/destination-types/:id", requireAdmin, validate({ params: numericIdParam, body: updateDestinationTypeInputSchema }), asyncHandler(updateDestinationType));
  app.delete("/api/destination-types/:id", requireAdmin, validate({ params: numericIdParam }), asyncHandler(deleteDestinationType));
}
