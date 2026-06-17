import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/auth";
import * as svc from "./service";
import {
  createInvitationInputSchema,
  invitationIdParamSchema,
  tripIdParamSchema,
  sentQuerySchema,
} from "./schema";

async function sendInvitation(req: Request, res: Response) {
  const { tripId } = (req as any).validatedParams;
  const inviterId = Number(req.auth?.id || 0);
  const result = await svc.sendInvitation(tripId, inviterId, req.body);
  sendResponse(res, 201, "Invitation sent", result);
}

async function listReceived(req: Request, res: Response) {
  const userId = Number(req.auth?.id || 0);
  const data = await svc.listReceived(userId);
  sendResponse(res, 200, "Received invitations retrieved", data);
}

async function listSent(req: Request, res: Response) {
  const userId = Number(req.auth?.id || 0);
  const query = (req as any).validatedQuery;
  const data = await svc.listSent(userId, query);
  sendResponse(res, 200, "Sent invitations retrieved", data);
}

async function acceptInvitation(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const actorId = Number(req.auth?.id || 0);
  const data = await svc.acceptInvitation(id, actorId);
  sendResponse(res, 200, "Invitation accepted", data);
}

async function declineInvitation(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const actorId = Number(req.auth?.id || 0);
  const data = await svc.declineInvitation(id, actorId);
  sendResponse(res, 200, "Invitation declined", data);
}

async function cancelInvitation(req: Request, res: Response) {
  const { id } = (req as any).validatedParams;
  const actorId = Number(req.auth?.id || 0);
  const data = await svc.cancelInvitation(id, actorId);
  sendResponse(res, 200, "Invitation cancelled", data);
}

async function pendingCount(req: Request, res: Response) {
  const userId = Number(req.auth?.id || 0);
  const count = await svc.countPending(userId);
  sendResponse(res, 200, "OK", { count });
}

export function registerInvitationRoutes(app: Express) {
  app.post(
    "/api/trips/:tripId/invitations",
    requireAuth,
    validate({ params: tripIdParamSchema, body: createInvitationInputSchema }),
    asyncHandler(sendInvitation),
  );
  app.get(
    "/api/invitations/received",
    requireAuth,
    asyncHandler(listReceived),
  );
  app.get(
    "/api/invitations/received/count",
    requireAuth,
    asyncHandler(pendingCount),
  );
  app.get(
    "/api/invitations/sent",
    requireAuth,
    validate({ query: sentQuerySchema }),
    asyncHandler(listSent),
  );
  app.post(
    "/api/invitations/:id/accept",
    requireAuth,
    validate({ params: invitationIdParamSchema }),
    asyncHandler(acceptInvitation),
  );
  app.post(
    "/api/invitations/:id/decline",
    requireAuth,
    validate({ params: invitationIdParamSchema }),
    asyncHandler(declineInvitation),
  );
  app.delete(
    "/api/invitations/:id",
    requireAuth,
    validate({ params: invitationIdParamSchema }),
    asyncHandler(cancelInvitation),
  );
}
