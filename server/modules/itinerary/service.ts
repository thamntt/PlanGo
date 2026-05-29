import OpenAI from "openai";
import { storage } from "../../storage";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { env } from "../../lib/env";
import { SERPAPI_BASE, getSerpApiKey } from "../../lib/api-keys";
import { internalGeocode } from "../../lib/geocode";
import { extractPlaceName, associatePreferencesToPoi } from "../../lib/itinerary-helpers";
import type { GenerateItineraryInput } from "./schema";

const PROVINCE_MAP: Record<string, string> = {
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

function computeNumDays(startDate: string, endDate: string): number {
  const parseDate = (d: string) => {
    const parts = d.split(/[-/]/);
    if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(d);
  };
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function buildPrompt(input: GenerateItineraryInput, numDays: number, province: string): string {
  const { destination, startDate, endDate, totalBudget, numPeople, preferences } = input;
  const prefsText = preferences && preferences.length > 0 ? preferences.join(", ") : "";
  const budgetPerDay = totalBudget ? Math.round(totalBudget / numDays) : 0;

  return `Bạn là chuyên gia du lịch Việt Nam. Tạo lịch trình du lịch ${numDays} ngày tại ${destination} (tỉnh/thành phố: ${province}).

=== THÔNG TIN CHUYẾN ĐI ===
- Điểm đến: ${destination} (${province})
- Ngày đi: ${startDate} → ${endDate} (${numDays} ngày)
- Số người: ${numPeople || 2}
- Tổng ngân sách: ${totalBudget ? totalBudget.toLocaleString("vi-VN") + "đ" : "không giới hạn"} (≈${budgetPerDay > 0 ? budgetPerDay.toLocaleString("vi-VN") + "đ/ngày" : "tùy ý"})
- Sở thích: ${prefsText || "đa dạng"}

=== CHECKLIST BẮT BUỘC ===
Mỗi ngày PHẢI có ĐỦ:
[ ] 1 bữa sáng lúc 07:30
[ ] 2-3 hoạt động buổi sáng (08:15 - 11:30)
[ ] 1 bữa trưa lúc 11:30-12:00
[ ] 2-3 hoạt động buổi chiều (14:00 - 17:30)
[ ] 1 bữa tối lúc 19:00-20:00
[ ] 1 hoạt động buổi tối (20:30 trở đi)
TỔNG: 8-10 activities mỗi ngày.

=== QUY TẮC ĐỊA ĐIỂM ===
- 100% địa điểm PHẢI nằm trong ${province}.
- Tên địa điểm dùng TÊN CHÍNH XÁC trên Google Maps, kèm tên thành phố.
- Chỉ dùng địa điểm có thật, KHÔNG bịa tên.
- Khoảng cách 2 địa điểm liền kề KHÔNG quá 15km. Tổng 1 ngày KHÔNG quá 40km.

=== QUY TẮC SỞ THÍCH (${prefsText || "đa dạng"}) ===
${prefsText?.includes("Biển") || prefsText?.includes("Thiên nhiên") ? "- Ưu tiên bãi biển, đảo, công viên biển." : ""}
${prefsText?.includes("Văn hóa") || prefsText?.includes("Lịch sử") ? "- Ưu tiên đền chùa, bảo tàng, di tích lịch sử." : ""}
${prefsText?.includes("Ẩm thực") ? "- Ưu tiên quán ăn đặc sản nổi tiếng." : ""}
${prefsText?.includes("Giải trí đêm") || prefsText?.includes("Mua sắm") ? "- Bắt buộc có chợ đêm/bar/phố đi bộ sau 20:30." : ""}
${prefsText?.includes("Nhiếp ảnh") || prefsText?.includes("Núi") ? "- Ưu tiên điểm check-in view đẹp." : ""}
${prefsText?.includes("Phiêu lưu") ? "- Ưu tiên trekking, lặn biển, trò chơi cảm giác mạnh." : ""}
- KHÔNG xếp 2 bữa ăn liên tiếp không có hoạt động ở giữa.

=== QUY TẮC NGÂN SÁCH & THỜI GIAN ===
- estimatedCost tính cho ${numPeople || 2} người. Tổng cả chuyến trong khoảng ${totalBudget ? (totalBudget * 0.85).toLocaleString("vi-VN") + "đ - " + totalBudget.toLocaleString("vi-VN") + "đ" : "hợp lý"}.
- Thời gian HH:MM phải logic. Tham quan: 1-2 tiếng/điểm. Ăn: 1 tiếng/bữa.

=== FORMAT JSON OUTPUT (CHỈ JSON) ===
{ "days": [ { "day": 1, "title": "...", "activities": [ { "time":"07:30","title":"...","description":"...","duration":"1 giờ","estimatedCost":120000,"activityType":"food" } ] } ] }
activityType: "food" | "sightseeing" | "transport" | "shopping" | "hotel" | "other"`;
}

async function callGemini(prompt: string, retries = 3): Promise<any> {
  if (!env.GEMINI_API_KEY) throw new AppError("AI_PROVIDER_UNAVAILABLE", "GEMINI_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${env.GEMINI_API_KEY}`;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) throw new Error("Empty Gemini response");
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in Gemini response");
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed || !parsed.days) throw new Error("Invalid Gemini structure");
        return parsed;
      }
      const errorText = await res.text();
      logger.warn({ status: res.status, errorText }, "Gemini failed");
      if (res.status === 503 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(errorText);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Gemini failed after retries");
}

async function callOpenAI(prompt: string): Promise<any> {
  if (!env.OPENAI_API_KEY) throw new AppError("AI_PROVIDER_UNAVAILABLE", "OPENAI_API_KEY not configured");
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Bạn là chuyên gia du lịch Việt Nam. BẮT BUỘC trả về JSON hợp lệ duy nhất theo format: { days: [...] }. KHÔNG markdown, KHÔNG giải thích." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI empty response");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in OpenAI response");
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed || !parsed.days) throw new Error("Invalid OpenAI structure");
  return parsed;
}

async function enrichActivitiesWithSerpApi(activities: any[], destination: string, province: string, destLat: number, destLng: number): Promise<boolean> {
  const serpApiKey = getSerpApiKey();
  if (!serpApiKey) return false;

  const locationBias = destLat && destLng ? `@${destLat},${destLng},14z` : "";
  let quotaExceeded = false;

  for (const act of activities) {
    if (quotaExceeded) break;
    const titleLower = act.title.toLowerCase();
    if (titleLower.includes("chi phí") || titleLower.includes("di chuyển") || titleLower.includes("tổng kết")) continue;

    const placeName = extractPlaceName(act.title);
    const baseName = placeName.length > 3 ? placeName : act.title;
    const city = destination || province || "";
    const searchQuery = baseName.toLowerCase().includes(city.toLowerCase()) ? baseName.trim() : `${baseName} ${city}`.trim();

    try {
      const params = new URLSearchParams({ engine: "google_maps", q: searchQuery, hl: "vi", type: "search", api_key: serpApiKey });
      if (locationBias) params.set("ll", locationBias);
      const serpRes = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
      const data = await serpRes.json();
      if (serpRes.ok) {
        const results = data.local_results || [];
        if (results.length > 0) {
          const match = results.find((r: any) =>
            r.address?.toLowerCase().includes(destination.toLowerCase()) ||
            r.address?.toLowerCase().includes((province || "").toLowerCase()),
          ) || results[0];

          if (match.gps_coordinates?.latitude) {
            act.latitude = match.gps_coordinates.latitude;
            act.longitude = match.gps_coordinates.longitude;
          }
          if (match.address) act.address = match.address;
          if (match.rating) act.rating = match.rating;
          if (match.reviews) act.reviewCount = match.reviews;
          if (match.place_id) act.googlePlaceId = match.place_id;
          if (match.thumbnail) act.thumbnail = match.thumbnail;
          if (match.title) act.description = `${match.title} — ★ ${match.rating || "N/A"}/5. ${act.description || ""}`.trim();
          act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${act.latitude},${act.longitude}`;
        }
      } else if ((data as any)?.error?.includes("quota")) {
        quotaExceeded = true;
      }
    } catch (err) {
      logger.warn({ err, title: act.title }, "SerpAPI enrichment failed");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return quotaExceeded;
}

async function fallbackGeocodeActivities(activities: any[], destination: string, province: string, destLat: number, destLng: number, quotaExceeded: boolean) {
  const serpApiKey = getSerpApiKey();
  const locationBias = destLat && destLng ? `@${destLat},${destLng},14z` : "";

  for (const act of activities) {
    const hasCoords = act.latitude && act.latitude !== 0 && act.latitude !== "0";
    const isTrash = act.title.toLowerCase().includes("chi phí") || act.title.toLowerCase().includes("di chuyển");
    if (hasCoords || isTrash) continue;

    try {
      const placeName = extractPlaceName(act.title);
      const query = `${placeName} ${destination}`;
      const geo = await internalGeocode(query);
      if (geo && geo.lat) {
        act.latitude = geo.lat;
        act.longitude = geo.lng;
        if (!act.address) act.address = geo.formattedAddress;
        act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`;
      } else if (destLat && destLng) {
        act.latitude = destLat;
        act.longitude = destLng;
        act.noExactCoords = true;
      }

      if (serpApiKey && !quotaExceeded) {
        try {
          const params = new URLSearchParams({ engine: "google_maps", q: query, hl: "vi", type: "search", api_key: serpApiKey });
          if (locationBias) params.set("ll", locationBias);
          const serpRes = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
          const data = await serpRes.json();
          if (serpRes.ok) {
            const results = data.local_results || [];
            if (results.length > 0) {
              const match = results.find((r: any) =>
                r.address?.toLowerCase().includes(destination.toLowerCase()) ||
                r.address?.toLowerCase().includes((province || "").toLowerCase()),
              ) || results[0];
              if (match.rating) act.rating = match.rating;
              if (match.reviews) act.reviewCount = match.reviews;
              if (match.place_id) act.googlePlaceId = match.place_id;
              if (match.thumbnail) act.thumbnail = match.thumbnail;
              if (match.gps_coordinates?.latitude && !act.latitude) {
                act.latitude = match.gps_coordinates.latitude;
                act.longitude = match.gps_coordinates.longitude;
              }
              if (match.title) act.description = `${match.title} — ★ ${match.rating || "N/A"}/5. ${act.description || ""}`.trim();
            }
          } else if ((data as any)?.error?.includes("quota")) {
            quotaExceeded = true;
          }
        } catch { /* SerpAPI rating optional */ }
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      logger.warn({ err, title: act.title }, "Geocode fallback failed");
    }
  }
}

async function linkPoisAndCleanup(parsedData: any) {
  if (!parsedData?.days) return;
  const mappedDays: any[] = [];
  for (const day of parsedData.days) {
    const filteredActs = day.activities.filter((act: any) => {
      const t = act.title.toLowerCase();
      return !(t.includes("chi phí") || t.includes("di chuyển") || t.includes("tổng kết"));
    });
    for (const act of filteredActs) {
      try {
        const pName = extractPlaceName(act.title);
        const createdPoi = act.googlePlaceId
          ? await storage.getPoiByGooglePlaceId(act.googlePlaceId)
          : await storage.getPoiByName(pName);
        const specificType = act.placeType || act.activityType;
        act.activityType = specificType;
        if (createdPoi?.poiId) {
          act.poiId = createdPoi.poiId;
          await associatePreferencesToPoi(createdPoi.poiId, act.activityType, act.title, act.description);
        }
      } catch (err) {
        logger.warn({ err, title: act.title }, "Failed to link POI");
      }
    }
    mappedDays.push({
      ...day,
      title: day.title || `Ngày ${day.day}`,
      activities: filteredActs.length > 0 ? filteredActs : day.activities,
    });
  }
  parsedData.days = mappedDays;
}

async function persistPois(activities: any[], destination: string) {
  let resolvedDestId: number | null = null;
  const destRecord = await storage.getDestinationByName(destination);
  if (destRecord) resolvedDestId = destRecord.destinationId;

  for (const act of activities) {
    if (!act.latitude || act.latitude === 0) continue;
    try {
      const pName = extractPlaceName(act.title);
      const existingPoi = act.googlePlaceId
        ? await storage.getPoiByGooglePlaceId(act.googlePlaceId)
        : await storage.getPoiByName(pName);
      if (!existingPoi) {
        await storage.createPoi({
          destinationId: resolvedDestId || undefined,
          name: pName,
          address: act.address || "",
          latitude: String(act.latitude),
          longitude: String(act.longitude),
          rating: act.rating ? String(act.rating) : "0",
          googlePlaceId: act.googlePlaceId,
        });
      }
    } catch (err) {
      logger.warn({ err }, "POI persist failed");
    }
  }
}

export async function generateItinerary(input: GenerateItineraryInput): Promise<any> {
  const numDays = computeNumDays(input.startDate, input.endDate);
  const destKey = input.destination.toLowerCase().trim();
  const province = PROVINCE_MAP[destKey] || input.destination;
  const prompt = buildPrompt(input, numDays, province);

  let activeProvider = "gemini";
  let parsedData: any;

  try {
    logger.info("⚡ Using Gemini for itinerary generation");
    parsedData = await callGemini(prompt);
    parsedData.provider = "gemini";
  } catch (err) {
    logger.warn({ err }, "Gemini failed → fallback to OpenAI");
    activeProvider = "openai";
    try {
      parsedData = await callOpenAI(prompt);
      parsedData.provider = "openai";
    } catch (openErr) {
      logger.error({ err: openErr }, "OpenAI also failed");
      throw new AppError("AI_PROVIDER_UNAVAILABLE", "Both Gemini and OpenAI failed", { details: String(openErr) });
    }
  }

  if (!parsedData?.days || !Array.isArray(parsedData.days)) {
    throw new AppError("AI_RESPONSE_INVALID", "Invalid AI response structure");
  }

  // Flatten + enrich all activities
  const allActivities: any[] = [];
  for (const day of parsedData.days) {
    if (!day.activities) day.activities = [];
    day.title = day.title || `Ngày ${day.day}`;
    for (const act of day.activities) {
      act.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      act.isCompleted = false;
      act.estimatedCost = act.estimatedCost || 0;
      act.activityType = act.activityType || "sightseeing";
      act.duration = act.duration || "1 giờ";
      allActivities.push(act);
    }
  }

  const destGeo = await internalGeocode(input.destination);
  const destLat = destGeo?.lat ?? 0;
  const destLng = destGeo?.lng ?? 0;

  const quotaExceeded = await enrichActivitiesWithSerpApi(allActivities, input.destination, province, destLat, destLng);
  await fallbackGeocodeActivities(allActivities, input.destination, province, destLat, destLng, quotaExceeded);
  await linkPoisAndCleanup(parsedData);
  await persistPois(allActivities, input.destination);

  return { ...parsedData, provider: activeProvider };
}
