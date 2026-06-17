import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { asyncHandler, sendResponse } from "../../lib/http";
import { AppError, errors } from "../../lib/errors";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import { mapTripToFrontend } from "../../mappers/trip.mapper";
import {
  notifyMemberJoined,
  notifyMemberLeft,
  notifyRoleChanged,
} from "../../lib/notify";
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
  // Use the lightweight lookup — the join landing page only needs trip header
  // data + members, not all nested days/activities/expenses. The full query
  // takes 5-10s cold; this trims to ~200ms.
  const trip = await storage.getTripByInvitationTokenLight(code);
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

  // Fire notification to all existing members + owner (skip joiner).
  const joiner = await storage.getUser(Number(finalUserId)).catch(() => null);
  const joinerName = joiner
    ? (joiner as any).fullName || (joiner as any).userName || `Người dùng ${finalUserId}`
    : `Người dùng ${finalUserId}`;
  notifyMemberJoined(trip.tripId, Number(finalUserId), joinerName).catch(() => {});

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

  const actor = (req as any).user;
  const actorName = actor
    ? (actor as any).fullName || (actor as any).userName || "Chủ chuyến"
    : "Chủ chuyến";
  notifyRoleChanged(trip.tripId, Number(userId), role, {
    id: Number(actor?.id || 0),
    name: actorName,
  }).catch(() => {});

  sendResponse(res, 200, "Success", null);
}

/**
 * Owner-initiated invite by username: looks up the user, ensures they're not
 * already a member, then adds them as a companion in one shot. Used by the
 * invite-by-username flow in the Companions tab.
 */
async function inviteMemberByUserId(req: Request, res: Response) {
  const tripId = Number(req.params.tripId);
  const { userId, role } = req.body;
  if (!tripId || isNaN(tripId)) throw errors.badRequest("Invalid trip ID");
  if (!userId) throw errors.badRequest("userId is required");

  const trip = await storage.getTrip(tripId);
  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");

  // Only owner can invite by direct add
  const viewer = (req as any).user;
  if (!viewer || String(viewer.id) !== String(trip.ownerId)) {
    throw errors.forbidden();
  }

  if (String(userId) === String(trip.ownerId)) {
    throw errors.badRequest("Cannot invite the trip owner");
  }

  const members = await storage.getTripMembers(tripId);
  if (members.some((m) => m.userId === Number(userId))) {
    return sendResponse(res, 200, "Already a member", { alreadyMember: true });
  }

  await storage.addTripMember({
    tripId,
    userId: Number(userId),
    role: role || "viewer",
  });

  const joiner = await storage.getUser(Number(userId)).catch(() => null);
  const joinerName = joiner
    ? (joiner as any).fullName || (joiner as any).userName || `Người dùng ${userId}`
    : `Người dùng ${userId}`;
  notifyMemberJoined(tripId, Number(userId), joinerName).catch(() => {});

  sendResponse(res, 200, "Member added", { alreadyMember: false });
}

async function removeCompanion(req: Request, res: Response) {
  const { shareCode, userId } = req.body;
  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError("SHARE_CODE_NOT_FOUND", "Share code not found");

  const leaver = await storage.getUser(Number(userId)).catch(() => null);
  const leaverName = leaver
    ? (leaver as any).fullName || (leaver as any).userName || `Người dùng ${userId}`
    : `Người dùng ${userId}`;

  await storage.removeTripMember(trip.tripId, userId);

  notifyMemberLeft(trip.tripId, Number(userId), leaverName).catch(() => {});

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
  app.post(
    "/api/trips/:tripId/invite-member",
    requireAuth,
    asyncHandler(inviteMemberByUserId),
  );
  app.delete(
    "/api/share/companion",
    requireAuth,
    validate({ body: companionInputSchema }),
    asyncHandler(removeCompanion),
  );
}
