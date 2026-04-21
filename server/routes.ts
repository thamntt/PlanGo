import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { asyncHandler, sendResponse, AppError } from "./utils";

// ══════════════════════════════════════════════════════════════
// API Base URLs
// ══════════════════════════════════════════════════════════════

// Google Maps Platform APIs
const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_DIRECTIONS_BASE =
  "https://maps.googleapis.com/maps/api/directions/json";

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
  const key = process.env.SERPAPI_KEY || "";
  console.log(
    `[Debug] Using SerpAPI Key: ${key.slice(0, 5)}...${key.slice(-5)}`,
  );
  return key;
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

// Ensure dates sent as DD-MM-YYYY are correctly converted to YYYY-MM-DD for PostgreSQL
function parseDateStringToISO(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  // Match DD-MM-YYYY or DD/MM/YYYY
  const match = dateStr.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// Clean up formatted currency strings (e.g. "4.566.767 ₫") to plain numeric strings
function parseCurrencyToNumeric(val: any): string | number | undefined {
  if (typeof val === "string") {
    // Return empty string if no digits found, otherwise return the digits
    const cleaned = val.replace(/[^0-9]/g, "");
    if (cleaned === "") return undefined;
    return cleaned;
  }
  return val;
}

/**
 * Centralized mapping from Drizzle's relational structure to the frontend's expected schema.
 * - flattens trip.destination.name to trip.destination
 * - maps trip.days[].dayIndex to trip.days[].day
 * - maps trip.days[].items[] to trip.days[].activities[]
 */
function mapTripToFrontend(trip: any) {
  if (!trip) return trip;
  const mapped = { ...trip };

  if (mapped.destination && mapped.destination.name) {
    mapped.destination = mapped.destination.name;
  }

  // Map sharing fields
  mapped.shareCode = mapped.invitationToken;
  mapped.sharePermission = mapped.sharePermission || "viewer";
  mapped.isShared = !!mapped.invitationToken;

  // Resolve owner details for frontend expectations
  if (mapped.ownerId) {
    mapped.userId = mapped.ownerId.toString();
  }
  if (mapped.owner) {
    mapped.ownerName = mapped.owner.fullName || mapped.owner.userName;
  }

  if (mapped.expenses && Array.isArray(mapped.expenses)) {
    mapped.expenses = mapped.expenses.map((e: any) => ({
      ...e,
      id: (e.expenseId || "").toString(),
      title: e.description || e.title || "",
      amount: Number(e.amount || 0),
      date: e.expenseDate || e.date || "",
      category: e.expenseType ? e.expenseType.name : "Khác",
      payer: e.paidByInfo
        ? e.paidByInfo.fullName || e.paidByInfo.userName
        : "Không rõ",
      paidByUserId: e.paidByInfo ? e.paidByInfo.userId.toString() : undefined,
      splitType: e.splitMethod || "none",
      activityId: e.itemId ? e.itemId.toString() : undefined,
      splits: e.splits
        ? e.splits.map((s: any) => ({
          userId: s.userId?.toString() || "",
          userName: s.user ? s.user.fullName || s.user.userName : "",
          amount: Number(s.amount || 0),
        }))
        : [],
    }));
  }

  if (mapped.members && Array.isArray(mapped.members)) {
    mapped.companions = mapped.members.map((m: any) => ({
      userId: (m.userId || "").toString(),
      userName: m.user ? m.user.fullName || m.user.userName : "",
      role: m.role || "member",
    }));

    // Prepend owner if not already in companions list
    if (mapped.owner) {
      const ownerIdStr = mapped.owner.userId.toString();
      const isOwnerInCompanions = mapped.companions.some((c: any) => c.userId === ownerIdStr);
      if (!isOwnerInCompanions) {
        mapped.companions.unshift({
          userId: ownerIdStr,
          userName: mapped.owner.fullName || mapped.owner.userName,
          role: "owner",
          isOwner: true,
        });
      } else {
        // Mark existing owner entry
        mapped.companions = mapped.companions.map((c: any) =>
          c.userId === ownerIdStr ? { ...c, isOwner: true, role: "owner" } : c
        );
      }
    }
  } else if (mapped.owner) {
    // Only owner exists
    mapped.companions = [{
      userId: mapped.owner.userId.toString(),
      userName: mapped.owner.fullName || mapped.owner.userName,
      role: "owner",
      isOwner: true,
    }];
  }

  if (mapped.expenses && Array.isArray(mapped.expenses)) {
    const typeInverseMap: Record<string, string> = {
      "Di chuyển": "transport",
      "Mua sắm": "shopping",
      "Ăn uống": "food",
      "Tham quan": "sightseeing",
      Khác: "other",
    };

    mapped.expenses = mapped.expenses.map((e: any) => {
      const payerName = e.paidByInfo
        ? e.paidByInfo.fullName || e.paidByInfo.userName
        : e.payer || "Không rõ";
      const rawType = e.expenseType ? e.expenseType.name : "Khác";
      return {
        ...e,
        id: (e.expenseId || "").toString(),
        title: e.description || e.title || "",
        amount: Number(e.amount || 0),
        date: e.expenseDate || e.date || "",
        type: typeInverseMap[rawType] || "other",
        payer: payerName,
        paidBy: payerName, // Use name uniformly to fix dashboard duplicates (e.g. "test" vs "5")
        paidByUserId: e.paidByInfo
          ? e.paidByInfo.userId.toString()
          : e.paidBy?.toString(),
        splitType: e.splitMethod || "none",
        activityId: e.itemId ? e.itemId.toString() : undefined,
        splits: e.splits
          ? e.splits.map((s: any) => {
            let uName = s.user ? s.user.fullName || s.user.userName : "";
            if (!uName && mapped.companions) {
              const comp = mapped.companions.find(
                (c: any) => c.userId === s.userId?.toString(),
              );
              if (comp) uName = comp.userName;
            }
            return {
              userId: s.userId?.toString() || "",
              userName: uName,
              amount: Number(s.amount || 0),
            };
          })
          : [],
      };
    });
  }

  // Map activities and link them with expenses for payer info
  const activitiesWithExpenses = new Map<string, any>();
  if (mapped.expenses) {
    mapped.expenses.forEach((e: any) => {
      if (e.activityId) {
        activitiesWithExpenses.set(e.activityId, e);
      }
    });
  }

  let totalActivityCost = 0;
  if (mapped.days && Array.isArray(mapped.days)) {
    // Sort days by dayIndex to ensure chronological order
    const sortedDays = [...mapped.days].sort(
      (a, b) => (a.dayIndex || 0) - (b.dayIndex || 0),
    );

    mapped.days = sortedDays.map((day: any) => ({
      ...day,
      day: day.dayIndex,
      activities: day.items
        ? [...day.items]
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
          .map((item: any) => {
            const itemIdStr = item.itemId.toString();
            const linkedExp = activitiesWithExpenses.get(itemIdStr);
            const actualCost = item.actualCost ? Number(item.actualCost) : 0;
            totalActivityCost += actualCost;

            // Merge POI data into activity so display matches preview
            const poi = item.poi;
            return {
              ...item,
              id: item.itemId,
              title: item.customName,
              time: item.startTime,
              // description comes from POI (static place info), note is user-added per trip
              description: poi ? poi.description : undefined,
              note: item.note || undefined,
              // For backwards compat: notes array if note exists
              notes: item.note ? [item.note] : undefined,
              estimatedCost: item.estimatedCost
                ? Number(item.estimatedCost)
                : poi?.estimatedCost
                  ? Number(poi.estimatedCost)
                  : 0,
              actualCost,
              paidBy: linkedExp ? linkedExp.payer : undefined,
              paidByUserId: linkedExp ? linkedExp.paidByUserId : undefined,
              isCompleted: item.status === "completed",
              expenseTypeId: item.expenseTypeId,
              // Use specific place_type if available (legacy support) or the activityType column content
              activityType: (item as any).placeType || item.activityType,
              // POI-enriched fields — only override if itinerary_items doesn't have them
              address: item.address || (poi ? poi.address : undefined),
              latitude: item.latitude
                ? Number(item.latitude)
                : poi?.latitude
                  ? Number(poi.latitude)
                  : undefined,
              longitude: item.longitude
                ? Number(item.longitude)
                : poi?.longitude
                  ? Number(poi.longitude)
                  : undefined,
              rating: item.rating
                ? Number(item.rating)
                : poi?.rating
                  ? Number(poi.rating)
                  : undefined,
              reviewCount: item.reviewCount || poi?.reviewCounts,
              googlePlaceId:
                item.googlePlaceId || (poi ? poi.googlePlaceId : undefined),
              poiId: item.poiId,
            };
          })
        : [],
    }));
  }

  if (mapped.budget) {
    mapped.budget = Number(mapped.budget).toString();
    mapped.totalBudget = Number(mapped.budget);
  }

  // Calculate spentAmount: Only sum activities + expenses that are NOT linked to activities (to avoid double counting)
  const manualExpensesAmount = mapped.expenses
    ? mapped.expenses
      .filter((e: any) => !e.activityId)
      .reduce((sum: number, e: any) => sum + e.amount, 0)
    : 0;
  mapped.spentAmount = totalActivityCost + manualExpensesAmount;

  // Ensure id is present and stringified for frontend
  mapped.id = (trip.tripId || "").toString();
  mapped.destinationId = (trip.destinationId || "").toString();

  return mapped;
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
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryType,places.primaryTypeDisplayName,places.editorialSummary,places.photos",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: language,
        maxResultCount: 10,
      }),
    });

    if (!response.ok) {
      console.warn(
        `[Google] Search failed (${response.status}), trying fallback...`,
      );
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
        attributions: (p.authorAttributions || []).map(
          (a: any) => a.displayName || "Google",
        ),
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
      console.warn(
        `[Goong] Search failed (${response.status}), trying fallback...`,
      );
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
      }),
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
    const extractPhotos = (
      r: any,
    ): { name: string; attributions: string[] }[] => {
      const photos: { name: string; attributions: string[] }[] = [];
      if (r.thumbnail) {
        photos.push({ name: r.thumbnail, attributions: ["Google Maps"] });
      }
      if (r.images && Array.isArray(r.images)) {
        r.images.slice(0, 4).forEach((img: any) => {
          const imgUrl =
            typeof img === "string" ? img : img?.thumbnail || img?.image;
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
        types:
          typeof r.type === "string"
            ? [r.type.toLowerCase().replace(/\s+/g, "_")]
            : [],
        primaryType:
          typeof r.type === "string"
            ? r.type.toLowerCase().replace(/\s+/g, "_")
            : "other",
        primaryTypeDisplay:
          (typeof r.type === "string" ? r.type : null) || "Địa điểm",
        editorialSummary: r.description || "",
        photos: extractPhotos(r),
        website: r.website || "",
        phone: r.phone || "",
        openNow:
          r.open_state === "Open"
            ? true
            : r.open_state === "Closed"
              ? false
              : null,
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
          const photoRes = await fetch(
            `${SERPAPI_BASE}?${photoParams.toString()}`,
          );
          if (photoRes.ok) {
            const photoData = await photoRes.json();
            (photoData.photos || []).slice(0, 5).forEach((p: any) => {
              const imgUrl = p.image || p.thumbnail;
              if (imgUrl)
                photos.push({ name: imgUrl, attributions: ["Google Maps"] });
            });
            console.log(
              `[SerpAPI] 📸 Got ${photos.length} photos for city "${r.title}" via google_maps_photos`,
            );
          }
        } catch {
          /* photos are optional */
        }
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
                photos.push({
                  name: img.original,
                  attributions: ["Google Images"],
                });
              } else if (img.thumbnail) {
                photos.push({
                  name: img.thumbnail,
                  attributions: ["Google Images"],
                });
              }
            });
            console.log(
              `[SerpAPI] 🖼️ Got ${photos.length} photos for "${r.title}" via google_images`,
            );
          }
        } catch {
          /* image search is optional */
        }
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
        types:
          typeof r.type === "string"
            ? [r.type.toLowerCase().replace(/\s+/g, "_")]
            : [],
        primaryType:
          typeof r.type === "string"
            ? r.type.toLowerCase().replace(/\s+/g, "_")
            : "other",
        primaryTypeDisplay:
          (typeof r.type === "string" ? r.type : null) || "Địa điểm",
        editorialSummary: r.description || r.extensions?.join(", ") || "",
        photos,
        website: r.website || "",
        phone: r.phone || "",
        openNow: null,
      });
      console.log(
        `[SerpAPI] ✅ Search "${query}" → found city/region result from place_results (${photos.length} photos)`,
      );
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
    console.log(
      `[SerpAPI] 🔍 Fetching place details for place_id: "${placeId}"`,
    );
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[SerpAPI] Place details failed (${response.status})`);
      return null;
    }

    const data = await response.json();

    // type=place returns place_results (single object), not local_results (array)
    const r = data.place_results;
    if (!r) {
      console.warn(
        `[SerpAPI] No place_results found for place_id: "${placeId}"`,
      );
      return null;
    }

    // Collect photos from place_results
    const photos: { name: string; attributions: string[] }[] = [];
    if (r.thumbnail) {
      photos.push({ name: r.thumbnail, attributions: ["Google Maps"] });
    }
    if (r.images && Array.isArray(r.images)) {
      r.images.slice(0, 4).forEach((img: any) => {
        const imgUrl =
          typeof img === "string" ? img : img?.thumbnail || img?.image;
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
          console.log(
            `[SerpAPI] 📸 Got ${hdPhotos.length} HD photos for "${r.title}"`,
          );
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
              photos.push({
                name: img.original,
                attributions: ["Google Images"],
              });
            } else if (img.thumbnail) {
              photos.push({
                name: img.thumbnail,
                attributions: ["Google Images"],
              });
            }
          });
          console.log(
            `[SerpAPI] 🖼️ Got ${photos.length} fallback photos for "${r.title}" via google_images`,
          );
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
      types:
        typeof r.type === "string"
          ? [r.type.toLowerCase().replace(/\s+/g, "_")]
          : [],
      primaryType:
        typeof r.type === "string"
          ? r.type.toLowerCase().replace(/\s+/g, "_")
          : "other",
      primaryTypeDisplay:
        (typeof r.type === "string" ? r.type : null) || "Địa điểm",
      editorialSummary: r.description || r.extensions?.join(", ") || "",
      website: r.website || "",
      phone: r.phone || "",
      priceLevel: r.price ? r.price.length : null,
      photos: photos.slice(0, 5),
      reviews,
      openingHours,
      openNow:
        r.open_state === "Open"
          ? true
          : r.open_state === "Closed"
            ? false
            : null,
    };

    console.log(
      `[SerpAPI] ✅ Place details for "${result.name}" — ★${result.rating} (${result.reviewCount} reviews), ${photos.length} photos`,
    );
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
    throw new AppError(400, "dataId parameter is required");
  }

  const apiKey = getSerpApiKey();
  if (!apiKey) {
    throw new AppError(501, "SERPAPI_KEY not configured");
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
      return res
        .status(response.status)
        .json({ error: "SerpAPI photos request failed" });
    }

    const data = await response.json();
    const photos = (data.photos || []).map((p: any) => ({
      thumbnail: p.thumbnail || "",
      image: p.image || p.thumbnail || "",
    }));

    console.log(
      `[SerpAPI] ✅ Got ${photos.length} photos for data_id=${dataId}`,
    );
    return res.json({ photos });
  } catch (error) {
    console.error("[SerpAPI] Photos error:", error);
    throw new AppError(500, "Failed to fetch photos");
  }
}

// Helper: enrich Goong/Nominatim results with SerpAPI rating data
async function enrichWithSerpApiRatings(
  places: any[],
  query: string,
): Promise<any[]> {
  const hasZeroRating = places.some((p: any) => p.rating === 0);
  if (!hasZeroRating || places.length === 0) return places;

  const serpResult = await searchPlacesSerpApi(query);
  if (!serpResult || !serpResult.places || serpResult.places.length === 0)
    return places;

  const serpPlaces = serpResult.places;

  // Match by normalized name similarity
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]/gi, "");

  return places.map((place: any) => {
    if (place.rating > 0) return place; // already has rating
    const normName = normalize(place.name);
    // Find best match in SerpAPI results
    const match = serpPlaces.find((sp: any) => {
      const spNorm = normalize(sp.name);
      return (
        spNorm.includes(normName) ||
        normName.includes(spNorm) ||
        spNorm === normName
      );
    });
    if (match) {
      return {
        ...place,
        rating: match.rating || place.rating,
        reviewCount: match.reviewCount || place.reviewCount,
        // Also save the Google Place ID for future SerpAPI reviews lookup
        placeId: match.placeId || place.placeId,
        primaryTypeDisplay:
          match.primaryTypeDisplay !== "Địa điểm"
            ? match.primaryTypeDisplay
            : place.primaryTypeDisplay,
      };
    }
    return place;
  });
}

async function searchPlaces(req: Request, res: Response) {
  const query = req.query.query as string;
  const language = (req.query.language as string) || "vi";

  if (!query) {
    throw new AppError(400, "Query parameter is required");
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
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,rating,userRatingCount,types,primaryType,primaryTypeDisplayName,editorialSummary,photos,websiteUri,nationalPhoneNumber,priceLevel,reviews,regularOpeningHours,currentOpeningHours",
        "Accept-Language": language,
      },
    });

    if (!response.ok) {
      console.warn(
        `[Google] Details failed (${response.status}), trying fallback...`,
      );
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
      priceLevel: place.priceLevel
        ? (priceLevelMap[place.priceLevel] ?? null)
        : null,
      photos: (place.photos || []).slice(0, 5).map((p: any) => ({
        name: p.name || "",
        attributions: (p.authorAttributions || []).map(
          (a: any) => a.displayName || "Google",
        ),
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
      console.warn(
        `[Goong] Details failed (${response.status}), trying fallback...`,
      );
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
        attributions: p.html_attributions || [],
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
    throw new AppError(400, "placeId parameter is required");
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

  throw new AppError(404, "Place not found");
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
    throw new AppError(400, "address parameter is required");
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

async function directionsGoogle(
  origin: string,
  destination: string,
  vehicle: string,
) {
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

async function directionsGoong(
  origin: string,
  destination: string,
  vehicle: string,
) {
  const apiKey = getGoongKey();
  if (!apiKey) return null;

  try {
    const goongVehicle = vehicle === "walking" ? "bike" : vehicle || "car";
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
      routes: [
        {
          legs: route.legs.map((leg: any) => ({
            distance: {
              text: `${(leg.distance / 1000).toFixed(1)} km`,
              value: leg.distance,
            },
            duration: {
              text: `${Math.round(leg.duration / 60)} phút`,
              value: leg.duration,
            },
            steps: (leg.steps || []).map((step: any) => ({
              distance: {
                text: `${Math.round(step.distance)} m`,
                value: step.distance,
              },
              duration: {
                text: `${Math.round(step.duration / 60)} phút`,
                value: step.duration,
              },
              html_instructions: step.name || "",
              maneuver: { location: step.maneuver?.location },
            })),
          })),
          overview_polyline: {
            points: "", // OSRM uses GeoJSON, not encoded polyline
          },
        },
      ],
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
    return res
      .status(400)
      .json({ error: "origin and destination are required" });
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
    return res
      .status(400)
      .json({ error: "Photo name or data_id parameter is required" });
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
                console.log(
                  `[SerpAPI] 📸 Serving HD photo from data_id=${dataId}`,
                );
                return res.redirect(hdUrl);
              }
            }
          }
        } catch {
          console.warn(
            `[SerpAPI] HD photo fetch failed for data_id=${dataId}, trying fallbacks...`,
          );
        }
      }
    }

    // Priority 2: Google Places photo (if it's a Google resource name)
    const googleKey = getGoogleKey();
    if (photoName && googleKey && photoName.startsWith("places/")) {
      const url = `${GOOGLE_PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${googleKey}`;
      const response = await fetch(url, { redirect: "follow" });

      if (response.ok) {
        const contentType =
          response.headers.get("content-type") || "image/jpeg";
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
      return res
        .status(response.status)
        .json({ error: "Failed to fetch photo" });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Place photo error:", error);
    throw new AppError(500, "Failed to fetch photo");
  }
}

// ══════════════════════════════════════════════════════════════
// Internal geocode helper — Google → Goong → Nominatim
// Used by generate-itinerary to get accurate coordinates
// ══════════════════════════════════════════════════════════════

async function internalGeocode(
  address: string,
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
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
  const tripId =
    req.body.tripId ||
    req.query.tripId ||
    req.body.id ||
    req.query.id ||
    req.body.itinerary?.id;

  if (!tripId) {
    throw new AppError(400, "tripId is required");
  }

  // Use frontend's shareCode if provided, otherwise robust fallback
  const token =
    req.body.shareCode ||
    Math.random().toString(36).substring(2, 9).toUpperCase();

  const trip = await storage.updateTrip(Number(tripId), {
    invitationToken: token,
    sharePermission: req.body.sharePermission || req.body.itinerary?.sharePermission || req.body.role || req.query.role || "viewer",
  });
  sendResponse(res, 200, "Trip shared", {
    shareCode: token,
    sharePermission: trip?.sharePermission || "viewer"
  });
}

// GET /api/share/:code — look up a shared trip
async function getSharedTrip(req: Request, res: Response) {
  const code = req.params.code as string;
  const trip = await storage.getTripByInvitationToken(code);
  if (!trip) throw new AppError(404, "Share code not found");

  // Return mapped standard trip
  sendResponse(res, 200, "Trip found", mapTripToFrontend(trip));
}

// POST /api/share/join — join a shared trip (update companions)
async function joinSharedTrip(req: Request, res: Response) {
  const shareCode = req.body.shareCode || req.query.shareCode;
  const userId =
    req.body.userId || req.query.userId || req.body.companion?.userId;
  if (!shareCode || !userId)
    throw new AppError(400, "shareCode and userId are required");

  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError(404, "Share code not found");

  const role =
    req.body.role || req.query.role || req.body.companion?.role || trip.sharePermission || "viewer";

  const members = await storage.getTripMembers(trip.tripId);
  if (members.some((m) => m.userId === Number(userId))) {
    return sendResponse(res, 200, "Already joined", {
      alreadyJoined: true,
      trip: mapTripToFrontend(trip),
    });
  }

  await storage.addTripMember({
    tripId: trip.tripId,
    userId: Number(userId),
    role: role as string,
  });

  // Re-fetch trip to include the new member
  const updatedTrip = await storage.getTripByInvitationToken(shareCode);
  sendResponse(res, 200, "Joined trip", {
    alreadyJoined: false,
    trip: mapTripToFrontend(updatedTrip),
  });
}

// PATCH /api/share/companion — update a companion's role
async function updateCompanionRole(req: Request, res: Response) {
  const shareCode = req.body.shareCode || req.query.shareCode;
  const userId = req.body.userId || req.query.userId;
  const role = req.body.role || req.query.role;

  if (!shareCode || !userId || !role)
    throw new AppError(400, "shareCode, userId, and role are required");

  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError(404, "Share code not found");

  await storage.updateTripMember(trip.tripId, Number(userId), { role });
  sendResponse(res, 200, "Success", null);
}

// DELETE /api/share/companion — remove a companion
async function removeCompanion(req: Request, res: Response) {
  const shareCode = req.body.shareCode || req.query.shareCode;
  const userId = req.body.userId || req.query.userId;

  if (!shareCode || !userId)
    throw new AppError(400, "shareCode and userId are required");

  const trip = await storage.getTripByInvitationToken(shareCode);
  if (!trip) throw new AppError(404, "Share code not found");

  await storage.removeTripMember(trip.tripId, Number(userId));
  sendResponse(res, 200, "Success", null);
}

// ══════════════════════════════════════════════════════════════
// Helper: strip Vietnamese activity prefixes to get actual place name
// ══════════════════════════════════════════════════════════════
function extractPlaceName(title: string): string {
  return title
    .replace(
      /^(Ăn sáng|Ăn trưa|Ăn tối|Ăn chiều|Nghỉ trưa|Nghỉ đêm|Nghỉ ngơi|Check-in|Check-out|Tham quan|Khám phá|Trải nghiệm|Dạo chơi|Đi bộ|Di chuyển|Mua sắm|Thưởng thức|Ghé thăm|Uống cà phê|Cà phê|Cafe)\s*(tại|ở|đến|quanh|trong|trên|vào|lúc)?\s*/i,
      "",
    )
    .trim();
}

// ══════════════════════════════════════════════════════════════
// Helper: Map AI activity type to database expense type ID
// ══════════════════════════════════════════════════════════════
function mapActivityTypeToExpenseId(type?: string): number | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("food")) return 1; // Ăn uống
  if (t.includes("transport") || t.includes("travel")) return 2; // Di chuyển
  if (t.includes("hotel") || t.includes("accommodation")) return 3; // Khách sạn
  if (t.includes("sightseeing") || t.includes("attraction")) return 4; // Tham quan
  if (t.includes("shopping")) return 5; // Mua sắm
  return 6; // Khác
}

function mapExpenseIdToActivityType(id?: number | null): string | null {
  if (!id) return null;
  const map: Record<number, string> = {
    1: "food",
    2: "transport",
    3: "hotel",
    4: "sightseeing",
    5: "shopping",
    6: "other",
  };
  return map[id] || "other";
}

// ══════════════════════════════════════════════════════════════
// Preference Association Helpers
// ══════════════════════════════════════════════════════════════

/**
 * Maps AI activity type and content to specific localized preferences.
 */
function mapToPreferenceNames(type?: string, title?: string, description?: string): string[] {
  const prefs: string[] = [];
  const t = (type || "").toLowerCase();
  const text = ((title || "") + " " + (description || "")).toLowerCase();

  // Basic type mapping
  if (t.includes("food")) prefs.push("Ẩm thực");
  if (t.includes("shopping")) prefs.push("Mua sắm");
  if (t.includes("hotel") || t.includes("accommodation")) prefs.push("Nghỉ dưỡng");

  // Content-based mapping
  if (text.match(/biển|vịnh|đảo|bãi tắm|mỹ khê|hạ long|phú quốc|nha trang/)) prefs.push("Biển");
  if (text.match(/núi|đỉnh|fansipan|đèo|ba na hills|cao nguyên/)) prefs.push("Núi");
  if (text.match(/chùa|thờ|văn hóa|di tích|lăng|cung điện|bảo tàng|hội an|kinh thành|đại nội/)) {
    prefs.push("Văn hóa");
    prefs.push("Lịch sử");
  }
  if (text.match(/mạo hiểm|trekking|leo núi|zipline|kayak|thời thách/)) prefs.push("Phiêu lưu");
  if (text.match(/thiên nhiên|rừng|thác|hồ|suối|vườn quốc gia/)) prefs.push("Thiên nhiên");
  if (text.match(/đêm|bar|pub|phố đi bộ|sôi động|rực rỡ/)) prefs.push("Giải trí đêm");
  if (text.match(/chụp|ảnh|check-in|sống ảo|đẹp|toàn cảnh/)) prefs.push("Nhiếp ảnh");

  // Fallback for sightseeing
  if (t.includes("sightseeing") && prefs.length === 0) {
    prefs.push("Văn hóa");
    prefs.push("Thành phố");
  }

  return [...new Set(prefs)]; // Unique values
}

async function associatePreferencesToPoi(poiId: number, type?: string, title?: string, description?: string) {
  try {
    const prefNames = mapToPreferenceNames(type, title, description);
    if (prefNames.length === 0) return;

    console.log(`[POI-Pref] Associating ${prefNames.join(", ")} with POI ${poiId}`);

    // Clear existing to avoid duplicates if re-processing
    await storage.clearPoiPreferences(poiId);

    for (const name of prefNames) {
      const pref = await storage.getPreferenceByName(name);
      if (pref) {
        await storage.addPoiPreference({ poiId, preferenceId: pref.preferenceId });
      }
    }
  } catch (err) {
    console.error(`[POI-Pref] Failed to associate preferences for POI ${poiId}:`, err);
  }
}

async function associatePreferencesToTrip(tripId: number, prefNames: string[]) {
  if (!prefNames || prefNames.length === 0) return;
  try {
    console.log(`[Trip-Pref] Associating ${prefNames.join(", ")} with Trip ${tripId}`);

    // Clear existing
    await storage.clearTripPreferences(tripId);

    for (const name of prefNames) {
      const pref = await storage.getPreferenceByName(name);
      if (pref) {
        await storage.addTripPreference({ tripId, preferenceId: pref.preferenceId });
      }
    }
  } catch (err) {
    console.error(`[Trip-Pref] Failed to associate preferences for Trip ${tripId}:`, err);
  }
}

// ══════════════════════════════════════════════════════════════
// Helper: Extract activities from itinerary days and save as POIs
// ══════════════════════════════════════════════════════════════
async function extractAndSavePOIsFromItinerary(
  days: any[],
  destinationId?: number | null,
): Promise<number> {
  if (!days || !Array.isArray(days) || days.length === 0) return 0;

  let savedCount = 0;
  const allActivities: any[] = [];

  for (const day of days) {
    if (!day.activities || !Array.isArray(day.activities)) continue;
    for (const act of day.activities) {
      allActivities.push(act);
    }
  }

  console.log(
    `[POI-Save] Extracting POIs from ${allActivities.length} activities (destinationId=${destinationId || "none"})...`,
  );

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
      if (!act.title) continue;

      // Extract place name from title
      const placeName = extractPlaceName(act.title);
      if (!placeName || placeName.length < 3) continue;

      // Resolve the destinationId: use activity's own, fallback to passed-in
      const resolvedDestId = act.destinationId
        ? Number(act.destinationId)
        : (destinationId ?? null);

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
        if (
          act.rating &&
          (!existingPoi.rating ||
            parseFloat(act.rating.toString()) >
            parseFloat(existingPoi.rating || "0"))
        )
          updates.rating = act.rating.toString();
        if (
          act.reviewCount &&
          act.reviewCount > (existingPoi.reviewCounts || 0)
        )
          updates.reviewCounts = act.reviewCount;
        if (act.address && !existingPoi.address) updates.address = act.address;
        if (
          act.latitude &&
          act.longitude &&
          (!existingPoi.latitude || existingPoi.latitude === "0")
        ) {
          updates.latitude = act.latitude.toString();
          updates.longitude = act.longitude.toString();
        }
        // Also update destinationId if it was missing
        if (resolvedDestId !== null && !existingPoi.destinationId) {
          updates.destinationId = resolvedDestId;
        }
        if (Object.keys(updates).length > 0) {
          await storage.updatePoi(existingPoi.poiId, updates);
        }
        continue;
      }

      await storage.createPoi({
        destinationId: resolvedDestId !== null ? resolvedDestId : undefined,
        name: placeName,
        address: act.address || "",
        latitude: act.latitude ? act.latitude.toString() : "0",
        longitude: act.longitude ? act.longitude.toString() : "0",
        rating: act.rating ? act.rating.toString() : "0",
        reviewCounts: act.reviewCount || 0,
        estimatedCost: act.estimatedCost
          ? act.estimatedCost.toString()
          : undefined,
        googlePlaceId: act.googlePlaceId || undefined,
        description: act.description || undefined,
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
  const {
    destination,
    startDate,
    endDate,
    budget,
    totalBudget,
    numPeople,
    preferences,
    startingPoint,
  } = req.body;

  if (!destination || !startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "destination, startDate, endDate are required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "") {
    throw new AppError(501, "GEMINI_API_KEY not configured");
  }

  try {
    const prefsText =
      preferences && preferences.length > 0 ? preferences.join(", ") : "";

    // Calculate number of days
    const parseDate = (d: string) => {
      const parts = d.split(/[-/]/);
      if (parts.length === 3)
        return new Date(
          parseInt(parts[2]),
          parseInt(parts[1]) - 1,
          parseInt(parts[0]),
        );
      return new Date(d);
    };
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const numDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    const budgetPerDay = totalBudget ? Math.round(totalBudget / numDays) : 0;

    // Resolve destination to province for better AI guidance
    const destProvinceMap: Record<string, string> = {
      "hạ long": "Quảng Ninh",
      "vịnh hạ long": "Quảng Ninh",
      "quảng ninh": "Quảng Ninh",
      "hội an": "Quảng Nam",
      "quảng nam": "Quảng Nam",
      "sa pa": "Lào Cai",
      sapa: "Lào Cai",
      "lào cai": "Lào Cai",
      "phú quốc": "Kiên Giang",
      "kiên giang": "Kiên Giang",
      "đà nẵng": "Đà Nẵng",
      "ninh bình": "Ninh Bình",
      "đà lạt": "Lâm Đồng",
      "lâm đồng": "Lâm Đồng",
      huế: "Thừa Thiên Huế",
      "thừa thiên huế": "Thừa Thiên Huế",
      "nha trang": "Khánh Hòa",
      "khánh hòa": "Khánh Hòa",
      "phong nha": "Quảng Bình",
      "quảng bình": "Quảng Bình",
      "hà nội": "Hà Nội",
      "hồ chí minh": "TP. Hồ Chí Minh",
      "sài gòn": "TP. Hồ Chí Minh",
      "vũng tàu": "Bà Rịa - Vũng Tàu",
      "phan thiết": "Bình Thuận",
      "mũi né": "Bình Thuận",
      "cần thơ": "Cần Thơ",
      "quy nhơn": "Bình Định",
      "buôn ma thuột": "Đắk Lắk",
      "hải phòng": "Hải Phòng",
      "cát bà": "Hải Phòng",
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

activityType: "food" | "sightseeing" | "transport" | "shopping" | "hotel" | "other"`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `Bạn là chuyên gia du lịch Việt Nam. CHỈ gợi ý địa điểm tại ${destination} thuộc ${province}. QUAN TRỌNG: Dùng TÊN CHÍNH XÁC NHÀ HÀNG trên Google Maps.\n\n${prompt}\n\nYêu cầu: Trả về JSON.` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      return res
        .status(502)
        .json({ error: "Gemini API error", details: errorText });
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      console.error(
        "Gemini returned empty response:",
        JSON.stringify(geminiData),
      );
      throw new AppError(502, "Gemini returned empty response");
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let parsed;
    try {
      const jsonStr = textContent
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse Gemini response:", textContent);
      return res
        .status(502)
        .json({ error: "Failed to parse AI response", raw: textContent });
    }

    // Validate structure
    if (!parsed.days || !Array.isArray(parsed.days)) {
      return res
        .status(502)
        .json({ error: "Invalid AI response structure", raw: parsed });
    }

    // Post-process: add IDs, defaults, Google Maps URLs, and budget scaling
    let totalEstimated = 0;
    const allActivities: any[] = [];
    for (const day of parsed.days) {
      if (!day.activities) day.activities = [];
      for (const act of day.activities) {
        act.id =
          Date.now().toString() + Math.random().toString(36).substr(2, 9);
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
    console.log(
      `[Enrich] Enriching ${allActivities.length} activities with SerpAPI...`,
    );

    // First, get destination coordinates for location bias (@lat,lng,zoom)
    let destLat = 0,
      destLng = 0;
    const destGeo = await internalGeocode(destination);
    if (destGeo) {
      destLat = destGeo.lat;
      destLng = destGeo.lng;
    }
    const locationBias = destLat && destLng ? `@${destLat},${destLng},14z` : "";

    // extractPlaceName is now a top-level function (reused by itinerary save POI logic)

    // Run sequentially to avoid SerpAPI rate limits
    let quotaExceeded = false;
    for (const act of allActivities) {
      if (!serpApiKey || quotaExceeded) break;

      // Extract the actual place name for better search
      const placeName = extractPlaceName(act.title);
      const searchQuery =
        placeName.length > 3
          ? `${placeName} ${destination}`
          : `${act.title} ${destination}`;

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
            if (
              match.gps_coordinates?.latitude &&
              match.gps_coordinates?.longitude
            ) {
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
              for (const [day, hours] of Object.entries(
                match.operating_hours,
              )) {
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
              act.description =
                `${match.title} — ★ ${match.rating || "N/A"}/5${match.reviews ? ` (${match.reviews} đánh giá)` : ""}. ${act.description || ""}`.trim();
            }
            // Generate Google Maps URL
            act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${act.latitude},${act.longitude}`;
            console.log(
              `[Enrich] ✅ "${act.title}" → ${match.title} | ${match.address} (${match.rating}★, ${match.reviews || 0} reviews)`,
            );
          } else {
            console.log(`[Enrich] ⚠️ No results for: "${searchQuery}"`);
          }
        } else {
          console.warn(
            `[Enrich] ❌ SerpAPI HTTP ${serpRes.status} for: "${searchQuery}"`,
          );
          if (serpRes.status === 429) {
            console.warn(
              "[Enrich] 🛑 Quota exceeded. Skipping further enrichment.",
            );
            quotaExceeded = true;
          }
        }
      } catch (err) {
        console.warn(`[Enrich] ❌ SerpAPI error for "${act.title}":`, err);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }

    // Fallback geocoding for activities that SerpAPI missed
    for (const act of allActivities) {
      if (
        act.latitude &&
        act.longitude &&
        act.latitude !== 0 &&
        act.longitude !== 0
      )
        continue;
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
    console.log(
      `[Enrich] Complete — all ${allActivities.length} activities processed`,
    );

    // Budget scaling: if total is way off budget, scale proportionally
    if (totalBudget && totalEstimated > 0) {
      const ratio = totalBudget / totalEstimated;
      if (ratio < 0.7 || ratio > 1.3) {
        const targetTotal = totalBudget * 0.92;
        const scale = targetTotal / totalEstimated;
        for (const day of parsed.days) {
          for (const act of day.activities) {
            act.estimatedCost =
              Math.round((act.estimatedCost * scale) / 1000) * 1000;
          }
        }
      }
    }

    // ═══ Resolve destinationId from destination name ═══
    let resolvedDestId: number | null = null;
    try {
      const destRecord = await storage.getDestinationByName(destination);
      if (destRecord) {
        resolvedDestId = destRecord.destinationId;
        console.log(
          `[POI] Resolved destination "${destination}" → id=${resolvedDestId}`,
        );
      } else {
        console.log(
          `[POI] No destination found for "${destination}", POIs will have empty destinationId`,
        );
      }
    } catch (err) {
      console.warn(`[POI] Failed to resolve destination:`, err);
    }

    // ═══ Save enriched activities as POIs (dedup by googlePlaceId or name) ═══
    console.log(
      `[POI] Saving POIs from ${allActivities.length} activities (destinationId=${resolvedDestId || "none"})...`,
    );
    let savedCount = 0;
    for (const act of allActivities) {
      try {
        // Skip activities without useful data
        if (!act.title) continue;

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
          if (
            act.rating &&
            (!existingPoi.rating || act.rating > (existingPoi.rating || 0))
          )
            updates.rating = act.rating.toString();
          if (
            act.reviewCount &&
            act.reviewCount > (existingPoi.reviewCounts || 0)
          )
            updates.reviewCounts = act.reviewCount;
          if (act.address && !existingPoi.address)
            updates.address = act.address;
          if (
            act.latitude &&
            act.longitude &&
            (!existingPoi.latitude || existingPoi.latitude === "0")
          ) {
            updates.latitude = act.latitude.toString();
            updates.longitude = act.longitude.toString();
          }
          // Also update destinationId if it was missing
          if (resolvedDestId && !existingPoi.destinationId) {
            updates.destinationId = resolvedDestId;
          }
          if (Object.keys(updates).length > 0) {
            await storage.updatePoi(existingPoi.poiId, updates);
          }
          // Link POI ID to activity for itinerary_items creation
          act.poiId = existingPoi.poiId;
          continue;
        }

        const createdPoi = await storage.createPoi({
          destinationId: resolvedDestId !== null ? resolvedDestId : undefined,
          name: placeName,
          address: act.address || "",
          latitude: act.latitude ? act.latitude.toString() : "0",
          longitude: act.longitude ? act.longitude.toString() : "0",
          rating: act.rating ? act.rating.toString() : "0",
          reviewCounts: act.reviewCount || 0,
          estimatedCost: act.estimatedCost
            ? act.estimatedCost.toString()
            : undefined,
          googlePlaceId: act.googlePlaceId || undefined,
          description: act.description || undefined,
        });

        // Use the specific type found by Google/AI for the activity tag
        const specificType = act.placeType || act.activityType;

        // Update activity record with its specific type for display
        act.activityType = specificType;

        // Link newly created POI ID to activity for itinerary_items creation
        if (createdPoi?.poiId) {
          act.poiId = createdPoi.poiId;
          // Associate preferences to newly created POI
          await associatePreferencesToPoi(createdPoi.poiId, act.activityType, act.title, act.description);
        }
        savedCount++;
      } catch (err) {
        console.warn(`[POI] Failed to save POI for "${act.title}":`, err);
      }
    }
    console.log(`[POI] Saved ${savedCount} new POIs to database`);

    return res.json(parsed);
  } catch (error) {
    console.error("Generate itinerary error:", error);
    throw new AppError(500, "Failed to generate itinerary");
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
      serpapi: {
        available: hasSerpApi,
        name: "SerpAPI Google Maps (PRIMARY)",
        primary: true,
      },
      google: { available: hasGoogle, name: "Google Maps Platform (fallback)" },
      goong: { available: hasGoong, name: "Goong Maps (fallback)" },
      free: { available: true, name: "OpenStreetMap + OSRM (miễn phí)" },
    },
    fallbackChain: [
      hasSerpApi
        ? "✅ SerpAPI (PRIMARY — search, details, photos, reviews)"
        : "❌ SerpAPI (no key)",
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
  let placeId = req.query.place_id as string;
  const q = req.query.q as string;
  const fallbackQ = req.query.fallback_q as string;
  const nextPageToken = req.query.next_page_token as string | undefined;

  if (!placeId && !q) {
    throw new AppError(400, "place_id or q parameter is required");
  }

  const apiKey = getSerpApiKey();
  if (!apiKey) {
    throw new AppError(501, "SERPAPI_KEY not configured");
  }

  // Helper to fetch reviews for a specific ID
  const fetchReviewsForId = async (id: string, token?: string) => {
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      place_id: id,
      hl: "vi",
      api_key: apiKey,
    });
    if (token) params.set("next_page_token", token);

    const url = `${SERPAPI_BASE}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  };

  try {
    let data: any = null;

    // Phase 1: Try direct placeId if provided
    if (placeId) {
      console.log(`[SerpAPI] Fetching reviews for place_id=${placeId}`);
      data = await fetchReviewsForId(placeId, nextPageToken);
    }

    // Phase 2: If no data yet (or 0 reviews and we have a fallback query), try searching
    const hasNoReviews = !data || (data.reviews || []).length === 0;
    const canSearch = (q || fallbackQ) && !nextPageToken; // Only search for first page

    if (hasNoReviews && canSearch) {
      const searchQuery = q || fallbackQ;
      console.log(`[SerpAPI] Falling back to search for: "${searchQuery}"`);

      const searchParams = new URLSearchParams({
        engine: "google_maps",
        q: searchQuery,
        hl: "vi",
        api_key: apiKey,
      });
      const searchRes = await fetch(
        `${SERPAPI_BASE}?${searchParams.toString()}`,
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const firstResultId =
          searchData.place_id ||
          (searchData.local_results && searchData.local_results[0]?.place_id);

        if (firstResultId && firstResultId !== placeId) {
          console.log(
            `[SerpAPI] Resolved "${searchQuery}" to new place_id=${firstResultId}`,
          );
          data = await fetchReviewsForId(firstResultId);
        }
      }
    }

    if (!data) {
      console.warn(
        `[SerpAPI] No reviews found for place_id="${placeId}" or query="${q || fallbackQ}"`,
      );
      return res.json({
        placeInfo: null,
        reviews: [],
        nextPageToken: null,
        message: "No reviews found for this location",
      });
    }

    if (data.error && data.error.includes("run out of searches")) {
      return res
        .status(429)
        .json({ error: "SerpAPI quota exceeded", status: 429 });
    }

    // Map response to our format
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
          snippet:
            r.response.snippet ||
            r.response.extracted_snippet?.original ||
            "",
          date: r.response.date || "",
        }
        : null,
    }));

    const nextToken = data.serpapi_pagination?.next_page_token || null;

    console.log(
      `[SerpAPI] Got ${reviews.length} reviews for "${placeInfo?.title || placeId}"`,
    );
    return res.json({
      placeInfo,
      reviews,
      nextPageToken: nextToken,
    });
  } catch (error) {
    console.error("[SerpAPI] Reviews error:", error);
    throw new AppError(500, "Failed to fetch reviews");
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
    throw new AppError(400, "Query is required");
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
      estimatedCost: r.price
        ? parseInt(r.price.replace(/[^0-9]/g, "")) || 0
        : 0,
      description: r.description || r.type || "",
      googlePlaceId: r.place_id || "",
      thumbnail: r.thumbnail || "",
      // r.hours from local_results (search) is a status string like "Open ⋅ Closes 10 PM"
      // Use operating_hours if available for real schedule data
      openHours: r.operating_hours
        ? Object.entries(r.operating_hours)
          .map(([day, hours]) => `${day}: ${hours}`)
          .join(" | ")
        : typeof r.hours === "string"
          ? r.hours
          : "",
    });

    let restaurants: any[] = [];
    let attractions: any[] = [];

    if (restRes.ok) {
      const restData = await restRes.json();
      restaurants = (restData.local_results || [])
        .filter(
          (r: any) =>
            r.gps_coordinates?.latitude && r.gps_coordinates?.longitude,
        )
        .slice(0, 10)
        .map((r: any) => mapResult(r, "restaurant"));
    }

    if (attrRes.ok) {
      const attrData = await attrRes.json();
      attractions = (attrData.local_results || [])
        .filter(
          (r: any) =>
            r.gps_coordinates?.latitude && r.gps_coordinates?.longitude,
        )
        .slice(0, 10)
        .map((r: any) => mapResult(r, "attraction"));
    }

    // Sort by rating
    restaurants.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    attractions.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));

    console.log(
      `[AutoDiscover] Found ${restaurants.length} restaurants, ${attractions.length} attractions near "${query}"`,
    );

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
  console.log(
    `   🔑 SerpAPI: ${getSerpApiKey() ? "✅ configured (PRIMARY)" : "❌ not configured"}`,
  );
  console.log(
    `   Google: ${getGoogleKey() ? "✅ configured (fallback)" : "❌ not configured"}`,
  );
  console.log(
    `   Goong:  ${getGoongKey() ? "✅ configured (fallback)" : "❌ not configured"}`,
  );
  console.log(`   Free:   ✅ always available (Nominatim + OSRM)\n`);
  console.log(`   💾 Database: PostgreSQL (Drizzle ORM)\n`);

  // Provider status
  app.get("/api/places/provider", getProviderStatus);

  // Places search routes (SerpAPI → Google → Goong → Nominatim)
  app.get("/api/places/search", asyncHandler(searchPlaces));
  app.get("/api/places/details/:placeId", asyncHandler(getPlaceDetails));
  app.get("/api/places/photo", asyncHandler(getPlacePhoto));

  // SerpAPI HD Photos by data_id
  app.get("/api/places/serp-photos/:dataId", asyncHandler(getSerpPhotos));

  // Dashboard Stats
  app.get(
    "/api/admin/stats",
    asyncHandler(async (_req, res) => {
      const stats = await storage.getAdminStats();
      sendResponse(res, 200, "Stats retrieved successfully", stats);
    }),
  );

  // Geocode & directions (with fallback)
  app.get("/api/places/geocode", asyncHandler(geocodeAddress));
  app.get("/api/places/directions", asyncHandler(getDirections));

  // SerpAPI Reviews
  app.get("/api/places/reviews", asyncHandler(getPlaceReviewsSerpApi));

  // Auto-discover nearby POIs
  app.get("/api/places/auto-discover", asyncHandler(autoDiscoverPOIs));

  // AI Itinerary generation
  app.post("/api/generate-itinerary", asyncHandler(generateItineraryAI));

  // Share trip routes
  app.post("/api/share", asyncHandler(shareTrip));
  app.get("/api/share/:code", asyncHandler(getSharedTrip));
  app.post("/api/share/join", asyncHandler(joinSharedTrip));
  app.patch("/api/share/companion", asyncHandler(updateCompanionRole));
  app.delete("/api/share/companion", asyncHandler(removeCompanion));

  // ══════════════════════════════════════════════════════════════
  // CRUD: Users
  // ══════════════════════════════════════════════════════════════
  app.get(
    "/api/users",
    asyncHandler(async (req, res) => {
      const search = req.query.search as string;
      const users = await storage.getUsers(search);
      sendResponse(res, 200, "Users retrieved successfully", users);
    }),
  );

  app.get(
    "/api/users/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid user ID");
      const user = await storage.getUser(id);
      if (!user) throw new AppError(404, "User not found");
      sendResponse(res, 200, "User retrieved successfully", user);
    }),
  );

  app.post(
    "/api/users",
    asyncHandler(async (req, res) => {
      const user = await storage.createUser(req.body);
      sendResponse(res, 201, "User created successfully", user);
    }),
  );

  app.put(
    "/api/users/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError(400, "Invalid user ID");
      }

      // Map frontend fields to backend schema
      const updateData: Record<string, any> = {};
      const body = req.body;

      if (body.userName !== undefined) updateData.userName = body.userName;
      if (body.fullName !== undefined) updateData.userName = body.fullName; // Map fullName to userName
      if (body.email !== undefined) updateData.email = body.email;
      if (body.password !== undefined) updateData.password = body.password;
      if (body.role !== undefined) updateData.role = body.role;

      // Map isLocked to status
      if (body.isLocked !== undefined) {
        updateData.status = body.isLocked ? "locked" : "active";
      } else if (body.status !== undefined) {
        updateData.status = body.status;
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) throw new AppError(404, "User not found");
      sendResponse(res, 200, "User updated successfully", user);
    }),
  );

  app.delete(
    "/api/users/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid user ID");
      const ok = await storage.deleteUser(id);
      if (!ok) throw new AppError(404, "User not found");
      sendResponse(res, 200, "User deleted successfully", null);
    }),
  );

  // Login / Register
  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      const { email, username, password } = req.body;
      const identifier = (email || username || "").toLowerCase().trim();
      if (!identifier || !password)
        throw new AppError(400, "Email or username and password are required");

      let user = await storage.getUserByEmail(identifier);
      if (!user) {
        user = await storage.getUserByUsername(identifier);
      }

      if (!user || user.password !== password)
        throw new AppError(401, "Invalid credentials");
      if (user.status === "banned" || user.status === "inactive")
        throw new AppError(403, "Account is locked");

      sendResponse(res, 200, "Login successful", user);
    }),
  );

  app.post(
    "/api/auth/register",
    asyncHandler(async (req, res) => {
      console.log("[Auth] Register request body:", JSON.stringify(req.body));
      const { userName, username, password, email } = req.body;
      const finalUserName = userName || username;

      console.log(
        `[Auth] Validation check: finalUserName="${finalUserName}", hasPassword=${!!password}, hasEmail=${!!email}`,
      );

      if (!finalUserName || !password || !email) {
        console.warn("[Auth] Registration validation failed: missing fields");
        throw new AppError(400, "userName, email and password are required");
      }

      const normalizedEmail = email.toLowerCase().trim();
      console.log(`[Auth] Checking if email exists: ${normalizedEmail}`);
      const existing = await storage.getUserByEmail(normalizedEmail);
      if (existing) throw new AppError(409, "Email already exists");

      const user = await storage.createUser({
        userName: finalUserName,
        password,
        email: normalizedEmail,
        role: "user",
        status: "active",
      });
      sendResponse(res, 201, "Registration successful", user);
    }),
  );

  // ══════════════════════════════════════════════════════════════
  // CRUD: Destination Types (Categories)
  // ══════════════════════════════════════════════════════════════

  // Seed destination types, POI types, and admin user on boot
  storage
    .seedDestinationTypes()
    .catch((e) => console.error("Destination type seeding failed:", e));
  storage
    .seedPoiTypes()
    .catch((e) => console.error("POI type seeding failed:", e));
  storage
    .seedPreferences()
    .catch((e) => console.error("Preference seeding failed:", e));
  storage
    .seedAdminUser()
    .catch((e) => console.error("Admin user seeding failed:", e));

  // Helper to enrich destination with category label
  const enrichDestination = async (d: any) => {
    const types = await storage.getDestinationTypes();
    const typeMap = types.reduce((acc: any, t: any) => {
      acc[t.destinationtypeId] = t.typeName;
      return acc;
    }, {});

    return {
      ...d,
      id: (d.destinationId || d.id)?.toString(),
      category: d.destinationTypeId
        ? typeMap[d.destinationTypeId] || "Khác"
        : "Khác",
    };
  };

  app.get(
    "/api/destination-types",
    asyncHandler(async (_req, res) => {
      const types = await storage.getDestinationTypes();
      sendResponse(res, 200, "Destination types retrieved successfully", types);
    }),
  );

  app.get(
    "/api/expense-types",
    asyncHandler(async (_req, res) => {
      const types = await storage.getExpenseTypes();
      sendResponse(res, 200, "Expense types retrieved successfully", types);
    }),
  );

  app.get(
    "/api/destinations",
    asyncHandler(async (req, res) => {
      const typeId = req.query.typeId ? Number(req.query.typeId) : undefined;
      const destinations = await storage.getDestinations(
        typeId && !isNaN(typeId) ? { destinationTypeId: typeId } : undefined,
      );
      const enriched = await Promise.all(destinations.map(enrichDestination));
      sendResponse(res, 200, "Destinations retrieved successfully", enriched);
    }),
  );

  app.get(
    "/api/destinations/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid destination ID");
      const dest = await storage.getDestination(id);
      if (!dest) throw new AppError(404, "Destination not found");
      sendResponse(res, 200, "Destination retrieved successfully", dest);
    }),
  );

  app.post(
    "/api/destinations",
    asyncHandler(async (req, res) => {
      const dest = await storage.createDestination(req.body);
      const enriched = await enrichDestination(dest);
      sendResponse(res, 201, "Destination created successfully", enriched);
    }),
  );

  app.put(
    "/api/destinations/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid destination ID");
      const dest = await storage.updateDestination(id, req.body);
      if (!dest) throw new AppError(404, "Destination not found");
      const enriched = await enrichDestination(dest);
      sendResponse(res, 200, "Destination updated successfully", enriched);
    }),
  );

  app.delete(
    "/api/destinations/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid destination ID");
      const ok = await storage.deleteDestination(id);
      if (!ok) throw new AppError(404, "Destination not found");
      sendResponse(res, 200, "Destination deleted successfully", null);
    }),
  );

  // ══════════════════════════════════════════════════════════════
  // CRUD: Trips
  // ══════════════════════════════════════════════════════════════
  app.get(
    "/api/trips",
    asyncHandler(async (req, res) => {
      const ownerId = req.query.ownerId;
      const memberId = req.query.memberId;
      let items = [];

      if (ownerId) items = await storage.getTripsByOwner(Number(ownerId));
      else if (memberId)
        items = await storage.getTripsByMember(Number(memberId));
      else items = await storage.getTrips();

      // Map Drizzle relational structure to frontend structure
      const mappedItems = items.map((trip: any) => mapTripToFrontend(trip));

      sendResponse(res, 200, "Trips retrieved successfully", mappedItems);
    }),
  );

  app.get(
    "/api/trips/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid trip ID");
      const trip: any = await storage.getTrip(id);
      if (!trip) throw new AppError(404, "Trip not found");

      sendResponse(
        res,
        200,
        "Trip retrieved successfully",
        mapTripToFrontend(trip),
      );
    }),
  );

  app.post(
    "/api/trips",
    asyncHandler(async (req, res) => {
      const payload = { ...req.body };
      if (payload.startDate)
        payload.startDate = parseDateStringToISO(payload.startDate);
      if (payload.endDate)
        payload.endDate = parseDateStringToISO(payload.endDate);
      if (payload.budget)
        payload.budget = parseCurrencyToNumeric(payload.budget);

      // Map frontend's userId to backend's ownerId
      if (payload.userId && !payload.ownerId) {
        payload.ownerId = Number(payload.userId);
      }

      // Resolve destination string to destinationId
      if (payload.destination && !payload.destinationId) {
        const destRecord = await storage.getDestinationByName(
          payload.destination,
        );
        if (destRecord) {
          payload.destinationId = destRecord.destinationId;
        } else {
          // Fallback if destination doesn't exist? Create it.
          try {
            // Basic fallback creation so the trip isn't orphaned
            const newDest = await storage.createDestination({
              name: payload.destination,
              address: payload.destination,
              latitude: "0",
              longitude: "0",
            });
            payload.destinationId = newDest.destinationId;
          } catch (e) {
            console.warn("Could not create destination:", e);
          }
        }
      }

      const trip = await storage.createTrip(payload);

      // Save user-selected trip preferences
      if (payload.preferences && Array.isArray(payload.preferences)) {
        await associatePreferencesToTrip(trip.tripId, payload.preferences);
      }

      // AI Gen: Save days structure
      if (payload.days && Array.isArray(payload.days)) {
        for (let i = 0; i < payload.days.length; i++) {
          const dayData = payload.days[i];

          let dayDate = undefined;
          if (trip.startDate) {
            const d = new Date(trip.startDate);
            d.setDate(d.getDate() + (dayData.day ? dayData.day - 1 : i));
            dayDate = d.toISOString().split("T")[0];
          }

          const createdDay = await storage.createItineraryDay({
            tripId: trip.tripId,
            date: dayDate,
            dayIndex: dayData.day || i + 1,
          });

          if (dayData.activities && Array.isArray(dayData.activities)) {
            let orderIndex = 0;
            for (const activity of dayData.activities) {
              let estCost = undefined;
              if (activity.estimatedCost) {
                estCost =
                  typeof activity.estimatedCost === "number"
                    ? activity.estimatedCost.toString()
                    : parseCurrencyToNumeric(
                      activity.estimatedCost,
                    )?.toString();
              }

              let numDuration = 60;
              if (typeof activity.duration === "string") {
                const parsed = parseInt(activity.duration);
                if (!isNaN(parsed)) {
                  numDuration = activity.duration.toLowerCase().includes("giờ")
                    ? parsed * 60
                    : parsed;
                }
              } else if (typeof activity.duration === "number") {
                numDuration = activity.duration;
              }

              try {
                let resolvedPoiId = activity.poiId
                  ? Number(activity.poiId)
                  : undefined;

                // Nếu chưa có poiId nhưng có mô tả, bắt buộc phải tìm hoặc tạo POI để lưu trữ
                if (
                  !resolvedPoiId &&
                  (activity.description || activity.title)
                ) {
                  const placeName = extractPlaceName(activity.title);
                  let existing = await storage.getPoiByName(placeName);
                  if (!existing && activity.googlePlaceId) {
                    existing = await storage.getPoiByGooglePlaceId(
                      activity.googlePlaceId,
                    );
                  }

                  if (existing) {
                    resolvedPoiId = existing.poiId;
                    // Cập nhật mô tả nếu POI hiện tại đang trống
                    if (!existing.description && activity.description) {
                      await storage.updatePoi(existing.poiId, {
                        description: activity.description,
                      });
                    }
                  } else {
                    // Tạo mới một POI "lite" để giữ mô tả
                    const newPoi = await storage.createPoi({
                      name: placeName,
                      description: activity.description || undefined,
                      destinationId: payload.destinationId,
                      latitude: activity.latitude
                        ? activity.latitude.toString()
                        : "0",
                      longitude: activity.longitude
                        ? activity.longitude.toString()
                        : "0",
                      address: activity.address || "",
                      googlePlaceId: activity.googlePlaceId || undefined,
                    });
                    resolvedPoiId = newPoi.poiId;
                    // Associate preferences
                    await associatePreferencesToPoi(newPoi.poiId, activity.activityType, activity.title, activity.description);
                  }
                }

                await storage.createItineraryItem({
                  dayId: createdDay.dayId,
                  tripId: trip.tripId,
                  poiId: resolvedPoiId,
                  customName: activity.title,
                  startTime: activity.time,
                  duration: numDuration,
                  orderIndex: orderIndex++,
                  note: null, // Tuyệt đối không lưu vào note
                  estimatedCost: estCost,
                  status: activity.isCompleted ? "completed" : "pending",
                  expenseTypeId: activity.expenseTypeId
                    ? Number(activity.expenseTypeId)
                    : mapActivityTypeToExpenseId(activity.activityType),
                  activityType: activity.activityType || mapExpenseIdToActivityType(
                    activity.expenseTypeId ? Number(activity.expenseTypeId) : null
                  ),
                });
              } catch (err) {
                console.warn("Failed to create itinerary item:", err);
              }
            }
          }
        }
      }

      const finalTrip = await storage.getTrip(trip.tripId);
      sendResponse(
        res,
        201,
        "Trip created successfully",
        mapTripToFrontend(finalTrip),
      );
    }),
  );

  app.put(
    "/api/trips/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid trip ID");

      const payload = { ...req.body };
      if (payload.startDate)
        payload.startDate = parseDateStringToISO(payload.startDate);
      if (payload.endDate)
        payload.endDate = parseDateStringToISO(payload.endDate);
      if (payload.budget)
        payload.budget = parseCurrencyToNumeric(payload.budget);

      const trip = await storage.updateTrip(id, payload);
      if (!trip) throw new AppError(404, "Trip not found");

      // Handle nested itinerary item updates: add, update, delete
      if (req.body.days && Array.isArray(req.body.days)) {
        const dbDays = await storage.getItineraryDaysByTrip(id);
        const processedDayIds = new Set<number>();

        for (const day of req.body.days) {
          if (!day.activities || !Array.isArray(day.activities)) continue;

          // Match by explicit ID first, then fallback to index
          const incomingDayId = day.dayId || day.id;
          let matchedDay = dbDays.find(
            (d: any) => d.dayId === Number(incomingDayId),
          );

          if (!matchedDay) {
            // Fallback for newly created days that might only have index
            matchedDay = dbDays.find(
              (d: any) => d.dayIndex === (day.day || day.dayIndex),
            );
          }

          let dayId: number;

          if (matchedDay) {
            dayId = matchedDay.dayId;
            processedDayIds.add(dayId);
            // Update dayIndex in case it changed (e.g. re-indexing after deletion)
            const newIndex = day.day || day.dayIndex;
            if (matchedDay.dayIndex !== newIndex) {
              await storage.updateItineraryDay(dayId, { dayIndex: newIndex });
            }
          } else {
            // Create new day
            const newDay = await storage.createItineraryDay({
              tripId: id,
              dayIndex: day.day || day.dayIndex,
            });
            dayId = newDay.dayId;
            processedDayIds.add(dayId);
          }

          // Get existing items for this day to detect deletions
          const existingItems = await storage.getItineraryItemsByDay(dayId);
          const incomingIds = new Set<number>();

          let orderIndex = 0;
          for (const act of day.activities) {
            const actId = act.id ? Number(act.id) : NaN;
            const isExistingDbRecord = !isNaN(actId);

            if (isExistingDbRecord) {
              incomingIds.add(actId);

              // Calculate duration if provided
              let numDuration = undefined;
              if (act.duration !== undefined) {
                if (typeof act.duration === "string") {
                  const parsed = parseInt(act.duration);
                  if (!isNaN(parsed))
                    numDuration = act.duration.toLowerCase().includes("giờ")
                      ? parsed * 60
                      : parsed;
                } else if (typeof act.duration === "number") {
                  numDuration = act.duration;
                }
              }

              // Update existing item: status, note, cost, expenseType, time, title, duration
              const updatePayload: Record<string, any> = {
                status: act.isCompleted ? "completed" : "pending",
                orderIndex: orderIndex++,
              };

              if (act.time) updatePayload.startTime = act.time;
              if (act.title) updatePayload.customName = act.title;
              if (numDuration !== undefined)
                updatePayload.duration = numDuration;
              if (act.actualCost !== undefined)
                updatePayload.actualCost = act.actualCost
                  ? act.actualCost.toString()
                  : null;
              if (act.expenseTypeId !== undefined) {
                const newExpId = act.expenseTypeId ? Number(act.expenseTypeId) : null;
                updatePayload.expenseTypeId = newExpId || mapActivityTypeToExpenseId(act.activityType);
              }
              // ALWAYS prioritize the existing/incoming activityType string
              if (act.activityType !== undefined) {
                updatePayload.activityType = act.activityType || mapExpenseIdToActivityType(
                  act.expenseTypeId ? Number(act.expenseTypeId) : null
                );
              }
              if (
                act.activityType !== undefined &&
                act.expenseTypeId === undefined
              ) {
                updatePayload.activityType = act.activityType || null;
                updatePayload.expenseTypeId = mapActivityTypeToExpenseId(
                  act.activityType,
                );
              }

              // Save note from user — this is the only place notes should be persisted
              if (act.notes !== undefined) {
                updatePayload.note =
                  Array.isArray(act.notes) && act.notes.length > 0
                    ? act.notes.join("\n---\n")
                    : null;
              } else if (act.note !== undefined) {
                updatePayload.note = act.note || null;
              }
              await storage.updateItineraryItem(actId, updatePayload);
            } else {
              // New activity — create itinerary_item and optionally create/link POI
              let estCost = undefined;
              if (act.estimatedCost) {
                estCost =
                  typeof act.estimatedCost === "number"
                    ? act.estimatedCost.toString()
                    : parseCurrencyToNumeric(act.estimatedCost)?.toString();
              }
              let numDuration = 60;
              if (typeof act.duration === "string") {
                const parsed = parseInt(act.duration);
                if (!isNaN(parsed))
                  numDuration = act.duration.toLowerCase().includes("giờ")
                    ? parsed * 60
                    : parsed;
              } else if (typeof act.duration === "number") {
                numDuration = act.duration;
              }

              let resolvedPoiId = act.poiId ? Number(act.poiId) : undefined;
              // Auto-link or create POI if activity has description
              if (!resolvedPoiId && act.title) {
                const placeName = extractPlaceName(act.title);
                const existing = await storage.getPoiByName(placeName);
                if (existing) {
                  resolvedPoiId = existing.poiId;
                  if (!existing.description && act.description) {
                    await storage.updatePoi(existing.poiId, {
                      description: act.description,
                    });
                  }
                } else if (act.description || act.title) {
                  const activityToPoiType: Record<string, string> = {
                    sightseeing: "attraction",
                    food: "restaurant",
                    shopping: "shopping",
                    transport: "other",
                    other: "other",
                  };
                  const typeName = activityToPoiType[act.activityType] || "other";
                  const poitypeId = await resolvePoiTypeId(typeName);

                  const newPoi = await storage.createPoi({
                    name: placeName,
                    description: act.description || undefined,
                    latitude: act.latitude ? act.latitude.toString() : "0",
                    longitude: act.longitude ? act.longitude.toString() : "0",
                    address: act.address || "",
                    googlePlaceId: act.googlePlaceId || undefined,
                    destinationId: act.destinationId ? Number(act.destinationId) : undefined,
                    poitypeId: poitypeId,
                  });
                  resolvedPoiId = newPoi.poiId;
                }
              }

              try {
                await storage.createItineraryItem({
                  dayId,
                  tripId: id,
                  poiId: resolvedPoiId,
                  customName: act.title,
                  startTime: act.time,
                  duration: numDuration,
                  orderIndex: orderIndex++,
                  note: null, // New activities never get note at creation time
                  estimatedCost: estCost,
                  status: act.isCompleted ? "completed" : "pending",
                  expenseTypeId: act.expenseTypeId
                    ? Number(act.expenseTypeId)
                    : mapActivityTypeToExpenseId(act.activityType),
                  activityType: act.activityType
                    ? act.activityType
                    : mapExpenseIdToActivityType(
                      act.expenseTypeId ? Number(act.expenseTypeId) : null,
                    ),
                });
              } catch (err) {
                console.warn(
                  "[PUT /trips] Failed to create new activity:",
                  err,
                );
              }
            }
          }

          // Delete activities that were removed from the day
          for (const existing of existingItems) {
            if (!incomingIds.has(existing.itemId)) {
              try {
                await storage.deleteItineraryItem(existing.itemId);
              } catch (err) {
                console.warn(
                  "[PUT /trips] Failed to delete removed activity:",
                  err,
                );
              }
            }
          }
        }

        // Delete days that were removed from the trip
        for (const dbDay of dbDays) {
          if (!processedDayIds.has(dbDay.dayId)) {
            try {
              await storage.deleteItineraryDay(dbDay.dayId);
            } catch (err) {
              console.warn("[PUT /trips] Failed to delete removed day:", err);
            }
          }
        }

        // AUTO-SYNC TRIP DATES: If days changed, recalculate endDate based on max dayIndex
        const finalDays = await storage.getItineraryDaysByTrip(id);
        if (finalDays.length > 0) {
          const maxDayIndex = Math.max(...finalDays.map(d => d.dayIndex || 1));
          const currentTrip = await storage.getTrip(id);
          if (currentTrip && currentTrip.startDate) {
            const start = new Date(currentTrip.startDate);
            if (!isNaN(start.getTime())) {
              const newEnd = new Date(start);
              newEnd.setDate(start.getDate() + (maxDayIndex - 1));

              // Only update if it actually changed to avoid redundant writes
              const newEndStr = newEnd.toISOString().split('T')[0];
              const oldEndStr = currentTrip.endDate ? new Date(currentTrip.endDate).toISOString().split('T')[0] : "";

              if (newEndStr !== oldEndStr) {
                console.log(`[PUT /trips] Syncing trip dates: N days=${maxDayIndex}, new endDate=${newEndStr}`);
                await storage.updateTrip(id, { endDate: newEndStr });
              }
            }
          }
        }
      }

      // Handle nested expenses update
      if (
        req.body.expenses &&
        Array.isArray(req.body.expenses) &&
        trip.status !== "completed"
      ) {
        const processedExpenseIds = new Set<number>();

        // Deduplicate expenses to ensure only ONE expense per activityId is saved
        const expensesToProcess = [];
        const seenItemIdsForExpenses = new Set<number>();
        for (const exp of req.body.expenses) {
          if (exp.activityId && !isNaN(Number(exp.activityId))) {
            const actId = Number(exp.activityId);
            if (seenItemIdsForExpenses.has(actId)) {
              continue; // Skip duplicates; they will be deleted during cleanup
            }
            seenItemIdsForExpenses.add(actId);
          }
          expensesToProcess.push(exp);
        }

        for (const exp of expensesToProcess) {
          const expData = {
            tripId: id,
            description: exp.title || exp.description,
            amount: exp.amount ? exp.amount.toString() : "0",
            paidBy: exp.paidByUserId
              ? Number(exp.paidByUserId)
              : exp.userId
                ? Number(exp.userId)
                : trip.ownerId,
            splitMethod: exp.splitType || "none",
            itemId:
              exp.activityId && !isNaN(Number(exp.activityId))
                ? Number(exp.activityId)
                : undefined,
            expenseTypeId: await resolveExpenseTypeId(exp.type),
          };

          if (exp.date || exp.createdAt) {
            (expData as any).createdAt = new Date(exp.date || exp.createdAt);
          }

          let finalExpId: number | undefined;

          // Check if ID is a valid database ID (numeric)
          let expIdParsed = NaN;
          if (
            exp.id &&
            typeof exp.id === "string" &&
            !exp.id.startsWith("temp-")
          ) {
            expIdParsed = Number(exp.id);
          } else if (typeof exp.id === "number") {
            expIdParsed = exp.id;
          }

          // If no valid ID provided but this is an activity-linked expense,
          // try to find an exitsting expense for that activity ID to prevent duplicates
          if (isNaN(expIdParsed) && expData.itemId) {
            const tripExps = await storage.getExpensesByTrip(id);
            const existingMatch = tripExps.find(
              (e) => e.itemId === expData.itemId,
            );
            if (existingMatch) {
              expIdParsed = existingMatch.expenseId;
            }
          }

          if (!isNaN(expIdParsed)) {
            await storage.updateExpense(expIdParsed, expData);
            finalExpId = expIdParsed;
          } else {
            const created = await storage.createExpense(expData);
            if (created && created.expenseId) {
              finalExpId = created.expenseId;
            }
          }

          if (finalExpId) {
            processedExpenseIds.add(finalExpId);
            // Re-sync splits
            await storage.deleteExpenseSplits(finalExpId);
            if (
              exp.splitType !== "none" &&
              exp.splits &&
              Array.isArray(exp.splits)
            ) {
              for (const split of exp.splits) {
                await storage.createExpenseSplit({
                  expenseId: finalExpId,
                  userId: Number(split.userId),
                  amount: split.amount ? split.amount.toString() : "0",
                });
              }
            }
          }
        }

        // Handle deletions
        const dbExpenses = await storage.getExpensesByTrip(id);
        for (const dbExp of dbExpenses) {
          if (!processedExpenseIds.has(dbExp.expenseId)) {
            await storage.deleteExpense(dbExp.expenseId);
          }
        }
      }

      // Re-fetch the final trip state AFTER all nested updates are done
      const finalTrip = await storage.getTrip(id);
      sendResponse(
        res,
        200,
        "Trip updated successfully",
        mapTripToFrontend(finalTrip),
      );
    }),
  );

  app.delete(
    "/api/trips/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (isNaN(id)) throw new AppError(400, "Invalid trip ID");
      const ok = await storage.deleteTrip(id);
      if (!ok) throw new AppError(404, "Trip not found");
      sendResponse(res, 200, "Trip deleted successfully", null);
    }),
  );

  // ══════════════════════════════════════════════════════════════
  // CRUD: Reviews (Trip & Item)
  // ══════════════════════════════════════════════════════════════
  app.get(
    "/api/reviews",
    asyncHandler(async (req, res) => {
      const tripId = req.query.tripId ? Number(req.query.tripId) : undefined;
      const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
      const destinationId = req.query.destinationId
        ? Number(req.query.destinationId)
        : undefined;

      const reviews = await storage.getReviews({
        tripId,
        itemId,
        destinationId,
      });
      sendResponse(res, 200, "Reviews retrieved successfully", reviews);
    }),
  );

  app.post(
    "/api/reviews",
    asyncHandler(async (req, res) => {
      // Handle field mapping from frontend (DataContext/itinerary screen) to backend schema
      const tripId = req.body.tripId || req.body.itineraryId;
      const itemId = req.body.itemId || req.body.activityId || req.body.poiId;

      const payload = { ...req.body };

      let review;
      if (itemId) {
        payload.itemId = Number(itemId);
        review = await storage.createItemReview(payload);
      } else if (tripId) {
        payload.tripId = Number(tripId);
        review = await storage.createTripReview(payload);
      } else {
        throw new AppError(400, "tripId or itemId required");
      }

      sendResponse(res, 201, "Review created successfully", review);
    }),
  );

  app.put(
    "/api/reviews/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const userId = Number(req.body.userId || req.query.userId);
      const type =
        req.query.type ||
        req.body.type ||
        (req.body.poiId || req.body.activityId ? "item" : "trip");

      if (isNaN(id) || isNaN(userId))
        throw new AppError(400, "Invalid ID or User ID");

      let updated;
      if (type === "item") {
        updated = await storage.updateItemReview(id, userId, req.body);
      } else {
        updated = await storage.updateTripReview(id, userId, req.body);
      }

      if (!updated) throw new AppError(404, "Review not found");
      sendResponse(res, 200, "Review updated successfully", updated);
    }),
  );

  app.delete(
    "/api/reviews/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const userId = Number(req.query.userId);
      const type = req.query.type;

      if (isNaN(id) || isNaN(userId))
        throw new AppError(400, "Invalid ID or User ID");

      let ok = false;
      if (type === "item") {
        ok = await storage.deleteItemReview(id, userId);
      } else if (type === "trip") {
        ok = await storage.deleteTripReview(id, userId);
      } else {
        // Fallback: try both if type not specified
        ok = await storage.deleteItemReview(id, userId);
        if (!ok) ok = await storage.deleteTripReview(id, userId);
      }

      if (!ok) throw new AppError(404, "Review not found");
      sendResponse(res, 200, "Review deleted successfully", null);
    }),
  );

  // ══════════════════════════════════════════════════════════════
  // CRUD: POIs (with type & opening hours enrichment)
  // ══════════════════════════════════════════════════════════════

  // Helper: resolve poitypeId from string type name (e.g. "attraction" → 1)
  async function resolvePoiTypeId(
    typeName: string | undefined,
  ): Promise<number | undefined> {
    if (!typeName) return undefined;
    const types = await storage.getPoiTypes();
    const found = types.find((t: any) => t.typeName === typeName);
    return found?.poitypeId;
  }

  async function resolveExpenseTypeId(
    typeName: string | undefined,
  ): Promise<number | undefined> {
    if (!typeName) return undefined;
    const types = await storage.getExpenseTypes();
    const typeMap: Record<string, string> = {
      transport: "Di chuyển",
      shopping: "Mua sắm",
      food: "Ăn uống",
      sightseeing: "Tham quan",
      other: "Khác",
    };
    const translated = typeMap[typeName] || typeName;
    const found = types.find(
      (t: any) =>
        t.name === translated ||
        t.name === typeName ||
        t.description === translated ||
        t.description === typeName,
    );
    return found?.expenseTypeId;
  }

  // Helper: enrich a raw POI row with type string + opening hours string
  async function enrichPoi(poi: any, allPoiTypes?: any[], allHours?: any[]) {
    const enriched: any = { ...poi };
    // Map poitypeId → type string
    if (poi.poitypeId) {
      const pt = allPoiTypes
        ? allPoiTypes.find((t: any) => t.poitypeId === poi.poitypeId)
        : await storage.getPoiType(poi.poitypeId);
      enriched.type = pt?.typeName || "other";
    } else {
      enriched.type = "other";
    }
    // Fetch opening hours from separate table and flatten to string
    try {
      const hours = allHours
        ? allHours.filter((h: any) => h.poiId === poi.poiId)
        : await storage.getPoiOpeningHours(poi.poiId);
      if (hours && hours.length > 0) {
        const dayNamesShort = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        const dayNamesFull = [
          "Chủ nhật",
          "Thứ 2",
          "Thứ 3",
          "Thứ 4",
          "Thứ 5",
          "Thứ 6",
          "Thứ 7",
        ];

        // Sort by dayOfWeek
        const sorted = hours.sort(
          (a: any, b: any) => a.dayOfWeek - b.dayOfWeek,
        );

        // If all days have same time, try to summarize as range
        const first = sorted[0];
        const allSame = sorted.every(
          (h: any) =>
            h.openTime === first.openTime && h.closeTime === first.closeTime,
        );

        if (allSame && sorted.length > 1) {
          const startDay = dayNamesFull[sorted[0].dayOfWeek];
          const endDay = dayNamesFull[sorted[sorted.length - 1].dayOfWeek];
          const openT = (first.openTime || "00:00").slice(0, 5);
          const closeT = (first.closeTime || "00:00").slice(0, 5);
          enriched.openHours = `${startDay} - ${endDay} | ${openT} - ${closeT}`;
        } else {
          // Fallback to legacy detailed format
          enriched.openHours = sorted
            .map(
              (h: any) =>
                `${dayNamesShort[h.dayOfWeek] || h.dayOfWeek}: ${(h.openTime || "?").slice(0, 5)}-${(h.closeTime || "?").slice(0, 5)}`,
            )
            .join(" | ");
        }
      }
    } catch (_e) {
      /* opening hours table may not exist yet */
    }
    return enriched;
  }

  // Helper: save opening hours string to poi_opening_hours table
  async function saveOpeningHours(
    poiId: number,
    openHoursStr: string | undefined,
  ) {
    if (!openHoursStr || !openHoursStr.trim()) return;
    // Clear existing hours for this POI
    try {
      await storage.deletePoiOpeningHours(poiId);
    } catch (_e) {
      /* ignore */
    }

    const trimmed = openHoursStr.trim();
    const dayMap: Record<string, number> = {
      CN: 0,
      "CHỦ NHẬT": 0,
      T2: 1,
      "THỨ 2": 1,
      T3: 2,
      "THỨ 3": 2,
      T4: 3,
      "THỨ 4": 3,
      T5: 4,
      "THỨ 5": 4,
      T6: 5,
      "THỨ 6": 5,
      T7: 6,
      "THỨ 7": 6,
    };

    // 1. Check for New Format: "Thứ 2 - Thứ 6 | 08:00 - 22:00"
    if (trimmed.includes("|")) {
      const [daysPart, timesPart] = trimmed.split("|").map((s) => s.trim());
      if (daysPart && timesPart) {
        const days = daysPart.split("-").map((s) => s.trim().toUpperCase());
        const times = timesPart.split("-").map((s) => s.trim());

        if (days.length >= 2 && times.length >= 2) {
          const startDayIdx = dayMap[days[0]] ?? 1;
          const endDayIdx = dayMap[days[1]] ?? 0;
          const openTime = times[0];
          const closeTime = times[1];

          // Handle range (wrapping around if needed, though usually sequential)
          let current = startDayIdx;
          const target = endDayIdx;
          const daysToSave = [];

          let safety = 0;
          while (safety < 10) {
            daysToSave.push(current);
            if (current === target) break;
            current = (current + 1) % 7;
            safety++;
          }

          for (const d of daysToSave) {
            try {
              await storage.createPoiOpeningHours({
                poiId,
                dayOfWeek: d,
                openTime,
                closeTime,
              });
            } catch (_e) { }
          }
          return;
        }
      }
    }

    // 2. Check for legacy day-specific format: "T2: 08:00-22:00 | T3: ..."
    const hasDayPrefix = /^(CN|T[2-7])\s*:/i.test(trimmed);
    if (hasDayPrefix) {
      const segments = trimmed.split("|").map((s: string) => s.trim());
      for (const seg of segments) {
        const match = seg.match(/^(CN|T[2-7])\s*:\s*(.+)$/i);
        if (match) {
          const dayIndex = dayMap[match[1].toUpperCase()] ?? 0;
          const timePart = match[2].trim();
          const times = timePart.split("-").map((t: string) => t.trim());
          try {
            await storage.createPoiOpeningHours({
              poiId,
              dayOfWeek: dayIndex,
              openTime: times[0] || null,
              closeTime: times[1] || null,
            });
          } catch (_e) {
            /* ignore duplicates */
          }
        }
      }
    } else {
      // 3. Simple format: "08:00 - 22:00" → apply to all 7 days
      const times = trimmed.split("-").map((t: string) => t.trim());
      const openTime = times[0] || null;
      const closeTime = times[1] || null;
      for (let day = 0; day < 7; day++) {
        try {
          await storage.createPoiOpeningHours({
            poiId,
            dayOfWeek: day,
            openTime,
            closeTime,
          });
        } catch (_e) {
          /* ignore duplicates */
        }
      }
    }
  }

  // Helper: prepare POI body for DB insert/update (resolve type → poitypeId)
  async function preparePoiData(body: any) {
    const data: any = { ...body };
    // Resolve type string to poitypeId
    if (data.type && !data.poitypeId) {
      const typeId = await resolvePoiTypeId(data.type);
      if (typeId) data.poitypeId = typeId;
    }
    // Extract openHours before saving (it's not a column in pois table)
    const openHoursStr = data.openHours;
    // Remove fields that don't exist in the pois table
    delete data.type;
    delete data.openHours;
    delete data.openingHours;
    delete data.reviewCount;
    delete data.isActive;
    delete data.googlePhotos;
    delete data.googleReviews;
    delete data.tags;
    delete data.priceLevel;
    delete data.estimatedDuration;
    // data.description is now a column in pois table
    delete data.images; // pois table has no images column
    delete data.category; // destinations-only field
    // Map reviewCount to reviewCounts if provided
    if (body.reviewCount !== undefined) data.reviewCounts = body.reviewCount;
    return { data, openHoursStr };
  }

  app.get(
    "/api/pois",
    asyncHandler(async (req, res) => {
      const destinationId = req.query.destinationId;
      const items = destinationId
        ? await storage.getPoisByDestination(Number(destinationId))
        : await storage.getPois();

      // Optimize: Fetch all types and opening hours once to avoid N+1 queries
      const [allTypes, allHours] = await Promise.all([
        storage.getPoiTypes(),
        storage.getBatchPoiOpeningHours(items.map(i => i.poiId))
      ]);

      const enriched = await Promise.all(items.map(poi => enrichPoi(poi, allTypes, allHours)));

      sendResponse(res, 200, "POIs retrieved successfully", enriched);
    }),
  );

  app.get(
    "/api/pois/:id",
    asyncHandler(async (req, res) => {
      const poi = await storage.getPoi(Number(req.params.id));
      if (!poi) throw new AppError(404, "POI not found");
      const enriched = await enrichPoi(poi);
      sendResponse(res, 200, "POI retrieved successfully", enriched);
    }),
  );

  app.post(
    "/api/pois",
    asyncHandler(async (req, res) => {
      const { data, openHoursStr } = await preparePoiData(req.body);
      const poi = await storage.createPoi(data);
      // Save opening hours to separate table
      if (openHoursStr) await saveOpeningHours(poi.poiId, openHoursStr);
      const enriched = await enrichPoi(poi);
      sendResponse(res, 201, "POI created successfully", enriched);
    }),
  );

  app.put(
    "/api/pois/:id",
    asyncHandler(async (req, res) => {
      const { data, openHoursStr } = await preparePoiData(req.body);
      // Remove id field if present to avoid conflicts
      delete data.id;
      delete data.poiId;
      const poi = await storage.updatePoi(Number(req.params.id), data);
      if (!poi) throw new AppError(404, "POI not found");
      // Save opening hours to separate table
      if (openHoursStr) await saveOpeningHours(poi.poiId, openHoursStr);
      const enriched = await enrichPoi(poi);
      sendResponse(res, 200, "POI updated successfully", enriched);
    }),
  );

  app.delete(
    "/api/pois/:id",
    asyncHandler(async (req, res) => {
      const ok = await storage.deletePoi(Number(req.params.id));
      if (!ok) throw new AppError(404, "POI not found");
      sendResponse(res, 200, "POI deleted successfully", null);
    }),
  );

  // ══════════════════════════════════════════════════════════════
  // Remaining CRUD (Mapped Dynamically or Condensed)
  // ══════════════════════════════════════════════════════════════

  app.get(
    "/api/destination-types",
    asyncHandler(async (_req, res) => {
      const items = await storage.getDestinationTypes();
      sendResponse(res, 200, "Types retrieved successfully", items);
    }),
  );

  app.post(
    "/api/destination-types",
    asyncHandler(async (req, res) => {
      const item = await storage.createDestinationType(req.body);
      sendResponse(res, 201, "Type created successfully", item);
    }),
  );

  app.put(
    "/api/destination-types/:id",
    asyncHandler(async (req, res) => {
      const item = await storage.updateDestinationType(Number(req.params.id), req.body);
      if (!item) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type updated successfully", item);
    }),
  );

  app.delete(
    "/api/destination-types/:id",
    asyncHandler(async (req, res) => {
      const ok = await storage.deleteDestinationType(Number(req.params.id));
      if (!ok) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type deleted successfully", null);
    }),
  );

  app.get(
    "/api/poi-types",
    asyncHandler(async (_req, res) => {
      const items = await storage.getPoiTypes();
      sendResponse(res, 200, "Types retrieved successfully", items);
    }),
  );

  app.post(
    "/api/poi-types",
    asyncHandler(async (req, res) => {
      const item = await storage.createPoiType(req.body);
      sendResponse(res, 201, "Type created successfully", item);
    }),
  );

  app.put(
    "/api/poi-types/:id",
    asyncHandler(async (req, res) => {
      const item = await storage.updatePoiType(Number(req.params.id), req.body);
      if (!item) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type updated successfully", item);
    }),
  );

  app.delete(
    "/api/poi-types/:id",
    asyncHandler(async (req, res) => {
      const ok = await storage.deletePoiType(Number(req.params.id));
      if (!ok) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type deleted successfully", null);
    }),
  );

  app.get(
    "/api/expense-types",
    asyncHandler(async (_req, res) => {
      const items = await storage.getExpenseTypes();
      sendResponse(res, 200, "Types retrieved successfully", items);
    }),
  );

  app.get(
    "/api/expense-types/:id",
    asyncHandler(async (req, res) => {
      const item = await storage.getExpenseType(Number(req.params.id));
      if (!item) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type retrieved successfully", item);
    }),
  );

  app.post(
    "/api/expense-types",
    asyncHandler(async (req, res) => {
      const item = await storage.createExpenseType(req.body);
      sendResponse(res, 201, "Type created successfully", item);
    }),
  );

  app.put(
    "/api/expense-types/:id",
    asyncHandler(async (req, res) => {
      const item = await storage.updateExpenseType(Number(req.params.id), req.body);
      if (!item) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type updated successfully", item);
    }),
  );

  app.delete(
    "/api/expense-types/:id",
    asyncHandler(async (req, res) => {
      const ok = await storage.deleteExpenseType(Number(req.params.id));
      if (!ok) throw new AppError(404, "Type not found");
      sendResponse(res, 200, "Type deleted successfully", null);
    }),
  );

  app.get(
    "/api/preferences",
    asyncHandler(async (_req, res) => {
      const items = await storage.getPreferences();
      sendResponse(res, 200, "Preferences retrieved successfully", items);
    }),
  );

  app.post(
    "/api/preferences",
    asyncHandler(async (req, res) => {
      const item = await storage.createPreference(req.body);
      sendResponse(res, 201, "Preference created successfully", item);
    }),
  );

  app.put(
    "/api/preferences/:id",
    asyncHandler(async (req, res) => {
      const item = await storage.updatePreference(Number(req.params.id), req.body);
      if (!item) throw new AppError(404, "Preference not found");
      sendResponse(res, 200, "Preference updated successfully", item);
    }),
  );

  app.delete(
    "/api/preferences/:id",
    asyncHandler(async (req, res) => {
      const success = await storage.deletePreference(Number(req.params.id));
      if (!success) throw new AppError(404, "Preference not found");
      sendResponse(res, 200, "Preference deleted successfully", null);
    }),
  );

  app.get(
    "/api/trips/:tripId/days",
    asyncHandler(async (req, res) => {
      const items = await storage.getItineraryDaysByTrip(
        Number(req.params.tripId),
      );
      sendResponse(res, 200, "Days retrieved successfully", items);
    }),
  );

  app.post(
    "/api/trips/:tripId/days",
    asyncHandler(async (req, res) => {
      const day = await storage.createItineraryDay({
        ...req.body,
        tripId: Number(req.params.tripId),
      });
      sendResponse(res, 201, "Day created successfully", day);
    }),
  );

  app.get(
    "/api/days/:dayId/items",
    asyncHandler(async (req, res) => {
      const items = await storage.getItineraryItemsByDay(
        Number(req.params.dayId),
      );
      sendResponse(res, 200, "Items retrieved successfully", items);
    }),
  );

  app.post(
    "/api/days/:dayId/items",
    asyncHandler(async (req, res) => {
      const item = await storage.createItineraryItem({
        ...req.body,
        dayId: Number(req.params.dayId),
      });
      sendResponse(res, 201, "Item created successfully", item);
    }),
  );

  app.get(
    "/api/trips/:tripId/expenses",
    asyncHandler(async (req, res) => {
      const items = await storage.getExpensesByTrip(Number(req.params.tripId));
      sendResponse(res, 200, "Expenses retrieved successfully", items);
    }),
  );

  app.post(
    "/api/trips/:tripId/expenses",
    asyncHandler(async (req, res) => {
      const trip = await storage.getTrip(Number(req.params.tripId));
      if (!trip) throw new AppError(404, "Trip not found");
      if (trip.status === "completed")
        throw new AppError(400, "Cannot add expense to a completed trip");

      const expense = await storage.createExpense({
        ...req.body,
        tripId: Number(req.params.tripId),
      });
      sendResponse(res, 201, "Expense created successfully", expense);
    }),
  );

  app.get(
    "/api/notifications",
    asyncHandler(async (req, res) => {
      const userId = req.query.userId;
      const items = userId
        ? await storage.getNotificationsByUser(Number(userId))
        : await storage.getNotifications();
      sendResponse(res, 200, "Notifications retrieved successfully", items);
    }),
  );

  app.post(
    "/api/notifications",
    asyncHandler(async (req, res) => {
      const notif = await storage.createNotification(req.body);
      sendResponse(res, 201, "Notification created successfully", notif);
    }),
  );

  app.put(
    "/api/notifications/:id",
    asyncHandler(async (req, res) => {
      const notif = await storage.updateNotification(
        Number(req.params.id),
        req.body,
      );
      if (!notif) throw new AppError(404, "Notification not found");
      sendResponse(res, 200, "Notification updated successfully", notif);
    }),
  );

  app.delete(
    "/api/notifications/:id",
    asyncHandler(async (req, res) => {
      const success = await storage.deleteNotification(Number(req.params.id));
      if (!success) throw new AppError(404, "Notification not found");
      sendResponse(res, 200, "Notification deleted successfully", null);
    }),
  );

  app.patch(
    "/api/notifications/mark-read",
    asyncHandler(async (req, res) => {
      const { userId } = req.body;
      if (!userId) throw new AppError(400, "userId is required");
      await storage.markNotificationsRead(Number(userId));
      sendResponse(res, 200, "All notifications marked as read", null);
    }),
  );

  const httpServer = createServer(app);
  return httpServer;
}
