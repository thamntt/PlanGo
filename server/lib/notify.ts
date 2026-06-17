/**
 * Notification helper — fires server-side notifications at key events.
 *
 * The FE `app/notifications.tsx` derives the visual `kind` (icon + color + tab
 * deeplink) by regex-matching title + message text via `deriveKind()`. So the
 * titles + messages here use carefully-chosen Vietnamese keywords that match
 * those regex patterns — keep both in sync when adding new kinds.
 *
 * All helpers swallow errors (notifications must never break the parent op).
 */
import { storage } from "../storage";
import { logger } from "./logger";

type ActorInfo = { id: number; name: string };

async function safeCreate(payload: {
  userId: number;
  tripId?: number;
  title: string;
  message: string;
  type?: string;
}): Promise<void> {
  try {
    await storage.createNotification(payload as any);
  } catch (err) {
    logger.warn({ err, payload }, "Failed to create notification");
  }
}

async function fanout(
  userIds: number[],
  build: (uid: number) => {
    userId: number;
    tripId?: number;
    title: string;
    message: string;
    type?: string;
  },
) {
  const unique = Array.from(new Set(userIds.filter((u) => u && u > 0)));
  await Promise.allSettled(unique.map((uid) => safeCreate(build(uid))));
}

async function getTripContext(tripId: number) {
  const trip = await storage.getTrip(tripId);
  if (!trip) return null;
  const members = await storage.getTripMembers(tripId);
  const memberUserIds = members.map((m: any) => m.userId);
  if (trip.ownerId && !memberUserIds.includes(trip.ownerId)) {
    memberUserIds.push(trip.ownerId);
  }
  return {
    tripTitle: trip.title || "Chuyến đi",
    ownerId: trip.ownerId,
    memberUserIds,
  };
}

// ══════════════════════════════════════════════════════════════
// Member events
// ══════════════════════════════════════════════════════════════

export async function notifyMemberJoined(
  tripId: number,
  joinerUserId: number,
  joinerName: string,
) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  // Notify everyone except the joiner themselves.
  await fanout(
    ctx.memberUserIds.filter((uid) => uid !== joinerUserId),
    (uid) => ({
      userId: uid,
      tripId,
      title: "Có thành viên mới",
      message: `${joinerName} đã tham gia "${ctx.tripTitle}".`,
      type: "info",
    }),
  );
}

export async function notifyMemberLeft(
  tripId: number,
  leaverUserId: number,
  leaverName: string,
) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  await fanout(
    ctx.memberUserIds.filter((uid) => uid !== leaverUserId),
    (uid) => ({
      userId: uid,
      tripId,
      title: "Thành viên đã rời nhóm",
      message: `${leaverName} đã rời khỏi "${ctx.tripTitle}".`,
      type: "info",
    }),
  );
}

export async function notifyRoleChanged(
  tripId: number,
  targetUserId: number,
  newRole: string,
  actor?: ActorInfo,
) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  const roleLabel =
    newRole === "owner" ? "chủ chuyến" : newRole === "editor" ? "chỉnh sửa" : "xem";
  await safeCreate({
    userId: targetUserId,
    tripId,
    title: "Vai trò của bạn đã thay đổi",
    message: `${actor?.name || "Chủ chuyến"} đã đổi vai trò của bạn thành "${roleLabel}" trong "${ctx.tripTitle}".`,
    type: "info",
  });
}

// ══════════════════════════════════════════════════════════════
// Trip lifecycle
// ══════════════════════════════════════════════════════════════

export async function notifyTripStarted(tripId: number) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  await fanout(ctx.memberUserIds, (uid) => ({
    userId: uid,
    tripId,
    title: "Bắt đầu chuyến đi",
    message: `Chuyến đi "${ctx.tripTitle}" đã bắt đầu. Chúc bạn có hành trình tuyệt vời!`,
    type: "success",
  }));
}

export async function notifyTripCompleted(tripId: number) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  await fanout(ctx.memberUserIds, (uid) => ({
    userId: uid,
    tripId,
    title: "Hoàn thành chuyến đi",
    message: `Chuyến đi "${ctx.tripTitle}" đã kết thúc. Đừng quên đánh giá những điểm đến nhé!`,
    type: "success",
  }));
}

// ══════════════════════════════════════════════════════════════
// Expense events
// ══════════════════════════════════════════════════════════════

export async function notifyExpenseAdded(
  tripId: number,
  description: string,
  amount: number,
  payerUserId: number | undefined,
  payerName?: string,
) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  const formattedAmount = new Intl.NumberFormat("vi-VN").format(Math.round(amount));
  await fanout(
    ctx.memberUserIds.filter((uid) => uid !== payerUserId),
    (uid) => ({
      userId: uid,
      tripId,
      title: "Chi phí mới",
      message: `${payerName || "Ai đó"} đã chi ${formattedAmount}đ cho "${description}" trong "${ctx.tripTitle}".`,
      type: "info",
    }),
  );
}

export async function notifyBudgetWarning(
  tripId: number,
  spentAmount: number,
  totalBudget: number,
) {
  const ctx = await getTripContext(tripId);
  if (!ctx || !ctx.ownerId) return;
  const pct = Math.round((spentAmount / totalBudget) * 100);
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
  const title = spentAmount > totalBudget ? "Đã vượt ngân sách" : "Sắp hết ngân sách";
  await safeCreate({
    userId: ctx.ownerId,
    tripId,
    title,
    message: `Chuyến đi "${ctx.tripTitle}" đã dùng ${fmt(spentAmount)}đ / ${fmt(totalBudget)}đ (${pct}%).`,
    type: "warning",
  });
}

// ══════════════════════════════════════════════════════════════
// AI itinerary
// ══════════════════════════════════════════════════════════════

export async function notifyAiGenerated(userId: number, tripTitle: string, tripId?: number) {
  await safeCreate({
    userId,
    tripId,
    title: "Lịch trình AI đã sẵn sàng",
    message: `Lịch trình "${tripTitle}" đã được AI tạo xong. Mở để xem và chỉnh sửa.`,
    type: "success",
  });
}

// ══════════════════════════════════════════════════════════════
// Activity completion
// ══════════════════════════════════════════════════════════════

export async function notifyActivityCompleted(
  tripId: number,
  activityTitle: string,
  completedByUserId: number,
  completedByName?: string,
) {
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  await fanout(
    ctx.memberUserIds.filter((uid) => uid !== completedByUserId),
    (uid) => ({
      userId: uid,
      tripId,
      title: "Hoạt động đã hoàn thành",
      message: `${completedByName || "Ai đó"} đã đánh dấu xong "${activityTitle}".`,
      type: "info",
    }),
  );
}

// ══════════════════════════════════════════════════════════════
// Reviews
// ══════════════════════════════════════════════════════════════

export async function notifyReviewPosted(
  tripId: number | undefined,
  reviewerUserId: number,
  reviewerName: string,
  targetName: string,
  rating: number,
) {
  if (!tripId) return;
  const ctx = await getTripContext(tripId);
  if (!ctx) return;
  await fanout(
    ctx.memberUserIds.filter((uid) => uid !== reviewerUserId),
    (uid) => ({
      userId: uid,
      tripId,
      title: "Có đánh giá mới",
      message: `${reviewerName} đã đánh giá "${targetName}" ${rating}★ trong "${ctx.tripTitle}".`,
      type: "info",
    }),
  );
}
