import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { validate, numericIdParam } from "../../middlewares/validate";
import { requireAdmin } from "../../middlewares/auth";
import {
  createPoiInputSchema,
  updatePoiInputSchema,
  listPoisQuerySchema,
  createPoiTypeInputSchema,
  updatePoiTypeInputSchema,
} from "./schema";
import * as svc from "./service";

async function listPois(req: Request, res: Response) {
  const data = await svc.listPois((req as any).validatedQuery);
  sendResponse(res, 200, "POIs retrieved successfully", data);
}
async function getPoiById(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.getPoiById(id);
  sendResponse(res, 200, "POI retrieved successfully", data);
}
async function createPoi(req: Request, res: Response) {
  const data = await svc.createPoi(req.body);
  sendResponse(res, 201, "POI created successfully", data);
}
async function updatePoi(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.updatePoi(id, req.body);
  sendResponse(res, 200, "POI updated successfully", data);
}
async function deletePoi(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  await svc.deletePoi(id);
  sendResponse(res, 200, "POI deleted successfully", null);
}

async function listPoiTypes(_req: Request, res: Response) {
  const data = await svc.listPoiTypes();
  sendResponse(res, 200, "Types retrieved successfully", data);
}
async function createPoiType(req: Request, res: Response) {
  const data = await svc.createPoiType(req.body);
  sendResponse(res, 201, "Type created successfully", data);
}
async function updatePoiType(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const data = await svc.updatePoiType(id, req.body);
  sendResponse(res, 200, "Type updated successfully", data);
}
async function deletePoiType(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  await svc.deletePoiType(id);
  sendResponse(res, 200, "Type deleted successfully", null);
}

export function registerPoiRoutes(app: Express) {
  app.get("/api/pois", validate({ query: listPoisQuerySchema }), asyncHandler(listPois));
  app.get("/api/pois/:id", validate({ params: numericIdParam }), asyncHandler(getPoiById));
  app.post("/api/pois", validate({ body: createPoiInputSchema }), asyncHandler(createPoi));
  app.put(
    "/api/pois/:id",
    validate({ params: numericIdParam, body: updatePoiInputSchema }),
    asyncHandler(updatePoi),
  );
  app.delete(
    "/api/pois/:id",
    requireAdmin,
    validate({ params: numericIdParam }),
    asyncHandler(deletePoi),
  );

  app.get("/api/poi-types", asyncHandler(listPoiTypes));
  app.post(
    "/api/poi-types",
    requireAdmin,
    validate({ body: createPoiTypeInputSchema }),
    asyncHandler(createPoiType),
  );
  app.put(
    "/api/poi-types/:id",
    requireAdmin,
    validate({ params: numericIdParam, body: updatePoiTypeInputSchema }),
    asyncHandler(updatePoiType),
  );
  app.delete(
    "/api/poi-types/:id",
    requireAdmin,
    validate({ params: numericIdParam }),
    asyncHandler(deletePoiType),
  );
}
