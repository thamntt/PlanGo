import { storage } from "../../storage";
import { withTransaction } from "../../db";
import { errors, AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { mapTripToFrontend } from "../../mappers/trip.mapper";
import { parseCurrencyToNumeric } from "../../utils/currency";
import { parseDateStringToISO } from "../../utils/date";
import {
  notifyTripStarted,
  notifyTripCompleted,
  notifyExpenseAdded,
  notifyBudgetWarning,
  notifyActivityCompleted,
  notifyAiGenerated,
} from "../../lib/notify";
import {
  extractPlaceName,
  mapActivityTypeToExpenseId,
  mapExpenseIdToActivityType,
  associatePreferencesToPoi,
  associatePreferencesToTrip,
} from "../../lib/itinerary-helpers";
import { resolvePoiTypeId, resolveExpenseTypeId } from "../../lib/lookups";
import type {
  CreateTripInput,
  UpdateTripInput,
  ActivityInput,
  DayInput,
  TripExpenseInput,
  ListTripsQuery,
} from "./schema";

// ══════════════════════════════════════════════════════════════
// Read
// ══════════════════════════════════════════════════════════════

export async function listTrips(query: ListTripsQuery) {
  let items: any[] = [];
  if (query.ownerId) items = await storage.getTripsByOwner(query.ownerId);
  else if (query.memberId) items = await storage.getTripsByMember(query.memberId);
  else items = await storage.getTrips();
  // Isolate per-row mapping failures so one bad trip doesn't make the
  // entire endpoint 500 (was causing the trips tab to render empty +
  // companions to flicker between owner-only and full list).
  return items
    .map((trip) => {
      try {
        return mapTripToFrontend(trip);
      } catch (err) {
        logger.warn(
          { err, tripId: trip?.tripId },
          "Failed to map trip — skipping in list response",
        );
        return null;
      }
    })
    .filter(Boolean);
}

export async function getTrip(id: number) {
  const trip = await storage.getTrip(id);
  if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");
  return mapTripToFrontend(trip);
}

export async function getTripDays(tripId: number) {
  return storage.getItineraryDaysByTrip(tripId);
}

export async function getDayItems(dayId: number) {
  return storage.getItineraryItemsByDay(dayId);
}

export async function getTripExpenses(tripId: number) {
  return storage.getExpensesByTrip(tripId);
}

// ══════════════════════════════════════════════════════════════
// Create
// ══════════════════════════════════════════════════════════════

export async function createTrip(input: CreateTripInput) {
  return withTransaction(async () => {
    const payload: any = { ...input };
    if (payload.startDate) payload.startDate = parseDateStringToISO(payload.startDate);
    if (payload.endDate) payload.endDate = parseDateStringToISO(payload.endDate);
    if (payload.budget) payload.budget = parseCurrencyToNumeric(payload.budget);

    if (payload.userId && !payload.ownerId) payload.ownerId = Number(payload.userId);

    // Auto-derive title if FE didn't send one. For multi-destination trips,
    // chain all city names with arrows (e.g. "Chuyến đi Đà Nẵng → Hội An → Huế").
    if (!payload.title || !String(payload.title).trim()) {
      const dests = Array.isArray(payload.destinations) ? payload.destinations : [];
      if (dests.length > 1) {
        payload.title = `Chuyến đi ${dests.map((d: any) => d.name).join(" → ")}`;
      } else if (payload.destination) {
        payload.title = `Chuyến đi ${payload.destination}`;
      } else {
        payload.title = "Chuyến đi mới";
      }
    }

    // Resolve destination name → id
    if (payload.destination && !payload.destinationId) {
      const destRecord = await storage.getDestinationByName(payload.destination);
      if (destRecord) {
        payload.destinationId = destRecord.destinationId;
      } else {
        try {
          const newDest = await storage.createDestination({
            name: payload.destination,
            address: payload.destination,
            latitude: "0",
            longitude: "0",
          });
          payload.destinationId = newDest.destinationId;
        } catch (e) {
          logger.warn({ err: e }, "Could not create destination");
        }
      }
    }

    const trip = await storage.createTrip(payload);

    if (payload.preferences && Array.isArray(payload.preferences)) {
      await associatePreferencesToTrip(trip.tripId, payload.preferences);
    }

    if (payload.days && Array.isArray(payload.days)) {
      await createTripDaysAndActivities(
        trip.tripId,
        trip.startDate,
        payload.days,
        payload.destinationId,
      );
    }

    const finalTrip = await storage.getTrip(trip.tripId);

    // If this trip came from AI gen (FE sets `generatedByAi: true`), fire the
    // ai_generated notification so it appears in the bell icon.
    if (input.generatedByAi && payload.ownerId) {
      notifyAiGenerated(payload.ownerId, payload.title, trip.tripId).catch(() => {});
    }

    return mapTripToFrontend(finalTrip);
  });
}

async function createTripDaysAndActivities(
  tripId: number,
  startDate: string | Date | null | undefined,
  days: DayInput[],
  destinationId?: number,
) {
  // Days run in parallel — each day's items also run in parallel inside.
  // For a 3-day × 8-activity trip this drops save time from ~16s (sequential)
  // to ~1-2s wall-clock on Neon edge.
  await Promise.allSettled(
    days.map(async (dayData, i) => {
      let dayDate: string | undefined;
      if (startDate) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + (dayData.day ? dayData.day - 1 : i));
        dayDate = d.toISOString().split("T")[0];
      }

      const createdDay = await storage.createItineraryDay({
        tripId,
        date: dayDate,
        dayIndex: dayData.day || i + 1,
        // @ts-ignore — title not in InsertItineraryDay type
        title: dayData.title || `Ngày ${dayData.day || i + 1}`,
      });

      if (!dayData.activities) return;
      await Promise.allSettled(
        dayData.activities.map((activity, orderIndex) =>
          createActivityItem(tripId, createdDay.dayId, activity, orderIndex, destinationId).catch(
            (err) =>
              logger.warn({ err, activity: activity.title }, "Failed to create itinerary item"),
          ),
        ),
      );
    }),
  );
}

async function createActivityItem(
  tripId: number,
  dayId: number,
  activity: ActivityInput,
  orderIndex: number,
  destinationId?: number,
) {
  let estCost: string | undefined;
  if (activity.estimatedCost) {
    estCost =
      typeof activity.estimatedCost === "number"
        ? activity.estimatedCost.toString()
        : parseCurrencyToNumeric(activity.estimatedCost)?.toString();
  }

  const numDuration = normalizeDuration(activity.duration ?? undefined) ?? 60;
  const resolvedPoiId = await resolvePoiForActivity(activity, destinationId);

  await storage.createItineraryItem({
    dayId,
    tripId,
    poiId: resolvedPoiId,
    customName: activity.title,
    startTime: activity.time ?? undefined,
    duration: numDuration,
    orderIndex,
    note: null,
    estimatedCost: estCost,
    status: activity.isCompleted ? "completed" : "pending",
    expenseTypeId: activity.expenseTypeId
      ? Number(activity.expenseTypeId)
      : mapActivityTypeToExpenseId(activity.activityType ?? undefined),
    activityType:
      activity.activityType ||
      mapExpenseIdToActivityType(activity.expenseTypeId ? Number(activity.expenseTypeId) : null),
  });
}

async function resolvePoiForActivity(
  activity: ActivityInput,
  destinationId?: number,
): Promise<number | undefined> {
  if (activity.poiId) return Number(activity.poiId);
  if (!activity.description && !activity.title) return undefined;

  const placeName = extractPlaceName(activity.title);
  let existing = await storage.getPoiByName(placeName);
  if (!existing && activity.googlePlaceId) {
    existing = await storage.getPoiByGooglePlaceId(activity.googlePlaceId);
  }

  if (existing) {
    if (!existing.description && activity.description) {
      await storage.updatePoi(existing.poiId, { description: activity.description });
    }
    return existing.poiId;
  }

  const newPoi = await storage.createPoi({
    name: placeName,
    description: activity.description || undefined,
    destinationId,
    latitude: activity.latitude ? String(activity.latitude) : "0",
    longitude: activity.longitude ? String(activity.longitude) : "0",
    address: activity.address || "",
    googlePlaceId: activity.googlePlaceId || undefined,
  });

  await associatePreferencesToPoi(
    newPoi.poiId,
    activity.activityType ?? undefined,
    activity.title,
    activity.description ?? undefined,
  );
  return newPoi.poiId;
}

function normalizeDuration(raw: string | number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "number") return raw;
  const parsed = parseInt(raw);
  if (isNaN(parsed)) return undefined;
  return raw.toLowerCase().includes("giờ") ? parsed * 60 : parsed;
}

// ══════════════════════════════════════════════════════════════
// Update (the big one)
// ══════════════════════════════════════════════════════════════

export async function updateTrip(id: number, input: UpdateTripInput) {
  return withTransaction(async () => {
    const payload: any = { ...input };
    delete payload.days;
    delete payload.expenses;

    if (payload.startDate) payload.startDate = parseDateStringToISO(payload.startDate);
    if (payload.endDate) payload.endDate = parseDateStringToISO(payload.endDate);
    if (payload.budget) payload.budget = parseCurrencyToNumeric(payload.budget);

    // Capture prior status to detect transitions for notifications.
    const prior = await storage.getTrip(id);
    const priorStatus = prior?.status;

    const trip = await storage.updateTrip(id, payload);
    if (!trip) throw new AppError("TRIP_NOT_FOUND", "Trip not found");

    if (input.days) {
      await syncNestedDays(id, input.days);
      await autoSyncEndDate(id);
    }

    if (input.expenses && trip.status !== "completed") {
      await syncNestedExpenses(id, trip.ownerId, input.expenses);
    }

    // Fire trip-lifecycle notifications on status transition.
    if (priorStatus !== trip.status) {
      if (trip.status === "active") {
        notifyTripStarted(id).catch(() => {});
      } else if (trip.status === "completed") {
        notifyTripCompleted(id).catch(() => {});
      }
    }

    const finalTrip = await storage.getTrip(id);
    return mapTripToFrontend(finalTrip);
  });
}

async function syncNestedDays(tripId: number, days: DayInput[]) {
  const dbDays = await storage.getItineraryDaysByTrip(tripId);
  const processedDayIds = new Set<number>();

  for (const day of days) {
    if (!day.activities) continue;

    const incomingDayId = day.dayId || day.id;
    let matchedDay = dbDays.find((d: any) => d.dayId === Number(incomingDayId));
    if (!matchedDay) {
      matchedDay = dbDays.find((d: any) => d.dayIndex === (day.day || day.dayIndex));
    }

    let dayId: number;
    if (matchedDay) {
      dayId = matchedDay.dayId;
      processedDayIds.add(dayId);
      const newIndex = day.day || day.dayIndex;
      if (newIndex && matchedDay.dayIndex !== newIndex) {
        await storage.updateItineraryDay(dayId, { dayIndex: newIndex });
      }
    } else {
      const newDay = await storage.createItineraryDay({
        tripId,
        dayIndex: day.day || day.dayIndex || 1,
      });
      dayId = newDay.dayId;
      processedDayIds.add(dayId);
    }

    await syncNestedActivities(tripId, dayId, day.activities);
  }

  // Delete removed days
  for (const dbDay of dbDays) {
    if (!processedDayIds.has(dbDay.dayId)) {
      try {
        await storage.deleteItineraryDay(dbDay.dayId);
      } catch (err) {
        logger.warn({ err, dayId: dbDay.dayId }, "Failed to delete day");
      }
    }
  }
}

async function syncNestedActivities(tripId: number, dayId: number, activities: ActivityInput[]) {
  const existingItems = await storage.getItineraryItemsByDay(dayId);
  const existingById = new Map<number, any>();
  for (const it of existingItems) existingById.set(it.itemId, it);

  const incomingIds = new Set<number>();
  const completedTransitions: { title: string }[] = [];
  let orderIndex = 0;

  for (const act of activities) {
    const actId = act.id ? Number(act.id) : NaN;
    if (!isNaN(actId)) {
      incomingIds.add(actId);
      const prior = existingById.get(actId);
      const wasCompleted = prior?.status === "completed";
      const willBeCompleted = !!act.isCompleted;
      if (!wasCompleted && willBeCompleted) {
        completedTransitions.push({ title: act.title || prior?.customName || "Hoạt động" });
      }
      await updateExistingActivity(actId, act, orderIndex++);
    } else {
      try {
        await createActivityItem(tripId, dayId, act, orderIndex++);
      } catch (err) {
        logger.warn({ err, title: act.title }, "Failed to create new activity");
      }
    }
  }

  // Delete removed activities
  for (const existing of existingItems) {
    if (!incomingIds.has(existing.itemId)) {
      try {
        await storage.deleteItineraryItem(existing.itemId);
      } catch (err) {
        logger.warn({ err, itemId: existing.itemId }, "Failed to delete activity");
      }
    }
  }

  // Fire activity_completed notifications (fire-and-forget). Capped to first 3
  // per sync to avoid spamming when a batch save completes many at once.
  for (const { title } of completedTransitions.slice(0, 3)) {
    notifyActivityCompleted(tripId, title, 0, undefined).catch(() => {});
  }
}

async function updateExistingActivity(actId: number, act: ActivityInput, orderIndex: number) {
  const numDuration = normalizeDuration(act.duration ?? undefined);
  const updatePayload: Record<string, any> = {
    status: act.isCompleted ? "completed" : "pending",
    orderIndex,
  };

  if (act.time) updatePayload.startTime = act.time;
  if (act.title) updatePayload.customName = act.title;
  if (numDuration !== undefined) updatePayload.duration = numDuration;
  if (act.actualCost !== undefined) {
    updatePayload.actualCost = act.actualCost === null ? null : String(act.actualCost);
  }
  if (act.expenseTypeId !== undefined && act.expenseTypeId !== null) {
    const newExpId = act.expenseTypeId ? Number(act.expenseTypeId) : null;
    updatePayload.expenseTypeId = newExpId || mapActivityTypeToExpenseId(act.activityType ?? undefined);
  }
  if (act.activityType !== undefined && act.activityType !== null) {
    updatePayload.activityType =
      act.activityType ||
      mapExpenseIdToActivityType(act.expenseTypeId ? Number(act.expenseTypeId) : null);
  }
  if (act.activityType !== undefined && act.activityType !== null && act.expenseTypeId === undefined) {
    updatePayload.activityType = act.activityType || null;
    updatePayload.expenseTypeId = mapActivityTypeToExpenseId(act.activityType);
  }

  if (act.notes !== undefined && act.notes !== null) {
    updatePayload.note = act.notes.length > 0 ? act.notes.join("\n---\n") : null;
  } else if (act.note !== undefined) {
    updatePayload.note = act.note || null;
  }

  await storage.updateItineraryItem(actId, updatePayload);
}

async function autoSyncEndDate(tripId: number) {
  const finalDays = await storage.getItineraryDaysByTrip(tripId);
  if (finalDays.length === 0) return;

  const maxDayIndex = Math.max(...finalDays.map((d) => d.dayIndex || 1));
  const currentTrip = await storage.getTrip(tripId);
  if (!currentTrip?.startDate) return;

  const start = new Date(currentTrip.startDate);
  if (isNaN(start.getTime())) return;

  const newEnd = new Date(start);
  newEnd.setDate(start.getDate() + (maxDayIndex - 1));
  const newEndStr = newEnd.toISOString().split("T")[0];
  const oldEndStr = currentTrip.endDate
    ? new Date(currentTrip.endDate).toISOString().split("T")[0]
    : "";

  if (newEndStr !== oldEndStr) {
    logger.info({ tripId, maxDayIndex, newEndStr }, "Auto-syncing trip end date");
    await storage.updateTrip(tripId, { endDate: newEndStr });
  }
}

async function syncNestedExpenses(
  tripId: number,
  tripOwnerId: number | null | undefined,
  expenses: TripExpenseInput[],
) {
  const processedExpenseIds = new Set<number>();

  // De-dup by activityId
  const seenItemIds = new Set<number>();
  const toProcess: TripExpenseInput[] = [];
  for (const exp of expenses) {
    if (exp.activityId && !isNaN(Number(exp.activityId))) {
      const actId = Number(exp.activityId);
      if (seenItemIds.has(actId)) continue;
      seenItemIds.add(actId);
    }
    toProcess.push(exp);
  }

  for (const exp of toProcess) {
    const expData: any = {
      tripId,
      description: exp.title || exp.description,
      amount: exp.amount ? String(exp.amount) : "0",
      paidBy: exp.paidByUserId
        ? Number(exp.paidByUserId)
        : exp.userId
          ? Number(exp.userId)
          : tripOwnerId,
      splitMethod: exp.splitType || "none",
      itemId: exp.activityId && !isNaN(Number(exp.activityId)) ? Number(exp.activityId) : undefined,
      expenseTypeId: await resolveExpenseTypeId(exp.type),
    };
    if (exp.date || exp.createdAt) expData.createdAt = new Date(exp.date || exp.createdAt!);

    const finalExpId = await upsertExpense(tripId, exp, expData);
    if (!finalExpId) continue;

    processedExpenseIds.add(finalExpId);
    await storage.deleteExpenseSplits(finalExpId);
    if (exp.splitType && exp.splitType !== "none" && exp.splits) {
      for (const split of exp.splits) {
        await storage.createExpenseSplit({
          expenseId: finalExpId,
          userId: Number(split.userId),
          amount: split.amount ? String(split.amount) : "0",
        });
      }
    }
  }

  // Delete removed
  const dbExpenses = await storage.getExpensesByTrip(tripId);
  for (const dbExp of dbExpenses) {
    if (!processedExpenseIds.has(dbExp.expenseId)) await storage.deleteExpense(dbExp.expenseId);
  }
}

async function upsertExpense(
  tripId: number,
  exp: TripExpenseInput,
  expData: any,
): Promise<number | undefined> {
  let expIdParsed = NaN;
  if (exp.id && typeof exp.id === "string" && !exp.id.startsWith("temp-")) {
    expIdParsed = Number(exp.id);
  } else if (typeof exp.id === "number") {
    expIdParsed = exp.id;
  }

  if (isNaN(expIdParsed) && expData.itemId) {
    const tripExps = await storage.getExpensesByTrip(tripId);
    const existingMatch = tripExps.find((e) => e.itemId === expData.itemId);
    if (existingMatch) expIdParsed = existingMatch.expenseId;
  }

  if (!isNaN(expIdParsed)) {
    await storage.updateExpense(expIdParsed, expData);
    return expIdParsed;
  } else {
    const created = await storage.createExpense(expData);
    return created?.expenseId;
  }
}

// ══════════════════════════════════════════════════════════════
// Delete
// ══════════════════════════════════════════════════════════════

export async function deleteTrip(id: number) {
  const ok = await storage.deleteTrip(id);
  if (!ok) throw errors.notFound("Trip");
}

// ══════════════════════════════════════════════════════════════
// Nested simple ops
// ══════════════════════════════════════════════════════════════

export async function createTripDay(tripId: number, body: any) {
  return storage.createItineraryDay({ ...body, tripId });
}

export async function createDayItem(dayId: number, body: any) {
  return storage.createItineraryItem({ ...body, dayId });
}

export async function createTripExpense(tripId: number, body: any) {
  const trip = await storage.getTrip(tripId);
  if (!trip) throw errors.notFound("Trip");
  if (trip.status === "completed")
    throw new AppError("TRIP_COMPLETED", "Cannot add expense to a completed trip");
  const created = await storage.createExpense({ ...body, tripId });

  // Fire expense_added notification + check budget warning (fire-and-forget).
  (async () => {
    try {
      const payerId = Number(body.paidBy || body.paidByUserId || trip.ownerId || 0);
      const amount = Number(body.amount || 0);
      const desc = body.description || body.title || "Khoản chi mới";
      let payerName: string | undefined;
      if (payerId) {
        const payer = await storage.getUser(payerId).catch(() => null);
        payerName = payer
          ? (payer as any).fullName || (payer as any).userName
          : undefined;
      }
      await notifyExpenseAdded(tripId, desc, amount, payerId, payerName);

      // Budget warning: refetch all expenses to get accurate total, then check
      // against trip budget. Fire once when crossing 80%/100% thresholds.
      const budget = Number(trip.budget || 0);
      if (budget > 0) {
        const allExp = await storage.getExpensesByTrip(tripId);
        const total = allExp.reduce((sum, e: any) => sum + Number(e.amount || 0), 0);
        const pct = total / budget;
        const priorPct = (total - amount) / budget;
        const crossed80 = priorPct < 0.8 && pct >= 0.8;
        const crossed100 = priorPct < 1.0 && pct >= 1.0;
        if (crossed100 || crossed80) {
          await notifyBudgetWarning(tripId, total, budget);
        }
      }
    } catch (err) {
      logger.warn({ err, tripId }, "Failed to fire expense notifications");
    }
  })();

  return created;
}
