import type { Express, Request, Response } from "express";
import { asyncHandler, sendResponse } from "../../lib/http";
import { AppError } from "../../lib/errors";
import { placesLimiter } from "../../middlewares/rate-limit";
import {
  GOOGLE_PLACES_BASE,
  GOOGLE_GEOCODE_BASE,
  GOOGLE_DIRECTIONS_BASE,
  GOONG_BASE,
  NOMINATIM_BASE,
  OSRM_BASE,
  SERPAPI_BASE,
  getGoogleKey,
  getGoongKey,
  getSerpApiKey,
  getActiveProvider,
  mapVehicleToMode,
} from "../../lib/api-keys";

// ══════════════════════════════════════════════════════════════
// SEARCH PLACES — SerpAPI → Google → Goong → Nominatim
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
      console.warn(`[Google] Search failed (${response.status}), trying fallback...`);
      return null;
    }

    const data = await response.json();
    if (!data.places || data.places.length === 0) return { places: [] };

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
      console.warn(`[Goong] Search failed (${response.status}), trying fallback...`);
      return null;
    }

    const data = await response.json();
    if (!data.predictions || data.predictions.length === 0) return { places: [] };

    const places = await Promise.all(
      data.predictions.slice(0, 10).map(async (pred: any) => {
        let latitude = 0;
        let longitude = 0;

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

    const extractPhotos = (r: any): { name: string; attributions: string[] }[] => {
      const photos: { name: string; attributions: string[] }[] = [];
      if (r.thumbnail) photos.push({ name: r.thumbnail, attributions: ["Google Maps"] });
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

    const places = results.slice(0, 10).map((r: any) => ({
      placeId: r.place_id || "",
      dataId: r.data_id || "",
      name: r.title || "",
      address: r.address || "",
      latitude: r.gps_coordinates?.latitude || 0,
      longitude: r.gps_coordinates?.longitude || 0,
      rating: r.rating || 0,
      reviewCount: r.reviews || 0,
      types: typeof r.type === "string" ? [r.type.toLowerCase().replace(/\s+/g, "_")] : [],
      primaryType: typeof r.type === "string" ? r.type.toLowerCase().replace(/\s+/g, "_") : "other",
      primaryTypeDisplay: (typeof r.type === "string" ? r.type : null) || "Địa điểm",
      editorialSummary: r.description || "",
      photos: extractPhotos(r),
      website: r.website || "",
      phone: r.phone || "",
      openNow: r.open_state === "Open" ? true : r.open_state === "Closed" ? false : null,
    }));

    if (places.length === 0 && data.place_results) {
      const r = data.place_results;
      let photos = extractPhotos(r);

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
        } catch { }
      }

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
              if (img.original) photos.push({ name: img.original, attributions: ["Google Images"] });
              else if (img.thumbnail) photos.push({ name: img.thumbnail, attributions: ["Google Images"] });
            });
            console.log(`[SerpAPI] 🖼️ Got ${photos.length} photos for "${r.title}" via google_images`);
          }
        } catch { }
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
        types: typeof r.type === "string" ? [r.type.toLowerCase().replace(/\s+/g, "_")] : [],
        primaryType: typeof r.type === "string" ? r.type.toLowerCase().replace(/\s+/g, "_") : "other",
        primaryTypeDisplay: (typeof r.type === "string" ? r.type : null) || "Địa điểm",
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

async function getPlaceDetailsSerpApi(placeId: string, language: string) {
  const apiKey = getSerpApiKey();
  if (!apiKey) return null;

  try {
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
    const r = data.place_results;
    if (!r) {
      console.warn(`[SerpAPI] No place_results found for place_id: "${placeId}"`);
      return null;
    }

    const photos: { name: string; attributions: string[] }[] = [];
    if (r.thumbnail) photos.push({ name: r.thumbnail, attributions: ["Google Maps"] });
    if (r.images && Array.isArray(r.images)) {
      r.images.slice(0, 4).forEach((img: any) => {
        const imgUrl = typeof img === "string" ? img : img?.thumbnail || img?.image;
        if (imgUrl && imgUrl !== r.thumbnail) {
          photos.push({ name: imgUrl, attributions: ["Google Maps"] });
        }
      });
    }

    const dataId = r.data_id;
    if (dataId) {
      try {
        const photoParams = new URLSearchParams({
          engine: "google_maps_photos",
          data_id: dataId,
          hl: language || "vi",
          api_key: apiKey,
        });
        const photoRes = await fetch(`${SERPAPI_BASE}?${photoParams.toString()}`);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          const hdPhotos = photoData.photos || [];
          hdPhotos.slice(0, 5).forEach((p: any) => {
            const imgUrl = p.image || p.thumbnail;
            if (imgUrl) photos.push({ name: imgUrl, attributions: ["Google Maps"] });
          });
          console.log(`[SerpAPI] 📸 Got ${hdPhotos.length} HD photos for "${r.title}"`);
        }
      } catch { }
    }

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
            if (img.original) photos.push({ name: img.original, attributions: ["Google Images"] });
            else if (img.thumbnail) photos.push({ name: img.thumbnail, attributions: ["Google Images"] });
          });
          console.log(`[SerpAPI] 🖼️ Got ${photos.length} fallback photos for "${r.title}" via google_images`);
        }
      } catch { }
    }

    let reviews: any[] = [];
    const reviewPlaceId = r.place_id || placeId;
    try {
      const reviewParams = new URLSearchParams({
        engine: "google_maps_reviews",
        place_id: reviewPlaceId,
        hl: language || "vi",
        api_key: apiKey,
      });
      const reviewRes = await fetch(`${SERPAPI_BASE}?${reviewParams.toString()}`);
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
    } catch { }

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
      types: typeof r.type === "string" ? [r.type.toLowerCase().replace(/\s+/g, "_")] : [],
      primaryType: typeof r.type === "string" ? r.type.toLowerCase().replace(/\s+/g, "_") : "other",
      primaryTypeDisplay: (typeof r.type === "string" ? r.type : null) || "Địa điểm",
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

async function getSerpPhotos(req: Request, res: Response) {
  const dataId = req.params.dataId as string;
  if (!dataId) throw new AppError(400, "dataId parameter is required");

  const apiKey = getSerpApiKey();
  if (!apiKey) throw new AppError(501, "SERPAPI_KEY not configured");

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
    const data = await response.json();
    if (!response.ok) {
      console.warn(`[SerpAPI] Photos failed (${response.status}):`, data);
      return res.status(response.status).json({ error: "SerpAPI photos request failed" });
    }

    const photos = (data.photos || []).map((p: any) => ({
      thumbnail: p.thumbnail || "",
      image: p.image || p.thumbnail || "",
    }));

    console.log(`[SerpAPI] ✅ Got ${photos.length} photos for data_id=${dataId}`);
    return res.json({ photos });
  } catch (error) {
    console.error("[SerpAPI] Photos error:", error);
    throw new AppError(500, "Failed to fetch photos");
  }
}

async function searchPlaces(req: Request, res: Response) {
  const query = req.query.query as string;
  const language = (req.query.language as string) || "vi";
  if (!query) throw new AppError(400, "Query parameter is required");

  const serpResult = await searchPlacesSerpApi(query);
  if (serpResult && serpResult.places && serpResult.places.length > 0) return res.json(serpResult);

  const googleResult = await searchPlacesGoogle(query, language);
  if (googleResult) return res.json(googleResult);

  const goongResult = await searchPlacesGoong(query, language);
  if (goongResult && goongResult.places && goongResult.places.length > 0) return res.json(goongResult);

  const nominatimResult = await searchPlacesNominatim(query, language);
  return res.json(nominatimResult);
}

// ══════════════════════════════════════════════════════════════
// PLACE DETAILS — SerpAPI → Google → Goong → Nominatim
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
  const osmId = placeId.replace("nominatim_", "");
  try {
    const url = `${NOMINATIM_BASE}/lookup?osm_ids=N${osmId},W${osmId},R${osmId}&format=json&accept-language=${language}&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TravelPlannerPro/1.0" },
    });

    if (!response.ok || !(await response.clone().json()).length) {
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
  if (!placeId) throw new AppError(400, "placeId parameter is required");

  const serpResult = await getPlaceDetailsSerpApi(placeId, language);
  if (serpResult) return res.json(serpResult);

  const googleResult = await getPlaceDetailsGoogle(placeId, language);
  if (googleResult) return res.json(googleResult);

  const goongResult = await getPlaceDetailsGoong(placeId, language);
  if (goongResult) return res.json(goongResult);

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
  if (!address) throw new AppError(400, "address parameter is required");

  const googleResult = await geocodeGoogle(address);
  if (googleResult) return res.json(googleResult);

  const goongResult = await geocodeGoong(address);
  if (goongResult) return res.json(goongResult);

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
    let originCoords = origin;
    let destCoords = destination;
    const coordRegex = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;

    const origMatch = origin.match(coordRegex);
    if (origMatch) {
      originCoords = `${origMatch[2]},${origMatch[1]}`;
    } else {
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

    const route = data.routes[0];
    const result = {
      status: "OK",
      routes: [
        {
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
          overview_polyline: { points: "" },
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
    return res.status(400).json({ error: "origin and destination are required" });
  }

  const googleResult = await directionsGoogle(origin, destination, vehicle);
  if (googleResult) return res.json(googleResult);

  const goongResult = await directionsGoong(origin, destination, vehicle);
  if (goongResult) return res.json(goongResult);

  const osrmResult = await directionsOSRM(origin, destination);
  if (osrmResult) return res.json(osrmResult);

  return res.json({ routes: [] });
}

// ══════════════════════════════════════════════════════════════
// PLACE PHOTO — SerpAPI HD → Google → Unsplash fallback
// ══════════════════════════════════════════════════════════════

async function getPlacePhoto(req: Request, res: Response) {
  const photoName = req.query.name as string;
  const maxWidth = parseInt(req.query.maxWidth as string) || 800;
  const dataId = req.query.data_id as string;

  if (!photoName && !dataId) {
    return res.status(400).json({ error: "Photo name or data_id parameter is required" });
  }

  if (photoName && photoName.startsWith("http")) return res.redirect(photoName);

  try {
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
          const serpRes = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
          if (serpRes.ok) {
            const serpData = await serpRes.json();
            const photos = serpData.photos || [];
            if (photos.length > 0) {
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

    const searchTerm = photoName || "travel landscape";
    const url = `https://source.unsplash.com/${maxWidth}x${Math.round(maxWidth * 0.66)}/?${encodeURIComponent(searchTerm + " travel landscape")}`;
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch photo" });

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
// PROVIDER STATUS
// ══════════════════════════════════════════════════════════════

function getProviderStatus(_req: Request, res: Response) {
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
// PLACE REVIEWS via SerpAPI
// ══════════════════════════════════════════════════════════════

async function getPlaceReviewsSerpApi(req: Request, res: Response) {
  const placeId = req.query.place_id as string;
  const q = req.query.q as string;
  const fallbackQ = req.query.fallback_q as string;
  const nextPageToken = req.query.next_page_token as string | undefined;

  if (!placeId && !q) throw new AppError(400, "place_id or q parameter is required");
  const apiKey = getSerpApiKey();
  if (!apiKey) throw new AppError(501, "SERPAPI_KEY not configured");

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

    if (placeId) {
      console.log(`[SerpAPI] Fetching reviews for place_id=${placeId}`);
      data = await fetchReviewsForId(placeId, nextPageToken);
    }

    const hasNoReviews = !data || (data.reviews || []).length === 0;
    const canSearch = (q || fallbackQ) && !nextPageToken;

    if (hasNoReviews && canSearch) {
      const searchQuery = q || fallbackQ;
      console.log(`[SerpAPI] Falling back to search for: "${searchQuery}"`);
      const searchParams = new URLSearchParams({
        engine: "google_maps",
        q: searchQuery,
        hl: "vi",
        api_key: apiKey,
      });
      const searchRes = await fetch(`${SERPAPI_BASE}?${searchParams.toString()}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const firstResultId =
          searchData.place_id ||
          (searchData.local_results && searchData.local_results[0]?.place_id);
        if (firstResultId && firstResultId !== placeId) {
          console.log(`[SerpAPI] Resolved "${searchQuery}" to new place_id=${firstResultId}`);
          data = await fetchReviewsForId(firstResultId);
        }
      }
    }

    if (!data) {
      console.warn(`[SerpAPI] No reviews found for place_id="${placeId}" or query="${q || fallbackQ}"`);
      return res.json({ placeInfo: null, reviews: [], nextPageToken: null, message: "No reviews found for this location" });
    }

    if (data.error && data.error.includes("run out of searches")) {
      return res.status(429).json({ error: "SerpAPI quota exceeded", status: 429 });
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
        ? { snippet: r.response.snippet || r.response.extracted_snippet?.original || "", date: r.response.date || "" }
        : null,
    }));

    const nextToken = data.serpapi_pagination?.next_page_token || null;
    console.log(`[SerpAPI] Got ${reviews.length} reviews for "${placeInfo?.title || placeId}"`);
    return res.json({ placeInfo, reviews, nextPageToken: nextToken });
  } catch (error) {
    console.error("[SerpAPI] Reviews error:", error);
    throw new AppError(500, "Failed to fetch reviews");
  }
}

// ══════════════════════════════════════════════════════════════
// AUTO-DISCOVER nearby POIs (restaurants + attractions)
// ══════════════════════════════════════════════════════════════

async function autoDiscoverPOIs(req: Request, res: Response) {
  const query = req.query.query as string;
  const lat = parseFloat(req.query.lat as string) || 0;
  const lng = parseFloat(req.query.lng as string) || 0;
  if (!query) throw new AppError(400, "Query is required");

  const apiKey = getSerpApiKey();
  if (!apiKey) return res.json({ restaurants: [], attractions: [] });

  try {
    const restaurantParams = new URLSearchParams({
      engine: "google_maps",
      q: `nhà hàng quán ăn gần ${query}`,
      hl: "vi",
      type: "search",
      api_key: apiKey,
    });
    if (lat && lng) restaurantParams.set("ll", `@${lat},${lng},14z`);

    const attractionParams = new URLSearchParams({
      engine: "google_maps",
      q: `điểm tham quan du lịch gần ${query}`,
      hl: "vi",
      type: "search",
      api_key: apiKey,
    });
    if (lat && lng) attractionParams.set("ll", `@${lat},${lng},14z`);

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
      openHours: r.operating_hours
        ? Object.entries(r.operating_hours).map(([day, hours]) => `${day}: ${hours}`).join(" | ")
        : typeof r.hours === "string" ? r.hours : "",
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

    restaurants.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
    attractions.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));

    console.log(`[AutoDiscover] Found ${restaurants.length} restaurants, ${attractions.length} attractions near "${query}"`);
    return res.json({ restaurants, attractions });
  } catch (error) {
    console.warn("[AutoDiscover] Error:", error);
    return res.json({ restaurants: [], attractions: [] });
  }
}

// ══════════════════════════════════════════════════════════════
// Register all places routes
// ══════════════════════════════════════════════════════════════

export function registerPlacesRoutes(app: Express) {
  app.get("/api/places/provider", getProviderStatus);
  app.get("/api/places/search", placesLimiter, asyncHandler(searchPlaces));
  app.get("/api/places/details/:placeId", placesLimiter, asyncHandler(getPlaceDetails));
  app.get("/api/places/photo", placesLimiter, asyncHandler(getPlacePhoto));
  app.get("/api/places/serp-photos/:dataId", placesLimiter, asyncHandler(getSerpPhotos));
  app.get("/api/places/geocode", placesLimiter, asyncHandler(geocodeAddress));
  app.get("/api/places/directions", placesLimiter, asyncHandler(getDirections));
  app.get("/api/places/reviews", placesLimiter, asyncHandler(getPlaceReviewsSerpApi));
  app.get("/api/places/auto-discover", placesLimiter, asyncHandler(autoDiscoverPOIs));
}
