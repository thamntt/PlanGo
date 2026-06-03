import { LRUCache } from "lru-cache";
import { createHash } from "node:crypto";
import { logger } from "./logger";

/**
 * LRU cache for AI itinerary generation results.
 * Same (destination, dates, budget, people, prefs) input → cached output → no AI re-call.
 * TTL 1h, max 100 entries (~5-10MB).
 */
type CachedValue = Record<string, unknown>;

const itineraryCache = new LRUCache<string, CachedValue>({
  max: 100,
  ttl: 60 * 60 * 1000, // 1 hour
});

export interface ItineraryCacheKey {
  destination: string;
  startDate: string;
  endDate: string;
  totalBudget?: number;
  numPeople?: number;
  preferences?: string[];
}

/**
 * Compute a deterministic hash for the input. Preferences are sorted so order
 * doesn't affect cache key. The prompt version (PROMPT_VERSION) is included
 * so updating the AI prompt automatically invalidates cached responses.
 */
export const PROMPT_VERSION = "v1.2.0-2026-06-03";

function hashKey(input: ItineraryCacheKey): string {
  const normalized = {
    v: PROMPT_VERSION,
    destination: input.destination.toLowerCase().trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    totalBudget: input.totalBudget ?? 0,
    numPeople: input.numPeople ?? 2,
    preferences: [...(input.preferences ?? [])].sort(),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}

export function getCachedItinerary(input: ItineraryCacheKey): CachedValue | undefined {
  const key = hashKey(input);
  const hit = itineraryCache.get(key);
  if (hit) {
    logger.info({ cacheKey: key, destination: input.destination }, "AI itinerary cache HIT");
  }
  return hit;
}

export function setCachedItinerary(input: ItineraryCacheKey, value: CachedValue): void {
  const key = hashKey(input);
  itineraryCache.set(key, value);
  logger.info({ cacheKey: key, destination: input.destination }, "AI itinerary cached");
}

export function clearItineraryCache(): void {
  itineraryCache.clear();
  logger.info("AI itinerary cache cleared");
}

export function getCacheStats() {
  return {
    size: itineraryCache.size,
    max: itineraryCache.max,
    promptVersion: PROMPT_VERSION,
  };
}
