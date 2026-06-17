/**
 * Nightly SerpAPI refresh job.
 *
 * Refreshes the top 20 most-viewed POIs (by `serp_view_count`) at ~2:30 AM ICT.
 * Strategy:
 *   - Lazy on-view (in places router) handles 95% of refresh needs.
 *   - This cron only refreshes HOT places so they don't ever stall on a user open.
 *   - Hard cap at 20 places/night to keep SerpAPI credits bounded.
 *
 * Disable in env: SERP_REFRESH_DISABLED=1
 */
import { db } from "../db";
import { pois } from "../../shared/schema";
import { desc, isNotNull, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { SERPAPI_BASE, getSerpApiKey } from "./api-keys";

const REFRESH_TIME_HOUR = 2; // 02:00 ICT
const REFRESH_TIME_MINUTE = 30; // :30
const MAX_PLACES_PER_NIGHT = 20;
const MIN_TIME_BETWEEN_FETCHES_MS = 3000; // gentle pacing

let scheduled: ReturnType<typeof setTimeout> | null = null;

function msUntilNext(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function fetchAndStoreOne(googlePlaceId: string): Promise<boolean> {
  const apiKey = getSerpApiKey();
  if (!apiKey) return false;
  try {
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      place_id: googlePlaceId,
      hl: "vi",
      api_key: apiKey,
    });
    const url = `${SERPAPI_BASE}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(
        { googlePlaceId, status: res.status },
        "SerpAPI refresh failed",
      );
      return false;
    }
    const data: any = await res.json();
    if (data.error && /run out of searches/i.test(data.error)) {
      logger.warn("SerpAPI quota exhausted — stopping refresh batch");
      return false;
    }
    const placeInfo = data.place_info
      ? {
          title: data.place_info.title || "",
          address: data.place_info.address || "",
          rating: data.place_info.rating || 0,
          totalReviews: data.place_info.reviews || 0,
          type: data.place_info.type || "",
        }
      : null;
    const reviews = (data.reviews || []).map((r: any) => ({
      reviewId: r.review_id || "",
      author: r.user?.name || "",
      authorPhoto: r.user?.thumbnail || "",
      isLocalGuide: r.user?.local_guide || false,
      reviewCount: r.user?.reviews || 0,
      rating: r.rating || 0,
      snippet: r.snippet || r.extracted_snippet?.original || "",
      date: r.date || "",
      isoDate: r.iso_date || "",
      likes: r.likes || 0,
      images: r.images || [],
      response: r.response
        ? {
            snippet: r.response.snippet || r.response.extracted_snippet?.original || "",
            date: r.response.date || "",
          }
        : null,
    }));
    if (reviews.length === 0) return false;
    await db
      .update(pois)
      .set({
        serpReviewsJson: reviews as any,
        serpPlaceInfoJson: placeInfo as any,
        serpFetchedAt: new Date(),
      })
      .where(eq(pois.googlePlaceId, googlePlaceId));
    return true;
  } catch (err) {
    logger.warn({ err, googlePlaceId }, "SerpAPI refresh error");
    return false;
  }
}

async function runNightlyRefresh() {
  logger.info("Starting nightly SerpAPI refresh batch");
  try {
    const hot = await db
      .select({
        googlePlaceId: pois.googlePlaceId,
        viewCount: pois.serpViewCount,
      })
      .from(pois)
      .where(isNotNull(pois.googlePlaceId))
      .orderBy(desc(pois.serpViewCount))
      .limit(MAX_PLACES_PER_NIGHT);

    let okCount = 0;
    for (const row of hot) {
      if (!row.googlePlaceId) continue;
      const ok = await fetchAndStoreOne(row.googlePlaceId);
      if (ok) okCount++;
      await new Promise((r) => setTimeout(r, MIN_TIME_BETWEEN_FETCHES_MS));
    }
    logger.info(
      { processed: hot.length, succeeded: okCount },
      "SerpAPI nightly refresh complete",
    );

    // Reset view counters every refresh cycle so popularity reflects RECENT
    // views, not all-time. Otherwise an old-popular POI dominates forever.
    await db
      .update(pois)
      .set({ serpViewCount: sql`floor(${pois.serpViewCount} / 2)` });
  } catch (err) {
    logger.error({ err }, "SerpAPI nightly refresh batch failed");
  }
}

export function startSerpRefreshCron() {
  if (process.env.SERP_REFRESH_DISABLED === "1") {
    logger.info("SerpAPI nightly refresh disabled via env");
    return;
  }
  if (scheduled) return;

  const scheduleNext = () => {
    const delay = msUntilNext(REFRESH_TIME_HOUR, REFRESH_TIME_MINUTE);
    logger.info(
      { nextRunInMs: delay, hour: REFRESH_TIME_HOUR, minute: REFRESH_TIME_MINUTE },
      "SerpAPI refresh cron scheduled",
    );
    scheduled = setTimeout(async () => {
      await runNightlyRefresh();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}

export function stopSerpRefreshCron() {
  if (scheduled) {
    clearTimeout(scheduled);
    scheduled = null;
  }
}
