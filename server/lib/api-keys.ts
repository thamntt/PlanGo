// API Base URLs
export const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
export const GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
export const GOOGLE_DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";
export const GOONG_BASE = "https://rsapi.goong.io";
export const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
export const OSRM_BASE = "https://router.project-osrm.org";
export const SERPAPI_BASE = "https://serpapi.com/search.json";

export function getGoogleKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || "";
}

export function getGoongKey(): string {
  return process.env.GOONG_API_KEY || "";
}

export function getSerpApiKey(): string {
  const key = process.env.SERPAPI_KEY || "";
  console.log(`[Debug] Using SerpAPI Key: ${key.slice(0, 5)}...${key.slice(-5)}`);
  return key;
}

export type MapProvider = "google" | "goong" | "free";

export function getActiveProvider(): MapProvider {
  if (getGoogleKey()) return "google";
  if (getGoongKey()) return "goong";
  return "free";
}

export function mapVehicleToMode(vehicle: string): string {
  const modeMap: Record<string, string> = {
    car: "driving",
    bike: "bicycling",
    taxi: "driving",
    walking: "walking",
    transit: "transit",
  };
  return modeMap[vehicle] || "driving";
}
