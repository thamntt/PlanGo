import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { validate } from "../../middlewares/validate";
import { aiLimiter } from "../../middlewares/rate-limit";
import { optionalAuth } from "../../middlewares/auth";
import { generateItineraryInputSchema } from "./schema";
import { generateItinerary } from "./service";

async function generateItineraryHandler(req: Request, res: Response) {
  const data = await generateItinerary(req.body);
  sendResponse(res, 200, "Itinerary generated", data);
}

export function registerItineraryRoutes(app: Express) {
  app.post(
    "/api/generate-itinerary",
    optionalAuth,
    aiLimiter,
    validate({ body: generateItineraryInputSchema }),
    asyncHandler(generateItineraryHandler),
  );
}
