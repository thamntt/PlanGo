import { LRUCache } from "lru-cache";
import { logger } from "./logger";

/**
 * LRU cache for SerpAPI Google Maps reviews responses.
 * Saves a paid SerpAPI call + ~3-6s per repeat fetch of the same place_id.
 *
 * Same composite key (placeId + nextToken + q + fallbackQ) → cached response.
 * TTL 24h since Google reviews change slowly. Max 500 places (~50-100MB worst case).
 */
type CachedReviewPayload = {
  placeInfo: any;
  reviews: any[];
  nextPageToken: string | null;
};

const serpReviewsCache = new LRUCache<string, CachedReviewPayload>({
  max: 500,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});

export function buildSerpCacheKey(parts: {
  placeId?: string | null;
  nextPageToken?: string | null;
  q?: string | null;
  fallbackQ?: string | null;
}): string {
  return [
    parts.placeId || "",
    parts.nextPageToken || "",
    parts.q || "",
    parts.fallbackQ || "",
  ].join("|");
}

export function getCachedSerpReviews(key: string): CachedReviewPayload | undefined {
  const hit = serpReviewsCache.get(key);
  if (hit) {
    logger.debug({ key }, "SerpAPI cache HIT");
  }
  return hit;
}

export function setCachedSerpReviews(key: string, payload: CachedReviewPayload): void {
  serpReviewsCache.set(key, payload);
}

export function clearSerpReviewsCache(): void {
  serpReviewsCache.clear();
}

export function serpReviewsCacheStats() {
  return {
    size: serpReviewsCache.size,
    max: serpReviewsCache.max,
    ttl: serpReviewsCache.ttl,
  };
}
