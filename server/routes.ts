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

// POST /api/generate-itinerary — generate itinerary via Gemini AI
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
      const parts = d.split("/");
      if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return new Date(d);
    };
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const numDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const budgetPerDay = totalBudget ? Math.round(totalBudget / numDays) : 0;
    const budgetPerDayPerPerson = totalBudget ? Math.round(totalBudget / numDays / (numPeople || 2)) : 0;

    const prompt = `Bạn là chuyên gia du lịch Việt Nam với kiến thức sâu về Google Maps. Tạo lịch trình ${numDays} ngày tại ${destination}.

THÔNG TIN:
- Điểm đến: ${destination}
- Ngày: ${startDate} → ${endDate} (${numDays} ngày)
- Số người: ${numPeople || 2}
- Tổng ngân sách: ${totalBudget ? totalBudget.toLocaleString("vi-VN") + "đ" : "không giới hạn"} (≈${budgetPerDay > 0 ? budgetPerDay.toLocaleString("vi-VN") + "đ/ngày" : "tùy ý"})
${prefsText ? `- Sở thích: ${prefsText}` : ""}
${startingPoint ? `- Xuất phát: ${startingPoint}` : ""}

QUY TẮC BẮT BUỘC:
1. CHỈ gợi ý những địa điểm, nhà hàng, quán ăn CÓ THẬT và NỔI TIẾNG tại ${destination}. Dùng ĐÚNG TÊN trên Google Maps.
2. Mỗi ngày có 6 hoạt động xen kẽ: Ăn sáng → Tham quan sáng → Ăn trưa → Tham quan chiều → Ăn tối → Hoạt động tối
3. NGÂN SÁCH: Tổng estimatedCost tất cả các ngày PHẢI nằm trong khoảng ${totalBudget ? (totalBudget * 0.85).toLocaleString("vi-VN") + "đ - " + (totalBudget * 1.0).toLocaleString("vi-VN") + "đ" : "hợp lý"}. estimatedCost đã tính cho ${numPeople || 2} người.
4. "description" phải giới thiệu ngắn gọn về địa điểm: nổi tiếng vì gì, đặc sản gì, nên thử gì.
5. "rating" là điểm đánh giá Google Maps thực tế (1.0-5.0), ví dụ 4.2, 4.6. PHẢI chính xác.
6. "address" phải là ĐỊA CHỈ ĐẦY ĐỦ bao gồm số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố.
7. "latitude" và "longitude" phải CHÍNH XÁC tọa độ GPS của địa điểm.
8. Thời gian: 07:00, 08:30, 12:00, 14:00, 18:00, 20:00
${prefsText ? `9. ƯU TIÊN hoạt động liên quan: ${prefsText}` : ""}

JSON format (KHÔNG markdown):
{
  "days": [
    {
      "day": 1,
      "title": "Ngày 1 - Đến nơi & Khám phá",
      "activities": [
        {
          "time": "07:00",
          "title": "Ăn sáng tại Phở Bát Đàn",
          "description": "Quán phở nổi tiếng hơn 30 năm, luôn xếp hàng dài. Nước dùng ngọt thanh, thịt bò tươi mềm. Rating 4.4 trên Google Maps.",
          "duration": "1 giờ",
          "estimatedCost": 120000,
          "activityType": "food",
          "address": "49 Bát Đàn, Cửa Đông, Hoàn Kiếm, Hà Nội",
          "latitude": 21.0335,
          "longitude": 105.8468,
          "rating": 4.4
        }
      ]
    }
  ]
}

activityType: "food" | "sightseeing" | "transport" | "shopping" | "other"
estimatedCost: số nguyên VND, đã tính cho ${numPeople || 2} người.
rating: số thập phân 1.0-5.0 từ Google Maps.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
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
    for (const day of parsed.days) {
      if (!day.activities) day.activities = [];
      for (const act of day.activities) {
        act.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        act.isCompleted = false;
        act.estimatedCost = act.estimatedCost || 0;
        act.activityType = act.activityType || "sightseeing";
        act.duration = act.duration || "1 giờ";
        act.rating = act.rating || undefined;
        // Generate Google Maps URL from coordinates or address
        if (act.latitude && act.longitude) {
          act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${act.latitude},${act.longitude}`;
        } else if (act.address) {
          act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.title + " " + act.address)}`;
        }
        totalEstimated += act.estimatedCost;
      }
    }

    // Budget scaling: if total is way off budget, scale proportionally
    if (totalBudget && totalEstimated > 0) {
      const ratio = totalBudget / totalEstimated;
      if (ratio < 0.7 || ratio > 1.3) {
        // Scale all costs to fit budget (between 85%-100%)
        const targetTotal = totalBudget * 0.92;
        const scale = targetTotal / totalEstimated;
        for (const day of parsed.days) {
          for (const act of day.activities) {
            act.estimatedCost = Math.round(act.estimatedCost * scale / 1000) * 1000; // Round to nearest 1000
          }
        }
      }
    }

    return res.json(parsed);
  } catch (error) {
    console.error("Generate itinerary error:", error);
    return res.status(500).json({ error: "Failed to generate itinerary" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Places search routes (Nominatim/OpenStreetMap)
  app.get("/api/places/search", searchPlaces);
  app.get("/api/places/details/:placeId", getPlaceDetails);
  app.get("/api/places/photo", getPlacePhoto);

  // AI Itinerary generation
  app.post("/api/generate-itinerary", generateItineraryAI);

  // Share trip routes
  app.post("/api/share", shareTrip);
  app.get("/api/share/:code", getSharedTrip);
  app.post("/api/share/join", joinSharedTrip);
  app.patch("/api/share/companion", updateCompanionRole);
  app.delete("/api/share/companion", removeCompanion);

  const httpServer = createServer(app);
  return httpServer;
}

