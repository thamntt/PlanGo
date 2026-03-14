import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

// Nominatim (OpenStreetMap) — 100% free, NO API key needed
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "TravelPlannerPro/1.0";

// Map OSM types to our POI categories
function mapOsmType(osmType: string, osmClass: string): string {
  const typeMap: Record<string, string> = {
    tourism: "attraction",
    hotel: "hotel",
    hostel: "hotel",
    guest_house: "hotel",
    motel: "hotel",
    museum: "attraction",
    attraction: "attraction",
    viewpoint: "attraction",
    theme_park: "attraction",
    zoo: "attraction",
    aquarium: "attraction",
    artwork: "attraction",
    gallery: "attraction",
    restaurant: "restaurant",
    fast_food: "restaurant",
    food_court: "restaurant",
    cafe: "cafe",
    coffee: "cafe",
    marketplace: "shopping",
    mall: "shopping",
    supermarket: "shopping",
    shop: "shopping",
  };
  return typeMap[osmType] || typeMap[osmClass] || "other";
}

async function searchPlaces(req: Request, res: Response) {
  const query = req.query.query as string;
  const language = (req.query.language as string) || "vi";

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const url = `${NOMINATIM_BASE}/search?` + new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      extratags: "1",
      limit: "10",
      "accept-language": language,
    });

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nominatim search error:", response.status, errorText);
      return res.status(response.status).json({ error: "Search API error", details: errorText });
    }

    const data = await response.json();
    const places = data.map((item: any) => {
      const types = [item.type, item.category, item.class].filter(Boolean);
      const primaryType = mapOsmType(item.type || "", item.class || "");
      return {
        placeId: `osm_${item.osm_type?.[0] || "N"}${item.osm_id}`,
        name: item.name || item.display_name?.split(",")[0] || "",
        address: item.display_name || "",
        latitude: parseFloat(item.lat) || 0,
        longitude: parseFloat(item.lon) || 0,
        rating: item.extratags?.stars ? parseFloat(item.extratags.stars) : 0,
        reviewCount: 0,
        types,
        primaryType,
        primaryTypeDisplay: primaryType.charAt(0).toUpperCase() + primaryType.slice(1),
        editorialSummary: item.extratags?.description || "",
        photos: item.name ? [{ name: item.name, attributions: ["OpenStreetMap"] }] : [],
      };
    });

    return res.json({ places });
  } catch (error) {
    console.error("Places search error:", error);
    return res.status(500).json({ error: "Failed to search places" });
  }
}

async function getPlaceDetails(req: Request, res: Response) {
  const placeId = req.params.placeId as string;
  const language = (req.query.language as string) || "vi";

  if (!placeId) {
    return res.status(400).json({ error: "placeId parameter is required" });
  }

  try {
    // Parse osm type and id from our placeId format: osm_N12345
    const idPart = placeId.replace("osm_", "");
    const osmTypeChar = idPart[0];
    const osmId = idPart.slice(1);
    const osmTypeMap: Record<string, string> = { N: "N", W: "W", R: "R" };
    const osmType = osmTypeMap[osmTypeChar] || "N";

    const url = `${NOMINATIM_BASE}/lookup?` + new URLSearchParams({
      osm_ids: `${osmType}${osmId}`,
      format: "jsonv2",
      addressdetails: "1",
      extratags: "1",
      "accept-language": language,
    });

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nominatim lookup error:", response.status, errorText);
      return res.status(response.status).json({ error: "Lookup API error", details: errorText });
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Place not found" });
    }

    const place = data[0];
    const types = [place.type, place.category, place.class].filter(Boolean);
    const primaryType = mapOsmType(place.type || "", place.class || "");
    const extratags = place.extratags || {};

    // Build opening hours from OSM extratags
    const openingHours: string[] = [];
    if (extratags.opening_hours) {
      openingHours.push(extratags.opening_hours);
    }

    const result = {
      placeId,
      name: place.name || place.display_name?.split(",")[0] || "",
      address: place.display_name || "",
      latitude: parseFloat(place.lat) || 0,
      longitude: parseFloat(place.lon) || 0,
      rating: extratags.stars ? parseFloat(extratags.stars) : 0,
      reviewCount: 0,
      types,
      primaryType,
      primaryTypeDisplay: primaryType.charAt(0).toUpperCase() + primaryType.slice(1),
      editorialSummary: extratags.description || "",
      website: extratags.website || extratags.url || "",
      phone: extratags.phone || extratags["contact:phone"] || "",
      priceLevel: null,
      photos: place.name ? [{ name: place.name, attributions: ["OpenStreetMap"] }] : [],
      reviews: [],
      openingHours,
      openNow: null,
    };

    return res.json(result);
  } catch (error) {
    console.error("Place details error:", error);
    return res.status(500).json({ error: "Failed to get place details" });
  }
}

async function getPlacePhoto(req: Request, res: Response) {
  const photoName = req.query.name as string;
  const maxWidth = parseInt(req.query.maxWidth as string) || 800;

  if (!photoName) {
    return res.status(400).json({ error: "Photo name parameter is required" });
  }

  try {
    // Use Unsplash Source for free stock photos based on place name
    const url = `https://source.unsplash.com/${maxWidth}x${Math.round(maxWidth * 0.66)}/?${encodeURIComponent(photoName + " travel landscape")}`;
    const response = await fetch(url, { redirect: "follow" });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch photo" });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Place photo error:", error);
    return res.status(500).json({ error: "Failed to fetch photo" });
  }
}

// In-memory store for shared trips (keyed by shareCode)
const sharedTrips = new Map<string, any>();

// POST /api/share — register a trip share
async function shareTrip(req: Request, res: Response) {
  const { shareCode, itinerary } = req.body;
  if (!shareCode || !itinerary) {
    return res.status(400).json({ error: "shareCode and itinerary are required" });
  }
  sharedTrips.set(shareCode, itinerary);
  return res.json({ ok: true });
}

// GET /api/share/:code — look up a shared trip
async function getSharedTrip(req: Request, res: Response) {
  const code = req.params.code as string;
  const trip = sharedTrips.get(code);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  return res.json(trip);
}

// POST /api/share/join — join a shared trip (update companions)
async function joinSharedTrip(req: Request, res: Response) {
  const { shareCode, companion } = req.body;
  if (!shareCode || !companion) {
    return res.status(400).json({ error: "shareCode and companion are required" });
  }
  const trip = sharedTrips.get(shareCode);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  const companions = trip.companions || [];
  if (companions.some((c: any) => c.userId === companion.userId)) {
    return res.json({ ok: true, alreadyJoined: true, itinerary: trip });
  }
  companions.push(companion);
  trip.companions = companions;
  sharedTrips.set(shareCode, trip);
  return res.json({ ok: true, alreadyJoined: false, itinerary: trip });
}

// PATCH /api/share/companion — update a companion's role
async function updateCompanionRole(req: Request, res: Response) {
  const { shareCode, userId, role } = req.body;
  if (!shareCode || !userId || !role) {
    return res.status(400).json({ error: "shareCode, userId, and role are required" });
  }
  if (role !== "editor" && role !== "viewer") {
    return res.status(400).json({ error: "role must be 'editor' or 'viewer'" });
  }
  const trip = sharedTrips.get(shareCode);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  const companions = trip.companions || [];
  const companion = companions.find((c: any) => c.userId === userId);
  if (!companion) {
    return res.status(404).json({ error: "Companion not found" });
  }
  companion.role = role;
  sharedTrips.set(shareCode, trip);
  return res.json({ ok: true });
}

// DELETE /api/share/companion — remove a companion
async function removeCompanion(req: Request, res: Response) {
  const { shareCode, userId } = req.body;
  if (!shareCode || !userId) {
    return res.status(400).json({ error: "shareCode and userId are required" });
  }
  const trip = sharedTrips.get(shareCode);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  trip.companions = (trip.companions || []).filter((c: any) => c.userId !== userId);
  sharedTrips.set(shareCode, trip);
  return res.json({ ok: true });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Places search routes (Nominatim/OpenStreetMap)
  app.get("/api/places/search", searchPlaces);
  app.get("/api/places/details/:placeId", getPlaceDetails);
  app.get("/api/places/photo", getPlacePhoto);

  // Share trip routes
  app.post("/api/share", shareTrip);
  app.get("/api/share/:code", getSharedTrip);
  app.post("/api/share/join", joinSharedTrip);
  app.patch("/api/share/companion", updateCompanionRole);
  app.delete("/api/share/companion", removeCompanion);

  const httpServer = createServer(app);
  return httpServer;
}
