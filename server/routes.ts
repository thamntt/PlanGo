import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";

// ══════════════════════════════════════════════════════════════
// API Base URLs
// ══════════════════════════════════════════════════════════════

// Google Maps Platform APIs
const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";

// Goong Maps APIs
const GOONG_BASE = "https://rsapi.goong.io";

// Free fallback APIs (no key needed)
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OSRM_BASE = "https://router.project-osrm.org";

// SerpAPI (Google Maps Reviews)
const SERPAPI_BASE = "https://serpapi.com/search.json";

// ══════════════════════════════════════════════════════════════
// API Key helpers
// ══════════════════════════════════════════════════════════════

function getGoogleKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || "";
}

function getGoongKey(): string {
  return process.env.GOONG_API_KEY || "";
}

function getSerpApiKey(): string {
  return process.env.SERPAPI_KEY || "";
}

/** Returns which provider is available: "google" | "goong" | "free" */
function getActiveProvider(): "google" | "goong" | "free" {
  if (getGoogleKey()) return "google";
  if (getGoongKey()) return "goong";
  return "free";
}

// Google Maps vehicle type mapping
function mapVehicleToMode(vehicle: string): string {
  const modeMap: Record<string, string> = {
    car: "driving",
    bike: "bicycling",
    taxi: "driving",
    walking: "walking",
    transit: "transit",
  };
  return modeMap[vehicle] || "driving";
}

// ══════════════════════════════════════════════════════════════
// SEARCH PLACES — Google → Goong → Nominatim
// ══════════════════════════════════════════════════════════════

async function searchPlacesGoogle(query: string, language: string) {
  const apiKey = getGoogleKey();
  if (!apiKey) return null;

  try {
    const url = `${GOOGLE_PLACES_BASE}/places:searchText`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.primaryTypeDisplayName,places.editorialSummary,places.photos",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: language,
        maxResultCount: 10,
      }),
    });

    if (!response.ok) {
      console.warn(`[Google] Search failed (${response.status}), trying fallback...`);
      return null;
    }

    const data = await response.json();
    if (!data.places || data.places.length === 0) {
      return { places: [] };
    }

    const places = data.places.map((place: any) => ({
      placeId: place.id || "",
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      rating: place.rating || 0,
      reviewCount: place.userRatingCount || 0,
      types: place.types || [],
      primaryType: place.primaryType || "other",
      primaryTypeDisplay: place.primaryTypeDisplayName?.text || "Địa điểm",
      editorialSummary: place.editorialSummary?.text || "",
      photos: (place.photos || []).slice(0, 3).map((p: any) => ({
        name: p.name || "",
        attributions: (p.authorAttributions || []).map((a: any) => a.displayName || "Google"),
      })),
    }));

    console.log(`[Google] Search "${query}" → ${places.length} results`);
    return { places };
  } catch (error) {
    console.warn(`[Google] Search error:`, error);
    return null;
  }
}

async function searchPlacesGoong(query: string, language: string) {
  const apiKey = getGoongKey();
  if (!apiKey) return null;

  try {
    const url = `${GOONG_BASE}/Place/AutoComplete?api_key=${apiKey}&input=${encodeURIComponent(query)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[Goong] Search failed (${response.status}), trying fallback...`);
      return null;
    }

    const data = await response.json();
    if (!data.predictions || data.predictions.length === 0) {
      return { places: [] };
    }

    // Get details for each prediction to get coordinates
    const places = await Promise.all(
      data.predictions.slice(0, 10).map(async (pred: any) => {
        let latitude = 0;
        let longitude = 0;

        // Try to get coordinates via Goong Place Detail
        if (pred.place_id) {
          try {
            const detailUrl = `${GOONG_BASE}/Place/Detail?api_key=${apiKey}&place_id=${pred.place_id}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              const loc = detailData.result?.geometry?.location;
              if (loc) {
                latitude = loc.lat || 0;
                longitude = loc.lng || 0;
              }
            }
          } catch { }
        }

        return {
          placeId: pred.place_id || "",
          name: pred.structured_formatting?.main_text || pred.description || "",
          address: pred.description || "",
          latitude,
          longitude,
          rating: 0,
          reviewCount: 0,
          types: pred.types || [],
          primaryType: (pred.types && pred.types[0]) || "other",
          primaryTypeDisplay: "Địa điểm",
          editorialSummary: "",
          photos: [],
        };
      })
    );

    console.log(`[Goong] Search "${query}" → ${places.length} results`);
    return { places };
  } catch (error) {
    console.warn(`[Goong] Search error:`, error);
    return null;
  }
}

async function searchPlacesNominatim(query: string, language: string) {
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=10&accept-language=${language}&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TravelPlannerPro/1.0" },
    });

    if (!response.ok) {
      console.warn(`[Nominatim] Search failed (${response.status})`);
      return { places: [] };
    }

    const data = await response.json();
    const places = data.map((item: any) => ({
      placeId: `nominatim_${item.place_id}`,
      name: item.display_name?.split(",")[0] || item.display_name || "",
      address: item.display_name || "",
      latitude: parseFloat(item.lat) || 0,
      longitude: parseFloat(item.lon) || 0,
      rating: 0,
      reviewCount: 0,
      types: [item.type || "place"],
      primaryType: item.type || "other",
      primaryTypeDisplay: item.type || "Địa điểm",
      editorialSummary: "",
      photos: [],
    }));

    console.log(`[Nominatim] Search "${query}" → ${places.length} results`);
    return { places };
  } catch (error) {
    console.warn(`[Nominatim] Search error:`, error);
    return { places: [] };
  }
}

// SerpAPI Google Maps search — PRIMARY search provider
async function searchPlacesSerpApi(query: string) {
  const apiKey = getSerpApiKey();
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      engine: "google_maps",
      q: query,
      hl: "vi",
      type: "search",
      api_key: apiKey,
    });

    const url = `${SERPAPI_BASE}?${params.toString()}`;
    console.log(`[SerpAPI] 🔍 Searching places: "${query}"`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[SerpAPI] Search failed (${response.status})`);
      return null;
    }

    const data = await response.json();
    const results = data.local_results || [];

    // Helper to extract photos from a SerpAPI result object
    const extractPhotos = (r: any): { name: string; attributions: string[] }[] => {
      const photos: { name: string; attributions: string[] }[] = [];
      if (r.thumbnail) {
        photos.push({ name: r.thumbnail, attributions: ["Google Maps"] });
      }
      if (r.images && Array.isArray(r.images)) {
        r.images.slice(0, 4).forEach((img: any) => {
          const imgUrl = typeof img === "string" ? img : img?.thumbnail || img?.image;
          if (imgUrl && imgUrl !== r.thumbnail) {
            photos.push({ name: imgUrl, attributions: ["Google Maps"] });
          }
        });
      }
      return photos;
    };

    const places = results.slice(0, 10).map((r: any) => {
      return {
        placeId: r.place_id || "",
        dataId: r.data_id || "",
        name: r.title || "",
        address: r.address || "",
        latitude: r.gps_coordinates?.latitude || 0,
        longitude: r.gps_coordinates?.longitude || 0,
        rating: r.rating || 0,
        reviewCount: r.reviews || 0,
        types: r.type ? [r.type.toLowerCase().replace(/\s+/g, "_")] : [],
        primaryType: r.type ? r.type.toLowerCase().replace(/\s+/g, "_") : "other",
        primaryTypeDisplay: r.type || "Địa điểm",
        editorialSummary: r.description || "",
        photos: extractPhotos(r),
        website: r.website || "",
        phone: r.phone || "",
        openNow: r.open_state === "Open" ? true : r.open_state === "Closed" ? false : null,
      };
    });

    // If no local_results, check place_results (SerpAPI returns this for cities/regions)
    if (places.length === 0 && data.place_results) {
      const r = data.place_results;
      let photos = extractPhotos(r);

      // For cities/regions, try fetching photos via google_maps_photos if data_id available
      if (photos.length === 0 && r.data_id) {
        try {
          const photoParams = new URLSearchParams({
            engine: "google_maps_photos",
            data_id: r.data_id,
            hl: "vi",
            api_key: apiKey,
          });
          const photoRes = await fetch(`${SERPAPI_BASE}?${photoParams.toString()}`);
          if (photoRes.ok) {
            const photoData = await photoRes.json();
            (photoData.photos || []).slice(0, 5).forEach((p: any) => {
              const imgUrl = p.image || p.thumbnail;
              if (imgUrl) photos.push({ name: imgUrl, attributions: ["Google Maps"] });
            });
            console.log(`[SerpAPI] 📸 Got ${photos.length} photos for city "${r.title}" via google_maps_photos`);
          }
        } catch { /* photos are optional */ }
      }

      // Fallback: search Google Images for city photos (SerpAPI google engine with tbm=isch)
      if (photos.length === 0) {
        try {
          const imgParams = new URLSearchParams({
            engine: "google_images",
            q: `${r.title || query} thành phố du lịch`,
            hl: "vi",
            num: "5",
            api_key: apiKey,
          });
          const imgRes = await fetch(`${SERPAPI_BASE}?${imgParams.toString()}`);
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            (imgData.images_results || []).slice(0, 5).forEach((img: any) => {
              if (img.original) {
                photos.push({ name: img.original, attributions: ["Google Images"] });
              } else if (img.thumbnail) {
                photos.push({ name: img.thumbnail, attributions: ["Google Images"] });
              }
            });
            console.log(`[SerpAPI] 🖼️ Got ${photos.length} photos for "${r.title}" via google_images`);
          }
        } catch { /* image search is optional */ }
      }

      places.push({
        placeId: r.place_id || "",
        dataId: r.data_id || "",
        name: r.title || "",
        address: r.address || "",
        latitude: r.gps_coordinates?.latitude || 0,
        longitude: r.gps_coordinates?.longitude || 0,
        rating: r.rating || 0,
        reviewCount: r.reviews || 0,
        types: r.type ? [r.type.toLowerCase().replace(/\s+/g, "_")] : [],
        primaryType: r.type ? r.type.toLowerCase().replace(/\s+/g, "_") : "other",
        primaryTypeDisplay: r.type || "Địa điểm",
        editorialSummary: r.description || r.extensions?.join(", ") || "",
        photos,
        website: r.website || "",
        phone: r.phone || "",
        openNow: null,
      });
      console.log(`[SerpAPI] ✅ Search "${query}" → found city/region result from place_results (${photos.length} photos)`);
    } else {
      console.log(`[SerpAPI] ✅ Search "${query}" → ${places.length} results`);
    }

    return { places };
  } catch (error) {
    console.warn(`[SerpAPI] Search error:`, error);
    return null;
  }
}

// SerpAPI Place Details — fetch detailed info for a single place
// Uses type=place with place_id param per SerpAPI docs: https://serpapi.com/maps-place-results
async function getPlaceDetailsSerpApi(placeId: string, language: string) {
  const apiKey = getSerpApiKey();
  if (!apiKey) return null;

  try {
    // Use type=place with place_id parameter (correct SerpAPI usage)
    const params = new URLSearchParams({
      engine: "google_maps",
      place_id: placeId,
      hl: language || "vi",
      type: "place",
      api_key: apiKey,
    });

    const url = `${SERPAPI_BASE}?${params.toString()}`;
    console.log(`[SerpAPI] 🔍 Fetching place details for place_id: "${placeId}"`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[SerpAPI] Place details failed (${response.status})`);
      return null;
    }

    const data = await response.json();

    // type=place returns place_results (single object), not local_results (array)
    const r = data.place_results;
    if (!r) {
      console.warn(`[SerpAPI] No place_results found for place_id: "${placeId}"`);
      return null;
    }

    // Collect photos from place_results
    const photos: { name: string; attributions: string[] }[] = [];
    if (r.thumbnail) {
      photos.push({ name: r.thumbnail, attributions: ["Google Maps"] });
    }
    if (r.images && Array.isArray(r.images)) {
      r.images.slice(0, 4).forEach((img: any) => {
        const imgUrl = typeof img === "string" ? img : img?.thumbnail || img?.image;
        if (imgUrl && imgUrl !== r.thumbnail) {
          photos.push({ name: imgUrl, attributions: ["Google Maps"] });
        }
      });
    }

    // Try to fetch HD photos via google_maps_photos engine if data_id available
    const dataId = r.data_id;
    if (dataId) {
      try {
        const photoParams = new URLSearchParams({
          engine: "google_maps_photos",
          data_id: dataId,
          hl: language || "vi",
          api_key: apiKey,
        });
        const photoUrl = `${SERPAPI_BASE}?${photoParams.toString()}`;
        const photoRes = await fetch(photoUrl);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          const hdPhotos = photoData.photos || [];
          hdPhotos.slice(0, 5).forEach((p: any) => {
            const imgUrl = p.image || p.thumbnail;
            if (imgUrl) {
              photos.push({ name: imgUrl, attributions: ["Google Maps"] });
            }
          });
          console.log(`[SerpAPI] 📸 Got ${hdPhotos.length} HD photos for "${r.title}"`);
        }
      } catch {
        // HD photos are optional, continue without them
      }
    }

    // Fallback: if still no photos (common for cities/regions), use Google Images search
    if (photos.length === 0) {
      try {
        const imgParams = new URLSearchParams({
          engine: "google_images",
          q: `${r.title || ""} thành phố du lịch`,
          hl: language || "vi",
          num: "5",
          api_key: apiKey,
        });
        const imgRes = await fetch(`${SERPAPI_BASE}?${imgParams.toString()}`);
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          (imgData.images_results || []).slice(0, 5).forEach((img: any) => {
            if (img.original) {
              photos.push({ name: img.original, attributions: ["Google Images"] });
            } else if (img.thumbnail) {
              photos.push({ name: img.thumbnail, attributions: ["Google Images"] });
            }
          });
          console.log(`[SerpAPI] 🖼️ Got ${photos.length} fallback photos for "${r.title}" via google_images`);
        }
      } catch {
        // Image search is optional
      }
    }

    // Fetch reviews via SerpAPI google_maps_reviews engine
    let reviews: any[] = [];
    const reviewPlaceId = r.place_id || placeId;
    try {
      const reviewParams = new URLSearchParams({
        engine: "google_maps_reviews",
        place_id: reviewPlaceId,
        hl: language || "vi",
        api_key: apiKey,
      });
      const reviewUrl = `${SERPAPI_BASE}?${reviewParams.toString()}`;
      const reviewRes = await fetch(reviewUrl);
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        reviews = (reviewData.reviews || []).slice(0, 5).map((rv: any) => ({
          author: rv.user?.name || "",
          rating: rv.rating || 0,
          text: rv.snippet || rv.extracted_snippet?.original || "",
          time: rv.date || "",
          profilePhoto: rv.user?.thumbnail || "",
        }));
      }
    } catch {
      // Reviews are optional
    }

    // Parse opening hours from place_results
    // SerpAPI place_results.hours is an array of objects: [{"wednesday": "6:30AM–5PM"}, ...]
    const openingHours: string[] = [];
    if (r.hours && Array.isArray(r.hours)) {
      for (const dayObj of r.hours) {
        for (const [day, hours] of Object.entries(dayObj)) {
          openingHours.push(`${day}: ${hours}`);
        }
      }
    } else if (r.operating_hours) {
      for (const [day, hours] of Object.entries(r.operating_hours)) {
        openingHours.push(`${day}: ${hours}`);
      }
    } else if (r.hours && typeof r.hours === "string") {
      openingHours.push(r.hours);
    }

    // Extract rating — place_results may use "rating" or "user_review.rating"
    const rating = r.rating || r.user_review?.rating || 0;
    const reviewCount = r.reviews || r.user_review?.reviews || 0;

    const result = {
      placeId: r.place_id || placeId,
      dataId: dataId || "",
      name: r.title || "",
      address: r.address || "",
      latitude: r.gps_coordinates?.latitude || 0,
      longitude: r.gps_coordinates?.longitude || 0,
      rating,
      reviewCount,
      types: r.type ? [r.type.toLowerCase().replace(/\s+/g, "_")] : [],
      primaryType: r.type ? r.type.toLowerCase().replace(/\s+/g, "_") : "other",
      primaryTypeDisplay: r.type || "Địa điểm",
      editorialSummary: r.description || r.extensions?.join(", ") || "",
      website: r.website || "",
      phone: r.phone || "",
      priceLevel: r.price ? r.price.length : null,
      photos: photos.slice(0, 5),
      reviews,
      openingHours,
      openNow: r.open_state === "Open" ? true : r.open_state === "Closed" ? false : null,
    };

    console.log(`[SerpAPI] ✅ Place details for "${result.name}" — ★${result.rating} (${result.reviewCount} reviews), ${photos.length} photos`);
    return result;
  } catch (error) {
    console.warn(`[SerpAPI] Place details error:`, error);
    return null;
  }
}

// SerpAPI HD Photos — fetch high-quality photos for a place by data_id
async function getSerpPhotos(req: Request, res: Response) {
  const dataId = req.params.dataId as string;

  if (!dataId) {
    return res.status(400).json({ error: "dataId parameter is required" });
  }

  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return res.status(501).json({ error: "SERPAPI_KEY not configured" });
  }

  try {
    const params = new URLSearchParams({
      engine: "google_maps_photos",
      data_id: dataId,
      hl: "vi",
      api_key: apiKey,
    });

    const url = `${SERPAPI_BASE}?${params.toString()}`;
    console.log(`[SerpAPI] 📸 Fetching photos for data_id=${dataId}`);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[SerpAPI] Photos failed (${response.status}):`, errorText);
      return res.status(response.status).json({ error: "SerpAPI photos request failed" });
    }

    const data = await response.json();
    const photos = (data.photos || []).map((p: any) => ({
      thumbnail: p.thumbnail || "",
      image: p.image || p.thumbnail || "",
    }));

    console.log(`[SerpAPI] ✅ Got ${photos.length} photos for data_id=${dataId}`);
    return res.json({ photos });
  } catch (error) {
    console.error("[SerpAPI] Photos error:", error);
    return res.status(500).json({ error: "Failed to fetch photos" });
  }
}

// Helper: enrich Goong/Nominatim results with SerpAPI rating data
async function enrichWithSerpApiRatings(places: any[], query: string): Promise<any[]> {
  const hasZeroRating = places.some((p: any) => p.rating === 0);
  if (!hasZeroRating || places.length === 0) return places;

  const serpResult = await searchPlacesSerpApi(query);
  if (!serpResult || !serpResult.places || serpResult.places.length === 0) return places;

  const serpPlaces = serpResult.places;

  // Match by normalized name similarity
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]/gi, "");

  return places.map((place: any) => {
    if (place.rating > 0) return place; // already has rating
    const normName = normalize(place.name);
    // Find best match in SerpAPI results
    const match = serpPlaces.find((sp: any) => {
      const spNorm = normalize(sp.name);
      return spNorm.includes(normName) || normName.includes(spNorm) || spNorm === normName;
    });
    if (match) {
      return {
        ...place,
        rating: match.rating || place.rating,
        reviewCount: match.reviewCount || place.reviewCount,
        // Also save the Google Place ID for future SerpAPI reviews lookup
        placeId: match.placeId || place.placeId,
        primaryTypeDisplay: match.primaryTypeDisplay !== "Địa điểm" ? match.primaryTypeDisplay : place.primaryTypeDisplay,
      };
    }
    return place;
  });
}

async function searchPlaces(req: Request, res: Response) {
  const query = req.query.query as string;
  const language = (req.query.language as string) || "vi";

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  // Cách 1: SerpAPI (ưu tiên — có rating, review, thumbnail, data_id)
  const serpResult = await searchPlacesSerpApi(query);
  if (serpResult && serpResult.places && serpResult.places.length > 0) {
    return res.json(serpResult);
  }

  // Cách 2: Google (fallback)
  const googleResult = await searchPlacesGoogle(query, language);
  if (googleResult) return res.json(googleResult);

  // Cách 3: Goong
  const goongResult = await searchPlacesGoong(query, language);
  if (goongResult && goongResult.places && goongResult.places.length > 0) {
    return res.json(goongResult);
  }

  // Cách 4: Nominatim (miễn phí)
  const nominatimResult = await searchPlacesNominatim(query, language);
  return res.json(nominatimResult);
}

// ══════════════════════════════════════════════════════════════
// PLACE DETAILS — Google → Goong → Nominatim
// ══════════════════════════════════════════════════════════════

async function getPlaceDetailsGoogle(placeId: string, language: string) {
  const apiKey = getGoogleKey();
  if (!apiKey) return null;

  try {
    const url = `${GOOGLE_PLACES_BASE}/places/${placeId}`;
    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,rating,userRatingCount,types,primaryType,primaryTypeDisplayName,editorialSummary,photos,websiteUri,nationalPhoneNumber,priceLevel,reviews,regularOpeningHours,currentOpeningHours",
        "Accept-Language": language,
      },
    });

    if (!response.ok) {
      console.warn(`[Google] Details failed (${response.status}), trying fallback...`);
      return null;
    }

    const place = await response.json();
    if (!place.id) return null;

    const priceLevelMap: Record<string, number> = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };

    console.log(`[Google] Details for "${place.displayName?.text}"`);
    return {
      placeId: place.id,
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      rating: place.rating || 0,
      reviewCount: place.userRatingCount || 0,
      types: place.types || [],
      primaryType: place.primaryType || "other",
      primaryTypeDisplay: place.primaryTypeDisplayName?.text || "Địa điểm",
      editorialSummary: place.editorialSummary?.text || "",
      website: place.websiteUri || "",
      phone: place.nationalPhoneNumber || "",
      priceLevel: place.priceLevel ? (priceLevelMap[place.priceLevel] ?? null) : null,
      photos: (place.photos || []).slice(0, 5).map((p: any) => ({
        name: p.name || "",
        attributions: (p.authorAttributions || []).map((a: any) => a.displayName || "Google"),
      })),
      reviews: (place.reviews || []).slice(0, 5).map((r: any) => ({
        author: r.authorAttribution?.displayName || "",
        rating: r.rating || 0,
        text: r.text?.text || "",
        time: r.relativePublishTimeDescription || "",
        profilePhoto: r.authorAttribution?.photoUri || "",
      })),
      openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
      openNow: place.currentOpeningHours?.openNow ?? null,
    };
  } catch (error) {
    console.warn(`[Google] Details error:`, error);
    return null;
  }
}

async function getPlaceDetailsGoong(placeId: string, language: string) {
  const apiKey = getGoongKey();
  if (!apiKey) return null;

  try {
    const url = `${GOONG_BASE}/Place/Detail?api_key=${apiKey}&place_id=${placeId}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[Goong] Details failed (${response.status}), trying fallback...`);
      return null;
    }

    const data = await response.json();
    const place = data.result;
    if (!place) return null;

    console.log(`[Goong] Details for "${place.name}"`);
    return {
      placeId: placeId,
      name: place.name || "",
      address: place.formatted_address || "",
      latitude: place.geometry?.location?.lat || 0,
      longitude: place.geometry?.location?.lng || 0,
      rating: place.rating || 0,
      reviewCount: place.user_ratings_total || 0,
      types: place.types || [],
      primaryType: (place.types && place.types[0]) || "other",
      primaryTypeDisplay: "Địa điểm",
      editorialSummary: "",
      website: place.website || place.url || "",
      phone: place.formatted_phone_number || "",
      priceLevel: place.price_level ?? null,
      photos: (place.photos || []).slice(0, 5).map((p: any) => ({
        name: p.photo_reference || "",
        attributions: (p.html_attributions || []),
      })),
      reviews: (place.reviews || []).slice(0, 5).map((r: any) => ({
        author: r.author_name || "",
        rating: r.rating || 0,
        text: r.text || "",
        time: r.relative_time_description || "",
        profilePhoto: r.profile_photo_url || "",
      })),
      openingHours: place.opening_hours?.weekday_text || [],
      openNow: place.opening_hours?.open_now ?? null,
    };
  } catch (error) {
    console.warn(`[Goong] Details error:`, error);
    return null;
  }
}

async function getPlaceDetailsNominatim(placeId: string, language: string) {
  // For Nominatim place IDs (nominatim_123456)
  const osmId = placeId.replace("nominatim_", "");
  try {
    const url = `${NOMINATIM_BASE}/lookup?osm_ids=N${osmId},W${osmId},R${osmId}&format=json&accept-language=${language}&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TravelPlannerPro/1.0" },
    });

    if (!response.ok || !(await response.clone().json()).length) {
      // If lookup fails, try reverse search with place_id
      const detailUrl = `${NOMINATIM_BASE}/details?place_id=${osmId}&format=json&accept-language=${language}`;
      const detailRes = await fetch(detailUrl, {
        headers: { "User-Agent": "TravelPlannerPro/1.0" },
      });
      if (detailRes.ok) {
        const item = await detailRes.json();
        console.log(`[Nominatim] Details for "${item.localname}"`);
        return {
          placeId,
          name: item.localname || item.names?.name || "",
          address: item.localname || "",
          latitude: parseFloat(item.centroid?.coordinates?.[1]) || 0,
          longitude: parseFloat(item.centroid?.coordinates?.[0]) || 0,
          rating: 0,
          reviewCount: 0,
          types: [item.category || "place"],
          primaryType: item.category || "other",
          primaryTypeDisplay: item.category || "Địa điểm",
          editorialSummary: "",
          website: "",
          phone: "",
          priceLevel: null,
          photos: [],
          reviews: [],
          openingHours: [],
          openNow: null,
        };
      }
    }

    const data = await response.json();
    if (data.length > 0) {
      const item = data[0];
      console.log(`[Nominatim] Details for "${item.display_name}"`);
      return {
        placeId,
        name: item.display_name?.split(",")[0] || "",
        address: item.display_name || "",
        latitude: parseFloat(item.lat) || 0,
        longitude: parseFloat(item.lon) || 0,
        rating: 0,
        reviewCount: 0,
        types: [item.type || "place"],
        primaryType: item.type || "other",
        primaryTypeDisplay: item.type || "Địa điểm",
        editorialSummary: "",
        website: "",
        phone: "",
        priceLevel: null,
        photos: [],
        reviews: [],
        openingHours: [],
        openNow: null,
      };
    }

    return null;
  } catch (error) {
    console.warn(`[Nominatim] Details error:`, error);
    return null;
  }
}

async function getPlaceDetails(req: Request, res: Response) {
  const placeId = req.params.placeId as string;
  const language = (req.query.language as string) || "vi";

  if (!placeId) {
    return res.status(400).json({ error: "placeId parameter is required" });
  }

  // Cách 1: SerpAPI (ưu tiên — có ảnh HD, reviews, rating)
  const serpResult = await getPlaceDetailsSerpApi(placeId, language);
  if (serpResult) return res.json(serpResult);

  // Cách 2: Google (fallback)
  const googleResult = await getPlaceDetailsGoogle(placeId, language);
  if (googleResult) return res.json(googleResult);

  // Cách 3: Goong
  const goongResult = await getPlaceDetailsGoong(placeId, language);
  if (goongResult) return res.json(goongResult);

  // Cách 4: Nominatim
  const nominatimResult = await getPlaceDetailsNominatim(placeId, language);
  if (nominatimResult) return res.json(nominatimResult);

  return res.status(404).json({ error: "Place not found" });
}

// ══════════════════════════════════════════════════════════════
// GEOCODE — Google → Goong → Nominatim
// ══════════════════════════════════════════════════════════════

async function geocodeGoogle(address: string) {
  const apiKey = getGoogleKey();
  if (!apiKey) return null;

  try {
    const url = `${GOOGLE_GEOCODE_BASE}?key=${apiKey}&address=${encodeURIComponent(address)}&language=vi`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== "OK" || !data.results?.length) return null;

    const results = data.results.map((r: any) => ({
      formattedAddress: r.formatted_address || "",
      latitude: r.geometry?.location?.lat || 0,
      longitude: r.geometry?.location?.lng || 0,
      placeId: r.place_id || "",
    }));

    console.log(`[Google] Geocode "${address}" → ${results.length} results`);
    return { results };
  } catch (error) {
    console.warn(`[Google] Geocode error:`, error);
    return null;
  }
}

async function geocodeGoong(address: string) {
  const apiKey = getGoongKey();
  if (!apiKey) return null;

  try {
    const url = `${GOONG_BASE}/Geocode?api_key=${apiKey}&address=${encodeURIComponent(address)}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results?.length) return null;

    const results = data.results.map((r: any) => ({
      formattedAddress: r.formatted_address || "",
      latitude: r.geometry?.location?.lat || 0,
      longitude: r.geometry?.location?.lng || 0,
      placeId: r.place_id || "",
    }));

    console.log(`[Goong] Geocode "${address}" → ${results.length} results`);
    return { results };
  } catch (error) {
    console.warn(`[Goong] Geocode error:`, error);
    return null;
  }
}

async function geocodeNominatim(address: string) {
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(address)}&limit=5&accept-language=vi`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TravelPlannerPro/1.0" },
    });
    if (!response.ok) return { results: [] };

    const data = await response.json();
    const results = data.map((item: any) => ({
      formattedAddress: item.display_name || "",
      latitude: parseFloat(item.lat) || 0,
      longitude: parseFloat(item.lon) || 0,
      placeId: `nominatim_${item.place_id}`,
    }));

    console.log(`[Nominatim] Geocode "${address}" → ${results.length} results`);
    return { results };
  } catch (error) {
    console.warn(`[Nominatim] Geocode error:`, error);
    return { results: [] };
  }
}

async function geocodeAddress(req: Request, res: Response) {
  const address = req.query.address as string;

  if (!address) {
    return res.status(400).json({ error: "address parameter is required" });
  }

  // Cách 1: Google
  const googleResult = await geocodeGoogle(address);
  if (googleResult) return res.json(googleResult);

  // Cách 2: Goong
  const goongResult = await geocodeGoong(address);
  if (goongResult) return res.json(goongResult);

  // Cách 3: Nominatim (miễn phí)
  const nominatimResult = await geocodeNominatim(address);
  return res.json(nominatimResult);
}

// ══════════════════════════════════════════════════════════════
// DIRECTIONS — Google → Goong → OSRM
// ══════════════════════════════════════════════════════════════

async function directionsGoogle(origin: string, destination: string, vehicle: string) {
  const apiKey = getGoogleKey();
  if (!apiKey) return null;

  try {
    const mode = mapVehicleToMode(vehicle);
    const url = `${GOOGLE_DIRECTIONS_BASE}?key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&language=vi`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== "OK" || !data.routes?.length) return null;

    console.log(`[Google] Directions ${origin} → ${destination}`);
    return data;
  } catch (error) {
    console.warn(`[Google] Directions error:`, error);
    return null;
  }
}

async function directionsGoong(origin: string, destination: string, vehicle: string) {
  const apiKey = getGoongKey();
  if (!apiKey) return null;

  try {
    const goongVehicle = vehicle === "walking" ? "bike" : (vehicle || "car");
    const url = `${GOONG_BASE}/Direction?api_key=${apiKey}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&vehicle=${goongVehicle}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.routes?.length) return null;

    console.log(`[Goong] Directions ${origin} → ${destination}`);
    return data;
  } catch (error) {
    console.warn(`[Goong] Directions error:`, error);
    return null;
  }
}

async function directionsOSRM(origin: string, destination: string) {
  try {
    // Parse origin/destination — they might be "lat,lng" or address text
    let originCoords = origin;
    let destCoords = destination;

    // If it looks like coordinates "lat,lng", convert to "lng,lat" for OSRM
    const coordRegex = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;

    const origMatch = origin.match(coordRegex);
    if (origMatch) {
      originCoords = `${origMatch[2]},${origMatch[1]}`; // OSRM uses lng,lat
    } else {
      // Need to geocode the address first
      const geo = await geocodeNominatim(origin);
      if (geo.results.length > 0) {
        originCoords = `${geo.results[0].longitude},${geo.results[0].latitude}`;
      } else {
        return null;
      }
    }

    const destMatch = destination.match(coordRegex);
    if (destMatch) {
      destCoords = `${destMatch[2]},${destMatch[1]}`;
    } else {
      const geo = await geocodeNominatim(destination);
      if (geo.results.length > 0) {
        destCoords = `${geo.results[0].longitude},${geo.results[0].latitude}`;
      } else {
        return null;
      }
    }

    const url = `${OSRM_BASE}/route/v1/driving/${originCoords};${destCoords}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    // Convert OSRM format to Google-compatible format
    const route = data.routes[0];
    const result = {
      status: "OK",
      routes: [{
        legs: route.legs.map((leg: any) => ({
          distance: { text: `${(leg.distance / 1000).toFixed(1)} km`, value: leg.distance },
          duration: { text: `${Math.round(leg.duration / 60)} phút`, value: leg.duration },
          steps: (leg.steps || []).map((step: any) => ({
            distance: { text: `${Math.round(step.distance)} m`, value: step.distance },
            duration: { text: `${Math.round(step.duration / 60)} phút`, value: step.duration },
            html_instructions: step.name || "",
            maneuver: { location: step.maneuver?.location },
          })),
        })),
        overview_polyline: {
          points: "", // OSRM uses GeoJSON, not encoded polyline
        },
      }],
    };

    console.log(`[OSRM] Directions ${origin} → ${destination}`);
    return result;
  } catch (error) {
    console.warn(`[OSRM] Directions error:`, error);
    return null;
  }
}

async function getDirections(req: Request, res: Response) {
  const origin = req.query.origin as string;
  const destination = req.query.destination as string;
  const vehicle = (req.query.vehicle as string) || "car";

  if (!origin || !destination) {
    return res.status(400).json({ error: "origin and destination are required" });
  }

  // Cách 1: Google
  const googleResult = await directionsGoogle(origin, destination, vehicle);
  if (googleResult) return res.json(googleResult);

  // Cách 2: Goong
  const goongResult = await directionsGoong(origin, destination, vehicle);
  if (goongResult) return res.json(goongResult);

  // Cách 3: OSRM (miễn phí)
  const osrmResult = await directionsOSRM(origin, destination);
  if (osrmResult) return res.json(osrmResult);

  return res.json({ routes: [] });
}

// ══════════════════════════════════════════════════════════════
// PLACE PHOTO — Google → Unsplash fallback
// ══════════════════════════════════════════════════════════════

async function getPlacePhoto(req: Request, res: Response) {
  const photoName = req.query.name as string;
  const maxWidth = parseInt(req.query.maxWidth as string) || 800;
  const dataId = req.query.data_id as string; // Optional: SerpAPI data_id for HD photos

  if (!photoName && !dataId) {
    return res.status(400).json({ error: "Photo name or data_id parameter is required" });
  }

  // If photoName is already a direct URL (e.g. from SerpAPI thumbnail/image), just redirect
  if (photoName && photoName.startsWith("http")) {
    return res.redirect(photoName);
  }

  try {
    // Priority 1: If data_id provided, fetch HD photo from SerpAPI google_maps_photos
    if (dataId) {
      const serpKey = getSerpApiKey();
      if (serpKey) {
        try {
          const params = new URLSearchParams({
            engine: "google_maps_photos",
            data_id: dataId,
            hl: "vi",
            api_key: serpKey,
          });
          const serpUrl = `${SERPAPI_BASE}?${params.toString()}`;
          const serpRes = await fetch(serpUrl);
          if (serpRes.ok) {
            const serpData = await serpRes.json();
            const photos = serpData.photos || [];
            if (photos.length > 0) {
              // Redirect to the first HD image
              const hdUrl = photos[0].image || photos[0].thumbnail;
              if (hdUrl) {
                console.log(`[SerpAPI] 📸 Serving HD photo from data_id=${dataId}`);
                return res.redirect(hdUrl);
              }
            }
          }
        } catch {
          console.warn(`[SerpAPI] HD photo fetch failed for data_id=${dataId}, trying fallbacks...`);
        }
      }
    }

    // Priority 2: Google Places photo (if it's a Google resource name)
    const googleKey = getGoogleKey();
    if (photoName && googleKey && photoName.startsWith("places/")) {
      const url = `${GOOGLE_PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${googleKey}`;
      const response = await fetch(url, { redirect: "follow" });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");

        const buffer = await response.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }
      console.warn(`[Google] Photo failed, trying Unsplash fallback...`);
    }

    // Priority 3: Fallback to Unsplash
    const searchTerm = photoName || "travel landscape";
    const url = `https://source.unsplash.com/${maxWidth}x${Math.round(maxWidth * 0.66)}/?${encodeURIComponent(searchTerm + " travel landscape")}`;
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

// ══════════════════════════════════════════════════════════════
// Internal geocode helper — Google → Goong → Nominatim
// Used by generate-itinerary to get accurate coordinates
// ══════════════════════════════════════════════════════════════

async function internalGeocode(address: string): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  // Cách 1: Google
  const googleKey = getGoogleKey();
  if (googleKey) {
    try {
      const url = `${GOOGLE_GEOCODE_BASE}?key=${googleKey}&address=${encodeURIComponent(address)}&language=vi`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && data.results?.length) {
          const r = data.results[0];
          return {
            lat: r.geometry?.location?.lat || 0,
            lng: r.geometry?.location?.lng || 0,
            formattedAddress: r.formatted_address || address,
          };
        }
      }
    } catch { }
  }

  // Cách 2: Goong
  const goongKey = getGoongKey();
  if (goongKey) {
    try {
      const url = `${GOONG_BASE}/Geocode?api_key=${goongKey}&address=${encodeURIComponent(address)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results?.length) {
          const r = data.results[0];
          return {
            lat: r.geometry?.location?.lat || 0,
            lng: r.geometry?.location?.lng || 0,
            formattedAddress: r.formatted_address || address,
          };
        }
      }
    } catch { }
  }

  // Cách 3: Nominatim (miễn phí)
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=vi`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TravelPlannerPro/1.0" },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat) || 0,
          lng: parseFloat(data[0].lon) || 0,
          formattedAddress: data[0].display_name || address,
        };
      }
    }
  } catch { }

  return null;
}

// POST /api/share — register a trip share (database-backed)
async function shareTrip(req: Request, res: Response) {
  const { shareCode, itinerary } = req.body;
  if (!shareCode || !itinerary) {
    return res.status(400).json({ error: "shareCode and itinerary are required" });
  }
  // Upsert: update if exists, create if not
  const existing = await storage.getSharedTrip(shareCode);
  if (existing) {
    await storage.updateSharedTrip(shareCode, { itinerary });
  } else {
    await storage.createSharedTrip({ shareCode, itinerary });
  }
  return res.json({ ok: true });
}

// GET /api/share/:code — look up a shared trip
async function getSharedTrip(req: Request, res: Response) {
  const code = req.params.code as string;
  const trip = await storage.getSharedTrip(code);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  return res.json(trip.itinerary);
}

// POST /api/share/join — join a shared trip (update companions)
async function joinSharedTrip(req: Request, res: Response) {
  const { shareCode, companion } = req.body;
  if (!shareCode || !companion) {
    return res.status(400).json({ error: "shareCode and companion are required" });
  }
  const trip = await storage.getSharedTrip(shareCode);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  const itinerary = trip.itinerary as any;
  const companions = itinerary.companions || [];
  if (companions.some((c: any) => c.userId === companion.userId)) {
    return res.json({ ok: true, alreadyJoined: true, itinerary });
  }
  companions.push(companion);
  itinerary.companions = companions;
  await storage.updateSharedTrip(shareCode, { itinerary });
  return res.json({ ok: true, alreadyJoined: false, itinerary });
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
  const trip = await storage.getSharedTrip(shareCode);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  const itinerary = trip.itinerary as any;
  const companions = itinerary.companions || [];
  const companion = companions.find((c: any) => c.userId === userId);
  if (!companion) {
    return res.status(404).json({ error: "Companion not found" });
  }
  companion.role = role;
  await storage.updateSharedTrip(shareCode, { itinerary });
  return res.json({ ok: true });
}

// DELETE /api/share/companion — remove a companion
async function removeCompanion(req: Request, res: Response) {
  const { shareCode, userId } = req.body;
  if (!shareCode || !userId) {
    return res.status(400).json({ error: "shareCode and userId are required" });
  }
  const trip = await storage.getSharedTrip(shareCode);
  if (!trip) {
    return res.status(404).json({ error: "Share code not found" });
  }
  const itinerary = trip.itinerary as any;
  itinerary.companions = (itinerary.companions || []).filter((c: any) => c.userId !== userId);
  await storage.updateSharedTrip(shareCode, { itinerary });
  return res.json({ ok: true });
}

// ══════════════════════════════════════════════════════════════
// Helper: strip Vietnamese activity prefixes to get actual place name
// ══════════════════════════════════════════════════════════════
function extractPlaceName(title: string): string {
  return title
    .replace(/^(Ăn sáng|Ăn trưa|Ăn tối|Ăn chiều|Nghỉ trưa|Nghỉ đêm|Nghỉ ngơi|Check-in|Check-out|Tham quan|Khám phá|Trải nghiệm|Dạo chơi|Đi bộ|Di chuyển|Mua sắm|Thưởng thức|Ghé thăm|Uống cà phê|Cà phê|Cafe)\s*(tại|ở|đến|quanh|trong|trên|vào|lúc)?\s*/i, "")
    .trim();
}

// ══════════════════════════════════════════════════════════════
// Helper: Extract activities from itinerary days and save as POIs
// ══════════════════════════════════════════════════════════════
async function extractAndSavePOIsFromItinerary(days: any[]): Promise<number> {
  if (!days || !Array.isArray(days) || days.length === 0) return 0;

  let savedCount = 0;
  const allActivities: any[] = [];

  for (const day of days) {
    if (!day.activities || !Array.isArray(day.activities)) continue;
    for (const act of day.activities) {
      allActivities.push(act);
    }
  }

  console.log(`[POI-Save] Extracting POIs from ${allActivities.length} activities...`);

  // Map activityType to POI type
  const poiTypeMap: Record<string, string> = {
    food: "restaurant",
    sightseeing: "attraction",
    shopping: "shopping",
    transport: "other",
    other: "other",
  };

  for (const act of allActivities) {
    try {
      // Skip activities without useful data
      if (!act.title || (!act.latitude && !act.address)) continue;

      // Extract place name from title
      const placeName = extractPlaceName(act.title);
      if (!placeName || placeName.length < 3) continue;

      // Dedup: check by googlePlaceId first, then by name
      let existingPoi = null;
      if (act.googlePlaceId) {
        existingPoi = await storage.getPoiByGooglePlaceId(act.googlePlaceId);
      }
      if (!existingPoi) {
        existingPoi = await storage.getPoiByName(placeName);
      }

      if (existingPoi) {
        // Update existing POI if new data is better
        const updates: Record<string, any> = {};
        if (act.rating && (!existingPoi.rating || act.rating > (existingPoi.rating || 0))) updates.rating = act.rating;
        if (act.reviewCount && act.reviewCount > (existingPoi.reviewCount || 0)) updates.reviewCount = act.reviewCount;
        if (act.address && !existingPoi.address) updates.address = act.address;
        if (act.latitude && act.longitude && (!existingPoi.latitude || existingPoi.latitude === 0)) {
          updates.latitude = act.latitude;
          updates.longitude = act.longitude;
        }
        if (act.openHours && !existingPoi.openHours) updates.openHours = act.openHours;
        if (act.openingHours && Array.isArray(act.openingHours) && act.openingHours.length > 0) {
          const existing = existingPoi.openingHours as any[];
          if (!existing || existing.length === 0) updates.openingHours = act.openingHours;
        }
        if (Object.keys(updates).length > 0) {
          await storage.updatePoi(existingPoi.id, updates);
        }
        continue;
      }

      await storage.createPoi({
        name: placeName,
        type: poiTypeMap[act.activityType] || "attraction",
        address: act.address || "",
        latitude: act.latitude || 0,
        longitude: act.longitude || 0,
        rating: act.rating || 0,
        reviewCount: act.reviewCount || 0,
        openHours: act.openHours || undefined,
        openingHours: act.openingHours || undefined,
        estimatedCost: act.estimatedCost || undefined,
        description: act.description || "",
        images: act.thumbnail ? [act.thumbnail] : [],
        googlePlaceId: act.googlePlaceId || undefined,
        tags: [],
        isActive: true,
        source: "itinerary_saved",
      });
      savedCount++;
    } catch (err) {
      console.warn(`[POI-Save] Failed to save POI for "${act.title}":`, err);
    }
  }

  console.log(`[POI-Save] Saved ${savedCount} new POIs to database`);
  return savedCount;
}

// ══════════════════════════════════════════════════════════════
// AI ITINERARY GENERATION (with fallback geocoding)
// ══════════════════════════════════════════════════════════════

async function generateItineraryAI(req: Request, res: Response) {
  const { destination, startDate, endDate, budget, totalBudget, numPeople, preferences, startingPoint } = req.body;

  if (!destination || !startDate || !endDate) {
    return res.status(400).json({ error: "destination, startDate, endDate are required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return res.status(501).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    const prefsText = preferences && preferences.length > 0
      ? preferences.join(", ")
      : "";

    // Calculate number of days
    const parseDate = (d: string) => {
      const parts = d.split(/[-/]/);
      if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return new Date(d);
    };
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const numDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const budgetPerDay = totalBudget ? Math.round(totalBudget / numDays) : 0;

    // Resolve destination to province for better AI guidance
    const destProvinceMap: Record<string, string> = {
      "hạ long": "Quảng Ninh", "vịnh hạ long": "Quảng Ninh", "quảng ninh": "Quảng Ninh",
      "hội an": "Quảng Nam", "quảng nam": "Quảng Nam",
      "sa pa": "Lào Cai", "sapa": "Lào Cai", "lào cai": "Lào Cai",
      "phú quốc": "Kiên Giang", "kiên giang": "Kiên Giang",
      "đà nẵng": "Đà Nẵng",
      "ninh bình": "Ninh Bình",
      "đà lạt": "Lâm Đồng", "lâm đồng": "Lâm Đồng",
      "huế": "Thừa Thiên Huế", "thừa thiên huế": "Thừa Thiên Huế",
      "nha trang": "Khánh Hòa", "khánh hòa": "Khánh Hòa",
      "phong nha": "Quảng Bình", "quảng bình": "Quảng Bình",
      "hà nội": "Hà Nội", "hồ chí minh": "TP. Hồ Chí Minh", "sài gòn": "TP. Hồ Chí Minh",
      "vũng tàu": "Bà Rịa - Vũng Tàu", "phan thiết": "Bình Thuận", "mũi né": "Bình Thuận",
      "cần thơ": "Cần Thơ", "quy nhơn": "Bình Định", "buôn ma thuột": "Đắk Lắk",
      "hải phòng": "Hải Phòng", "cát bà": "Hải Phòng",
    };
    const destKey = destination.toLowerCase().trim();
    const province = destProvinceMap[destKey] || destination;

    const prompt = `Tạo lịch trình du lịch ${numDays} ngày tại ${destination} (thuộc tỉnh/thành phố: ${province}).

THÔNG TIN:
- Điểm đến: ${destination} (${province})
- Ngày: ${startDate} → ${endDate} (${numDays} ngày)
- Số người: ${numPeople || 2}
- Tổng ngân sách: ${totalBudget ? totalBudget.toLocaleString("vi-VN") + "đ" : "không giới hạn"} (≈${budgetPerDay > 0 ? budgetPerDay.toLocaleString("vi-VN") + "đ/ngày" : "tùy ý"})
${prefsText ? `- Sở thích: ${prefsText}` : ""}

QUY TẮC BẮT BUỘC:
1. 100% địa điểm PHẢI nằm trong ${province}. KHÔNG ĐƯỢC có địa điểm ở tỉnh/thành phố khác.
2. QUAN TRỌNG NHẤT: "title" PHẢI là TÊN CHÍNH XÁC của địa điểm/nhà hàng/quán ăn/khách sạn NHƯ TRÊN GOOGLE MAPS. Ví dụ: "Ăn sáng tại Nhà Hàng Hải Cảng Sầm Sơn", "Tham quan Công trời Sầm Sơn". KHÔNG ĐƯỢC dùng tên chung chung như "Ăn sáng tại quán phở", "Tham quan bãi biển".
3. Mỗi ngày có 5-6 hoạt động: Ăn sáng → Tham quan sáng → Ăn trưa → Tham quan chiều → Ăn tối → (Hoạt động tối tùy chọn)
4. NGÂN SÁCH: Tổng estimatedCost PHẢI trong khoảng ${totalBudget ? (totalBudget * 0.85).toLocaleString("vi-VN") + "đ - " + (totalBudget * 1.0).toLocaleString("vi-VN") + "đ" : "hợp lý"}. estimatedCost đã tính cho ${numPeople || 2} người.
5. Thời gian: Ước lượng thực tế theo giờ mở cửa thông thường (VD: Ăn sáng 07:30, Tham quan từ 08:30 hoặc 09:00 trở đi, Ăn tối 18:30). Sắp xếp logic, thời gian di chuyển hợp lý. Ghi rõ dạng HH:MM.
6. KHÔNG CẦN cung cấp address, latitude, longitude, rating chính xác — hệ thống sẽ tự tra cứu từ Google Maps.
${prefsText ? `7. ƯU TIÊN: ${prefsText}` : ""}

JSON format:
{
  "days": [
    {
      "day": 1,
      "title": "Ngày 1 - Tiêu đề",
      "activities": [
        {
          "time": "07:00",
          "title": "Ăn sáng tại [TÊN CHÍNH XÁC NHÀ HÀNG TRÊN GOOGLE MAPS]",
          "description": "Mô tả ngắn gọn về địa điểm",
          "duration": "1 giờ",
          "estimatedCost": 120000,
          "activityType": "food"
        }
      ]
    }
  ]
}

activityType: "food" | "sightseeing" | "transport" | "shopping" | "other"`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `Bạn là chuyên gia du lịch Việt Nam. CHỈ gợi ý địa điểm tại ${destination} thuộc ${province}. TUYỆT ĐỐI KHÔNG gợi ý địa điểm ở tỉnh/thành phố khác. QUAN TRỌNG: Mỗi hoạt động PHẢI dùng TÊN CHÍNH XÁC của nhà hàng/quán ăn/điểm tham quan NHƯ TRÊN GOOGLE MAPS để hệ thống có thể tra cứu thông tin. Không dùng tên chung chung.` }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      return res.status(502).json({ error: "Gemini API error", details: errorText });
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.error("Gemini returned empty response:", JSON.stringify(geminiData));
      return res.status(502).json({ error: "Gemini returned empty response" });
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let parsed;
    try {
      const jsonStr = textContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse Gemini response:", textContent);
      return res.status(502).json({ error: "Failed to parse AI response", raw: textContent });
    }

    // Validate structure
    if (!parsed.days || !Array.isArray(parsed.days)) {
      return res.status(502).json({ error: "Invalid AI response structure", raw: parsed });
    }

    // Post-process: add IDs, defaults, Google Maps URLs, and budget scaling
    let totalEstimated = 0;
    const allActivities: any[] = [];
    for (const day of parsed.days) {
      if (!day.activities) day.activities = [];
      for (const act of day.activities) {
        act.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        act.isCompleted = false;
        act.estimatedCost = act.estimatedCost || 0;
        act.activityType = act.activityType || "sightseeing";
        act.duration = act.duration || "1 giờ";
        act.rating = act.rating || undefined;
        allActivities.push(act);
        totalEstimated += act.estimatedCost;
      }
    }

    // ═══ SerpAPI Enrichment: Search each activity on Google Maps for real data ═══
    const serpApiKey = getSerpApiKey();
    console.log(`[Enrich] Enriching ${allActivities.length} activities with SerpAPI...`);

    // First, get destination coordinates for location bias (@lat,lng,zoom)
    let destLat = 0, destLng = 0;
    const destGeo = await internalGeocode(destination);
    if (destGeo) {
      destLat = destGeo.lat;
      destLng = destGeo.lng;
    }
    const locationBias = destLat && destLng ? `@${destLat},${destLng},14z` : "";

    // extractPlaceName is now a top-level function (reused by itinerary save POI logic)

    // Run sequentially to avoid SerpAPI rate limits
    for (const act of allActivities) {
      if (!serpApiKey) break;

      // Extract the actual place name for better search
      const placeName = extractPlaceName(act.title);
      const searchQuery = placeName.length > 3 ? `${placeName} ${destination}` : `${act.title} ${destination}`;

      try {
        const params = new URLSearchParams({
          engine: "google_maps",
          q: searchQuery,
          hl: "vi",
          type: "search",
          api_key: serpApiKey,
        });
        if (locationBias) {
          params.set("ll", locationBias);
        }

        const serpUrl = `${SERPAPI_BASE}?${params.toString()}`;
        console.log(`[Enrich] Searching: "${searchQuery}"`);
        const serpRes = await fetch(serpUrl);

        if (serpRes.ok) {
          const serpData = await serpRes.json();
          const results = serpData.local_results || [];
          if (results.length > 0) {
            // Take the best match (first result)
            const match = results[0];
            // Update activity with real data from SerpAPI
            if (match.gps_coordinates?.latitude && match.gps_coordinates?.longitude) {
              act.latitude = match.gps_coordinates.latitude;
              act.longitude = match.gps_coordinates.longitude;
            }
            if (match.address) act.address = match.address;
            if (match.rating) act.rating = match.rating;
            if (match.reviews) act.reviewCount = match.reviews;
            // match.hours from local_results is a status string ("Open ⋅ Closes 10 PM"), not schedule
            // Use operating_hours object if available for actual schedule
            if (match.operating_hours) {
              const schedule: string[] = [];
              for (const [day, hours] of Object.entries(match.operating_hours)) {
                schedule.push(`${day}: ${hours}`);
              }
              act.openHours = schedule.join(" | ");
              act.openingHours = schedule;
            } else if (match.hours && typeof match.hours === "string") {
              // Fallback: use the status string but it's less useful
              act.openHours = match.hours;
            }
            if (match.place_id) act.googlePlaceId = match.place_id;
            if (match.type) act.placeType = match.type;
            if (match.thumbnail) act.thumbnail = match.thumbnail;
            // Enrich description with Google Maps info
            if (match.title) {
              act.description = `${match.title} — ★ ${match.rating || "N/A"}/5${match.reviews ? ` (${match.reviews} đánh giá)` : ""}. ${act.description || ""}`.trim();
            }
            // Generate Google Maps URL
            act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${act.latitude},${act.longitude}`;
            console.log(`[Enrich] ✅ "${act.title}" → ${match.title} | ${match.address} (${match.rating}★, ${match.reviews || 0} reviews)`);
          } else {
            console.log(`[Enrich] ⚠️ No results for: "${searchQuery}"`);
          }
        } else {
          console.warn(`[Enrich] ❌ SerpAPI HTTP ${serpRes.status} for: "${searchQuery}"`);
        }
      } catch (err) {
        console.warn(`[Enrich] ❌ SerpAPI error for "${act.title}":`, err);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    // Fallback geocoding for activities that SerpAPI missed
    for (const act of allActivities) {
      if (act.latitude && act.longitude && act.latitude !== 0 && act.longitude !== 0) continue;
      // No coordinates yet — try geocoding
      if (act.address) {
        const geo = await internalGeocode(act.address);
        if (geo && geo.lat !== 0 && geo.lng !== 0) {
          act.latitude = geo.lat;
          act.longitude = geo.lng;
          act.address = geo.formattedAddress;
        } else if (act.title) {
          const geo2 = await internalGeocode(`${act.title}, ${destination}`);
          if (geo2 && geo2.lat !== 0 && geo2.lng !== 0) {
            act.latitude = geo2.lat;
            act.longitude = geo2.lng;
            act.address = geo2.formattedAddress;
          }
        }
      }
      // Generate Google Maps URL
      if (act.latitude && act.longitude) {
        act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${act.latitude},${act.longitude}`;
      } else if (act.address) {
        act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.title + " " + act.address)}`;
      }
    }
    console.log(`[Enrich] Complete — all ${allActivities.length} activities processed`);

    // Budget scaling: if total is way off budget, scale proportionally
    if (totalBudget && totalEstimated > 0) {
      const ratio = totalBudget / totalEstimated;
      if (ratio < 0.7 || ratio > 1.3) {
        const targetTotal = totalBudget * 0.92;
        const scale = targetTotal / totalEstimated;
        for (const day of parsed.days) {
          for (const act of day.activities) {
            act.estimatedCost = Math.round(act.estimatedCost * scale / 1000) * 1000;
          }
        }
      }
    }

    // ═══ Save enriched activities as POIs (dedup by googlePlaceId or name) ═══
    console.log(`[POI] Saving POIs from ${allActivities.length} activities...`);
    let savedCount = 0;
    for (const act of allActivities) {
      try {
        // Skip activities without useful data
        if (!act.title || (!act.latitude && !act.address)) continue;

        // Extract place name from title
        const placeName = extractPlaceName(act.title);
        if (!placeName || placeName.length < 3) continue;

        // Dedup: check by googlePlaceId first, then by name
        let existingPoi = null;
        if (act.googlePlaceId) {
          existingPoi = await storage.getPoiByGooglePlaceId(act.googlePlaceId);
        }
        if (!existingPoi) {
          existingPoi = await storage.getPoiByName(placeName);
        }

        if (existingPoi) {
          // Update existing POI if new data is better
          const updates: Record<string, any> = {};
          if (act.rating && (!existingPoi.rating || act.rating > (existingPoi.rating || 0))) updates.rating = act.rating;
          if (act.reviewCount && act.reviewCount > (existingPoi.reviewCount || 0)) updates.reviewCount = act.reviewCount;
          if (act.address && !existingPoi.address) updates.address = act.address;
          if (act.latitude && act.longitude && (!existingPoi.latitude || existingPoi.latitude === 0)) {
            updates.latitude = act.latitude;
            updates.longitude = act.longitude;
          }
          if (Object.keys(updates).length > 0) {
            await storage.updatePoi(existingPoi.id, updates);
          }
          continue;
        }

        // Map activityType to POI type
        const poiTypeMap: Record<string, string> = {
          food: "restaurant",
          sightseeing: "attraction",
          shopping: "shopping",
          transport: "other",
          other: "other",
        };

        await storage.createPoi({
          name: placeName,
          type: poiTypeMap[act.activityType] || "attraction",
          address: act.address || "",
          latitude: act.latitude || 0,
          longitude: act.longitude || 0,
          rating: act.rating || 0,
          reviewCount: act.reviewCount || 0,
          openHours: act.openHours || undefined,
          openingHours: act.openingHours || undefined,
          estimatedCost: act.estimatedCost || undefined,
          description: act.description || "",
          images: act.thumbnail ? [act.thumbnail] : [],
          googlePlaceId: act.googlePlaceId || undefined,
          tags: [],
          isActive: true,
          source: "ai_generated",
        });
        savedCount++;
      } catch (err) {
        console.warn(`[POI] Failed to save POI for "${act.title}":`, err);
      }
    }
    console.log(`[POI] Saved ${savedCount} new POIs to database`);

    return res.json(parsed);
  } catch (error) {
    console.error("Generate itinerary error:", error);
    return res.status(500).json({ error: "Failed to generate itinerary" });
  }
}

// ══════════════════════════════════════════════════════════════
// API endpoint to check which provider is active
// ══════════════════════════════════════════════════════════════

async function getProviderStatus(req: Request, res: Response) {
  const provider = getActiveProvider();
  const hasSerpApi = !!getSerpApiKey();
  const hasGoogle = !!getGoogleKey();
  const hasGoong = !!getGoongKey();

  return res.json({
    activeProvider: hasSerpApi ? "serpapi" : provider,
    providers: {
      serpapi: { available: hasSerpApi, name: "SerpAPI Google Maps (PRIMARY)", primary: true },
      google: { available: hasGoogle, name: "Google Maps Platform (fallback)" },
      goong: { available: hasGoong, name: "Goong Maps (fallback)" },
      free: { available: true, name: "OpenStreetMap + OSRM (miễn phí)" },
    },
    fallbackChain: [
      hasSerpApi ? "✅ SerpAPI (PRIMARY — search, details, photos, reviews)" : "❌ SerpAPI (no key)",
      hasGoogle ? "✅ Google Maps (fallback)" : "❌ Google Maps (no key)",
      hasGoong ? "✅ Goong Maps (fallback)" : "❌ Goong Maps (no key)",
      "✅ Nominatim + OSRM (always available)",
    ],
  });
}

// ══════════════════════════════════════════════════════════════
// PLACE REVIEWS via SerpAPI — Google Maps Reviews
// ══════════════════════════════════════════════════════════════

async function getPlaceReviewsSerpApi(req: Request, res: Response) {
  const placeId = req.query.place_id as string;
  const nextPageToken = req.query.next_page_token as string | undefined;

  if (!placeId) {
    return res.status(400).json({ error: "place_id parameter is required" });
  }

  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return res.status(501).json({ error: "SERPAPI_KEY not configured" });
  }

  try {
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      place_id: placeId,
      hl: "vi",
      api_key: apiKey,
    });
    if (nextPageToken) {
      params.set("next_page_token", nextPageToken);
    }

    const url = `${SERPAPI_BASE}?${params.toString()}`;
    console.log(`[SerpAPI] Fetching reviews for place_id=${placeId}${nextPageToken ? " (next page)" : ""}`);

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[SerpAPI] Reviews failed (${response.status}):`, errorText);
      return res.status(response.status).json({ error: "SerpAPI request failed", details: errorText });
    }

    const data = await response.json();

    // Map response to our format
    const placeInfo = data.place_info ? {
      title: data.place_info.title || "",
      address: data.place_info.address || "",
      rating: data.place_info.rating || 0,
      totalReviews: data.place_info.reviews || 0,
      type: data.place_info.type || "",
    } : null;

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
      response: r.response ? {
        snippet: r.response.snippet || r.response.extracted_snippet?.original || "",
        date: r.response.date || "",
      } : null,
    }));

    const nextToken = data.serpapi_pagination?.next_page_token || null;

    console.log(`[SerpAPI] Got ${reviews.length} reviews for "${placeInfo?.title || placeId}"`);
    return res.json({
      placeInfo,
      reviews,
      nextPageToken: nextToken,
    });
  } catch (error) {
    console.error("[SerpAPI] Reviews error:", error);
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
}

// ══════════════════════════════════════════════════════════════
// Register all routes
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// Auto-discover POIs: find restaurants + attractions near a destination
// ══════════════════════════════════════════════════════════════
async function autoDiscoverPOIs(req: Request, res: Response) {
  const query = req.query.query as string;
  const lat = parseFloat(req.query.lat as string) || 0;
  const lng = parseFloat(req.query.lng as string) || 0;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  const apiKey = getSerpApiKey();
  if (!apiKey) {
    return res.json({ restaurants: [], attractions: [] });
  }

  try {
    // Search for restaurants
    const restaurantParams = new URLSearchParams({
      engine: "google_maps",
      q: `nhà hàng quán ăn gần ${query}`,
      hl: "vi",
      type: "search",
      api_key: apiKey,
    });
    if (lat && lng) {
      restaurantParams.set("ll", `@${lat},${lng},14z`);
    }

    // Search for attractions
    const attractionParams = new URLSearchParams({
      engine: "google_maps",
      q: `điểm tham quan du lịch gần ${query}`,
      hl: "vi",
      type: "search",
      api_key: apiKey,
    });
    if (lat && lng) {
      attractionParams.set("ll", `@${lat},${lng},14z`);
    }

    console.log(`[AutoDiscover] Searching POIs near "${query}"...`);

    const [restRes, attrRes] = await Promise.all([
      fetch(`${SERPAPI_BASE}?${restaurantParams.toString()}`),
      fetch(`${SERPAPI_BASE}?${attractionParams.toString()}`),
    ]);

    const mapResult = (r: any, type: string) => ({
      name: r.title || "",
      type,
      address: r.address || "",
      latitude: r.gps_coordinates?.latitude || 0,
      longitude: r.gps_coordinates?.longitude || 0,
      rating: r.rating || 0,
      reviewCount: r.reviews || 0,
      estimatedCost: r.price ? parseInt(r.price.replace(/[^0-9]/g, "")) || 0 : 0,
      description: r.description || r.type || "",
      googlePlaceId: r.place_id || "",
      thumbnail: r.thumbnail || "",
      // r.hours from local_results (search) is a status string like "Open ⋅ Closes 10 PM"
      // Use operating_hours if available for real schedule data
      openHours: r.operating_hours
        ? Object.entries(r.operating_hours).map(([day, hours]) => `${day}: ${hours}`).join(" | ")
        : (typeof r.hours === "string" ? r.hours : ""),
    });

    let restaurants: any[] = [];
    let attractions: any[] = [];

    if (restRes.ok) {
      const restData = await restRes.json();
      restaurants = (restData.local_results || [])
        .filter((r: any) => r.gps_coordinates?.latitude && r.gps_coordinates?.longitude)
        .slice(0, 10)
        .map((r: any) => mapResult(r, "restaurant"));
    }

    if (attrRes.ok) {
      const attrData = await attrRes.json();
      attractions = (attrData.local_results || [])
        .filter((r: any) => r.gps_coordinates?.latitude && r.gps_coordinates?.longitude)
        .slice(0, 10)
        .map((r: any) => mapResult(r, "attraction"));
    }

    // Sort by rating
    restaurants.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    attractions.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));

    console.log(`[AutoDiscover] Found ${restaurants.length} restaurants, ${attractions.length} attractions near "${query}"`);

    return res.json({ restaurants, attractions });
  } catch (error) {
    console.warn("[AutoDiscover] Error:", error);
    return res.json({ restaurants: [], attractions: [] });
  }
}


export async function registerRoutes(app: Express): Promise<Server> {
  // Log active provider on startup
  const provider = getActiveProvider();
  console.log(`\n🗺️  Map Provider: ${provider.toUpperCase()}`);
  console.log(`   🔑 SerpAPI: ${getSerpApiKey() ? "✅ configured (PRIMARY)" : "❌ not configured"}`);
  console.log(`   Google: ${getGoogleKey() ? "✅ configured (fallback)" : "❌ not configured"}`);
  console.log(`   Goong:  ${getGoongKey() ? "✅ configured (fallback)" : "❌ not configured"}`);
  console.log(`   Free:   ✅ always available (Nominatim + OSRM)\n`);
  console.log(`   💾 Database: PostgreSQL (Drizzle ORM)\n`);

  // Provider status
  app.get("/api/places/provider", getProviderStatus);

  // Places search routes (SerpAPI → Google → Goong → Nominatim)
  app.get("/api/places/search", searchPlaces);
  app.get("/api/places/details/:placeId", getPlaceDetails);
  app.get("/api/places/photo", getPlacePhoto);

  // SerpAPI HD Photos by data_id
  app.get("/api/places/serp-photos/:dataId", getSerpPhotos);

  // Geocode & directions (with fallback)
  app.get("/api/places/geocode", geocodeAddress);
  app.get("/api/places/directions", getDirections);

  // SerpAPI Reviews
  app.get("/api/places/reviews", getPlaceReviewsSerpApi);

  // Auto-discover nearby POIs
  app.get("/api/places/auto-discover", autoDiscoverPOIs);

  // AI Itinerary generation
  app.post("/api/generate-itinerary", generateItineraryAI);

  // Share trip routes
  app.post("/api/share", shareTrip);
  app.get("/api/share/:code", getSharedTrip);
  app.post("/api/share/join", joinSharedTrip);
  app.patch("/api/share/companion", updateCompanionRole);
  app.delete("/api/share/companion", removeCompanion);

  // ══════════════════════════════════════════════════════════════
  // CRUD: Users
  // ══════════════════════════════════════════════════════════════
  app.get("/api/users", async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    const user = await storage.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.delete("/api/users/:id", async (req, res) => {
    const ok = await storage.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true });
  });

  // Login / Register
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.isLocked) {
      return res.status(403).json({ error: "Account is locked" });
    }
    res.json(user);
  });

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, email, fullName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }
    try {
      const user = await storage.createUser({ username, password });
      // Update extra fields if provided
      if (email || fullName) {
        const updated = await storage.updateUser(user.id, { email, fullName });
        return res.status(201).json(updated || user);
      }
      res.status(201).json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // CRUD: Destinations
  // ══════════════════════════════════════════════════════════════
  app.get("/api/destinations", async (_req, res) => {
    const destinations = await storage.getDestinations();
    res.json(destinations);
  });

  app.get("/api/destinations/:id", async (req, res) => {
    const dest = await storage.getDestination(req.params.id);
    if (!dest) return res.status(404).json({ error: "Destination not found" });
    res.json(dest);
  });

  app.post("/api/destinations", async (req, res) => {
    try {
      const dest = await storage.createDestination(req.body);
      res.status(201).json(dest);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/destinations/:id", async (req, res) => {
    const dest = await storage.updateDestination(req.params.id, req.body);
    if (!dest) return res.status(404).json({ error: "Destination not found" });
    res.json(dest);
  });

  app.delete("/api/destinations/:id", async (req, res) => {
    const ok = await storage.deleteDestination(req.params.id);
    if (!ok) return res.status(404).json({ error: "Destination not found" });
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════════════════════
  // CRUD: Itineraries
  // ══════════════════════════════════════════════════════════════
  app.get("/api/itineraries", async (req, res) => {
    const userId = req.query.userId as string;
    if (userId) {
      const items = await storage.getItinerariesByUser(userId);
      return res.json(items);
    }
    const items = await storage.getItineraries();
    res.json(items);
  });

  app.get("/api/itineraries/:id", async (req, res) => {
    const itin = await storage.getItinerary(req.params.id);
    if (!itin) return res.status(404).json({ error: "Itinerary not found" });
    res.json(itin);
  });

  app.post("/api/itineraries", async (req, res) => {
    try {
      const itin = await storage.createItinerary(req.body);

      // Extract and save POIs from itinerary activities
      if (req.body.days && Array.isArray(req.body.days)) {
        extractAndSavePOIsFromItinerary(req.body.days).catch((err) =>
          console.warn("[POI-Save] Background POI extraction failed:", err)
        );
      }

      res.status(201).json(itin);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/itineraries/:id", async (req, res) => {
    const itin = await storage.updateItinerary(req.params.id, req.body);
    if (!itin) return res.status(404).json({ error: "Itinerary not found" });

    // Extract and save POIs from updated itinerary activities
    if (req.body.days && Array.isArray(req.body.days)) {
      extractAndSavePOIsFromItinerary(req.body.days).catch((err) =>
        console.warn("[POI-Save] Background POI extraction failed:", err)
      );
    }

    res.json(itin);
  });

  app.delete("/api/itineraries/:id", async (req, res) => {
    const ok = await storage.deleteItinerary(req.params.id);
    if (!ok) return res.status(404).json({ error: "Itinerary not found" });
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════════════════════
  // CRUD: Reviews
  // ══════════════════════════════════════════════════════════════
  app.get("/api/reviews", async (req, res) => {
    const userId = req.query.userId as string;
    const destinationId = req.query.destinationId as string;
    const poiId = req.query.poiId as string;
    if (userId) {
      const items = await storage.getReviewsByUser(userId);
      return res.json(items);
    }
    if (poiId) {
      const items = await storage.getReviewsByPoi(poiId);
      return res.json(items);
    }
    if (destinationId) {
      const items = await storage.getReviewsByDestination(destinationId);
      return res.json(items);
    }
    const items = await storage.getReviews();
    res.json(items);
  });

  app.get("/api/reviews/:id", async (req, res) => {
    const review = await storage.getReview(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const review = await storage.createReview(req.body);
      res.status(201).json(review);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/reviews/:id", async (req, res) => {
    const review = await storage.updateReview(req.params.id, req.body);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    const ok = await storage.deleteReview(req.params.id);
    if (!ok) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════════════════════
  // CRUD: Notifications
  // ══════════════════════════════════════════════════════════════
  app.get("/api/notifications", async (req, res) => {
    const userId = req.query.userId as string;
    if (userId) {
      const items = await storage.getNotificationsByUser(userId);
      return res.json(items);
    }
    const items = await storage.getNotifications();
    res.json(items);
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notif = await storage.createNotification(req.body);
      res.status(201).json(notif);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/notifications/:id", async (req, res) => {
    const notif = await storage.updateNotification(req.params.id, req.body);
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    res.json(notif);
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const ok = await storage.deleteNotification(req.params.id);
    if (!ok) return res.status(404).json({ error: "Notification not found" });
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════════════════════
  // CRUD: POIs
  // ══════════════════════════════════════════════════════════════
  app.get("/api/pois", async (req, res) => {
    const destinationId = req.query.destinationId as string;
    if (destinationId) {
      const items = await storage.getPoisByDestination(destinationId);
      return res.json(items);
    }
    const items = await storage.getPois();
    res.json(items);
  });

  app.get("/api/pois/:id", async (req, res) => {
    const poi = await storage.getPoi(req.params.id);
    if (!poi) return res.status(404).json({ error: "POI not found" });
    res.json(poi);
  });

  app.post("/api/pois", async (req, res) => {
    try {
      const poi = await storage.createPoi(req.body);
      res.status(201).json(poi);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/pois/:id", async (req, res) => {
    const poi = await storage.updatePoi(req.params.id, req.body);
    if (!poi) return res.status(404).json({ error: "POI not found" });
    res.json(poi);
  });

  app.delete("/api/pois/:id", async (req, res) => {
    const ok = await storage.deletePoi(req.params.id);
    if (!ok) return res.status(404).json({ error: "POI not found" });
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
