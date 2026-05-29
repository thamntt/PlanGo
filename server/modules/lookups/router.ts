import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { errors } from "../../lib/errors";
import { validate, numericIdParam } from "../../middlewares/validate";
import { requireAdmin } from "../../middlewares/auth";
import {
  createTypeInputSchema,
  updateTypeInputSchema,
  createPreferenceInputSchema,
  updatePreferenceInputSchema,
} from "./schema";

// ── Expense types ──
async function listExpenseTypes(_req: Request, res: Response) {
  const items = await storage.getExpenseTypes();
  sendResponse(res, 200, "Types retrieved successfully", items);
}
async function getExpenseTypeById(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const item = await storage.getExpenseType(id);
  if (!item) throw errors.notFound("Type");
  sendResponse(res, 200, "Type retrieved successfully", item);
}
async function createExpenseType(req: Request, res: Response) {
  const item = await storage.createExpenseType(req.body);
  sendResponse(res, 201, "Type created successfully", item);
}
async function updateExpenseType(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const item = await storage.updateExpenseType(id, req.body);
  if (!item) throw errors.notFound("Type");
  sendResponse(res, 200, "Type updated successfully", item);
}
async function deleteExpenseType(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const ok = await storage.deleteExpenseType(id);
  if (!ok) throw errors.notFound("Type");
  sendResponse(res, 200, "Type deleted successfully", null);
}

// ── Preferences ──
async function listPreferences(_req: Request, res: Response) {
  const items = await storage.getPreferences();
  sendResponse(res, 200, "Preferences retrieved successfully", items);
}
async function createPreference(req: Request, res: Response) {
  const item = await storage.createPreference(req.body);
  sendResponse(res, 201, "Preference created successfully", item);
}
async function updatePreference(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const item = await storage.updatePreference(id, req.body);
  if (!item) throw errors.notFound("Preference");
  sendResponse(res, 200, "Preference updated successfully", item);
}
async function deletePreference(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const ok = await storage.deletePreference(id);
  if (!ok) throw errors.notFound("Preference");
  sendResponse(res, 200, "Preference deleted successfully", null);
}

export function registerLookupRoutes(app: Express) {
  app.get("/api/expense-types", asyncHandler(listExpenseTypes));
  app.get("/api/expense-types/:id", validate({ params: numericIdParam }), asyncHandler(getExpenseTypeById));
  app.post("/api/expense-types", requireAdmin, validate({ body: createTypeInputSchema }), asyncHandler(createExpenseType));
  app.put("/api/expense-types/:id", requireAdmin, validate({ params: numericIdParam, body: updateTypeInputSchema }), asyncHandler(updateExpenseType));
  app.delete("/api/expense-types/:id", requireAdmin, validate({ params: numericIdParam }), asyncHandler(deleteExpenseType));

  app.get("/api/preferences", asyncHandler(listPreferences));
  app.post("/api/preferences", requireAdmin, validate({ body: createPreferenceInputSchema }), asyncHandler(createPreference));
  app.put("/api/preferences/:id", requireAdmin, validate({ params: numericIdParam, body: updatePreferenceInputSchema }), asyncHandler(updatePreference));
  app.delete("/api/preferences/:id", requireAdmin, validate({ params: numericIdParam }), asyncHandler(deletePreference));
}
