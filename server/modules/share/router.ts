import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { AppError, errors } from "../../lib/errors";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import { mapTripToFrontend } from "../../mappers/trip.mapper";
import {
  shareTripInputSchema,
  shareCodeParamSchema,
  joinSharedTripInputSchema,
  companionInputSchema,
} from "./schema";

async function shareTrip(req: Request, res: Response) {
  const body = req.body;
  const tripId = body.tripId || body.id || body.itinerary?.id;
  if (!tripId) throw errors.badRequest("tripId is required");

  const token = body.shareCode || Math.random().toString(36).substring(2, 9).toUpperCase();
  const trip = await storage.updateTrip(Number(tripId), {
    invitationToken: token,
    sharePermission:
      body.sharePermission || body.itinerary?.sharePermission || body.role || "viewer",
  });
  sendResponse(res, 200, "Trip shared", {
    shareCode: token,
    sharePermission: trip?.sharePermission || "viewer",
  });
}

async function getSharedTrip(req: Request, res: Response) {
  const { code } = (req as any).validatedParams;
  const trip = await storage.getTripByInvitationToken(code);
  if (!trip) throw new AppError("SHARE_CODE_NOT_FOUND", "Share code not found");
  sendResponse(res, 200, "Trip found", mapTripToFrontend(trip));
}

async function joinSharedTrip(req: Request, res: Response) {
  const { shareCode, userId, role, companion } = req.body;
  const finalUserId = userId || companion?.userId;
  if (!finalUserId) throw errors.badRequest("userId is required");

  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError("SHARE_CODE_NOT_FOUND", "Share code not found");

  const finalRole = role || companion?.role || trip.sharePermission || "viewer";
  const members = await storage.getTripMembers(trip.tripId);
  if (members.some((m) => m.userId === Number(finalUserId))) {
    return sendResponse(res, 200, "Already joined", {
      alreadyJoined: true,
      trip: mapTripToFrontend(trip),
    });
  }

  await storage.addTripMember({
    tripId: trip.tripId,
    userId: Number(finalUserId),
    role: finalRole,
  });

  const updatedTrip = await storage.getTripByInvitationToken(shareCode);
  sendResponse(res, 200, "Joined trip", {
    alreadyJoined: false,
    trip: mapTripToFrontend(updatedTrip),
  });
}

async function updateCompanionRole(req: Request, res: Response) {
  const { shareCode, userId, role } = req.body;
  if (!role) throw errors.badRequest("role is required");

  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError("SHARE_CODE_NOT_FOUND", "Share code not found");

  await storage.updateTripMember(trip.tripId, userId, { role });
  sendResponse(res, 200, "Success", null);
}

async function removeCompanion(req: Request, res: Response) {
  const { shareCode, userId } = req.body;
  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError("SHARE_CODE_NOT_FOUND", "Share code not found");
  await storage.removeTripMember(trip.tripId, userId);
  sendResponse(res, 200, "Success", null);
}

export function registerShareRoutes(app: Express) {
  app.post(
    "/api/share",
    requireAuth,
    validate({ body: shareTripInputSchema }),
    asyncHandler(shareTrip),
  );
  app.get(
    "/api/share/:code",
    validate({ params: shareCodeParamSchema }),
    asyncHandler(getSharedTrip),
  );
  app.post(
    "/api/share/join",
    requireAuth,
    validate({ body: joinSharedTripInputSchema }),
    asyncHandler(joinSharedTrip),
  );
  app.patch(
    "/api/share/companion",
    requireAuth,
    validate({ body: companionInputSchema }),
    asyncHandler(updateCompanionRole),
  );
  app.delete(
    "/api/share/companion",
    requireAuth,
    validate({ body: companionInputSchema }),
    asyncHandler(removeCompanion),
  );
}
