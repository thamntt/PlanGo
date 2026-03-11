import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// Google Places API (New) base URL
const PLACES_API_BASE = "https://places.googleapis.com/v1/places";

interface GooglePlaceSearchResult {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photos?: { name: string; authorAttributions: { displayName: string }[] }[];
  editorialSummary?: { text: string; languageCode: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
}

async function searchPlaces(req: Request, res: Response) {
  const query = req.query.query as string;
  const language = (req.query.language as string) || "vi";

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  if (!GOOGLE_API_KEY) {
    return res.status(400).json({ error: "GOOGLE_PLACES_API_KEY not configured" });
  }

  try {
    const response = await fetch(`${PLACES_API_BASE}:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.photos,places.editorialSummary,places.primaryType,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: language,
        maxResultCount: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Places search error:", response.status, errorText);
      return res.status(response.status).json({ error: "Google API error", details: errorText });
    }

    const data = await response.json();
    const places = (data.places || []).map((place: GooglePlaceSearchResult) => ({
      placeId: place.id,
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      rating: place.rating || 0,
      reviewCount: place.userRatingCount || 0,
      types: place.types || [],
      primaryType: place.primaryType || "",
      primaryTypeDisplay: place.primaryTypeDisplayName?.text || "",
      editorialSummary: place.editorialSummary?.text || "",
      photos: (place.photos || []).slice(0, 5).map((p) => ({
        name: p.name,
        attributions: (p.authorAttributions || []).map((a) => a.displayName),
      })),
    }));

    return res.json({ places });
  } catch (error) {
    console.error("Places search error:", error);
    return res.status(500).json({ error: "Failed to search places" });
  }
}

async function getPlaceDetails(req: Request, res: Response) {
  const { placeId } = req.params;
  const language = (req.query.language as string) || "vi";

  if (!placeId) {
    return res.status(400).json({ error: "placeId parameter is required" });
  }

  if (!GOOGLE_API_KEY) {
    return res.status(400).json({ error: "GOOGLE_PLACES_API_KEY not configured" });
  }

  try {
    const response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,rating,userRatingCount,types,photos,editorialSummary,reviews,regularOpeningHours,priceLevel,primaryType,primaryTypeDisplayName,websiteUri,nationalPhoneNumber",
        "Accept-Language": language,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Places detail error:", response.status, errorText);
      return res.status(response.status).json({ error: "Google API error", details: errorText });
    }

    const place = await response.json();

    const result = {
      placeId: place.id,
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      rating: place.rating || 0,
      reviewCount: place.userRatingCount || 0,
      types: place.types || [],
      primaryType: place.primaryType || "",
      primaryTypeDisplay: place.primaryTypeDisplayName?.text || "",
      editorialSummary: place.editorialSummary?.text || "",
      website: place.websiteUri || "",
      phone: place.nationalPhoneNumber || "",
      priceLevel: place.priceLevel || null,
      photos: (place.photos || []).slice(0, 10).map((p: any) => ({
        name: p.name,
        attributions: (p.authorAttributions || []).map((a: any) => a.displayName),
      })),
      reviews: (place.reviews || []).slice(0, 5).map((r: any) => ({
        author: r.authorAttribution?.displayName || "",
        rating: r.rating || 0,
        text: r.text?.text || "",
        time: r.relativePublishTimeDescription || "",
        profilePhoto: r.authorAttribution?.photoUri || "",
      })),
      openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
      openNow: place.regularOpeningHours?.openNow ?? null,
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

  if (!GOOGLE_API_KEY) {
    return res.status(400).json({ error: "GOOGLE_PLACES_API_KEY not configured" });
  }

  try {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Google Places API proxy routes
  app.get("/api/places/search", searchPlaces);
  app.get("/api/places/details/:placeId", getPlaceDetails);
  app.get("/api/places/photo", getPlacePhoto);

  const httpServer = createServer(app);
  return httpServer;
}
