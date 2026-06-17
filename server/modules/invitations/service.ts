import { invitationRepo } from "./repository";
import { tripRepo } from "../trips/repository";
import { userRepo } from "../users/repository";
import { AppError, errors } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";
import type { CreateInvitationInput } from "./schema";

/**
 * Owner sends an explicit invitation. We refuse to create duplicates for the
 * same (trip, invitee) when one is still pending — the owner can cancel and
 * re-invite instead.
 */
export async function sendInvitation(
  tripId: number,
  inviterUserId: number,
  input: CreateInvitationInput,
) {
  const trip = await tripRepo.getTrip(tripId);
  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");
  if (String(trip.ownerId) !== String(inviterUserId)) {
    throw errors.forbidden();
  }
  if (input.inviteeUserId === inviterUserId) {
    throw errors.badRequest("Bạn không thể tự mời chính mình.");
  }

  const invitee = await userRepo.getUser(input.inviteeUserId);
  if (!invitee) throw new AppError("USER_NOT_FOUND", "User không tồn tại");

  const members = await storage.getTripMembers(tripId);
  if (members.some((m: any) => m.userId === input.inviteeUserId)) {
    return { alreadyMember: true as const, invitation: null };
  }

  const existing = await invitationRepo.findPendingBetween(
    tripId,
    input.inviteeUserId,
  );
  if (existing) {
    return { alreadySent: true as const, invitation: existing };
  }

  const created = await invitationRepo.create({
    tripId,
    inviterUserId,
    inviteeUserId: input.inviteeUserId,
    role: input.role || "viewer",
    status: "pending",
    message: input.message ?? null,
  });

  // Fire notification to invitee (deep-link target handled in FE via title/
  // message regex on `deriveKind` — "Lời mời tham gia" keyword).
  try {
    const inviter = await userRepo.getUser(inviterUserId);
    const inviterName = inviter
      ? inviter.fullName || inviter.userName || "Ai đó"
      : "Ai đó";
    await storage.createNotification({
      userId: input.inviteeUserId,
      tripId,
      title: "Lời mời tham gia chuyến đi",
      message: `${inviterName} đã mời bạn tham gia "${trip.title || "chuyến đi mới"}".`,
      type: "info",
    } as any);
  } catch (err) {
    logger.warn({ err }, "Failed to fire invitation notification");
  }

  return { alreadyMember: false as const, alreadySent: false as const, invitation: created };
}

export async function listReceived(inviteeUserId: number) {
  return invitationRepo.listReceived(inviteeUserId);
}

export async function listSent(
  inviterUserId: number,
  opts?: { tripId?: number; status?: string },
) {
  return invitationRepo.listSent(inviterUserId, opts);
}

export async function acceptInvitation(invitationId: number, actorUserId: number) {
  const inv = await invitationRepo.findById(invitationId);
  if (!inv) throw errors.notFound("Invitation");
  if (inv.inviteeUserId !== actorUserId) {
    throw errors.forbidden();
  }
  if (inv.status !== "pending") {
    throw errors.badRequest("Lời mời này đã được xử lý.");
  }

  // Add as member, idempotent (the share/join flow has the same check).
  const members = await storage.getTripMembers(inv.tripId);
  if (!members.some((m: any) => m.userId === actorUserId)) {
    await storage.addTripMember({
      tripId: inv.tripId,
      userId: actorUserId,
      role: inv.role || "viewer",
    });
  }

  const updated = await invitationRepo.update(invitationId, {
    status: "accepted",
    respondedAt: new Date(),
  });

  // Notify the inviter so they see the response without polling.
  try {
    const invitee = await userRepo.getUser(actorUserId);
    const inviteeName = invitee
      ? invitee.fullName || invitee.userName || "Ai đó"
      : "Ai đó";
    await storage.createNotification({
      userId: inv.inviterUserId,
      tripId: inv.tripId,
      title: "Lời mời được chấp nhận",
      message: `${inviteeName} đã tham gia "${inv.tripTitle || "chuyến đi"}".`,
      type: "success",
    } as any);
  } catch {}

  return updated;
}

export async function declineInvitation(invitationId: number, actorUserId: number) {
  const inv = await invitationRepo.findById(invitationId);
  if (!inv) throw errors.notFound("Invitation");
  if (inv.inviteeUserId !== actorUserId) {
    throw errors.forbidden();
  }
  if (inv.status !== "pending") {
    throw errors.badRequest("Lời mời này đã được xử lý.");
  }

  const updated = await invitationRepo.update(invitationId, {
    status: "declined",
    respondedAt: new Date(),
  });

  try {
    const invitee = await userRepo.getUser(actorUserId);
    const inviteeName = invitee
      ? invitee.fullName || invitee.userName || "Ai đó"
      : "Ai đó";
    await storage.createNotification({
      userId: inv.inviterUserId,
      tripId: inv.tripId,
      title: "Lời mời bị từ chối",
      message: `${inviteeName} đã từ chối tham gia "${inv.tripTitle || "chuyến đi"}".`,
      type: "info",
    } as any);
  } catch {}

  return updated;
}

export async function cancelInvitation(invitationId: number, actorUserId: number) {
  const inv = await invitationRepo.findById(invitationId);
  if (!inv) throw errors.notFound("Invitation");
  if (inv.inviterUserId !== actorUserId) {
    throw errors.forbidden();
  }
  if (inv.status !== "pending") {
    throw errors.badRequest("Lời mời này đã được xử lý.");
  }
  return invitationRepo.update(invitationId, {
    status: "cancelled",
    respondedAt: new Date(),
  });
}

export async function countPending(inviteeUserId: number) {
  return invitationRepo.countPending(inviteeUserId);
}
