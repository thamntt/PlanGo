import OpenAI from "openai";
import { storage } from "../../storage";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { env } from "../../lib/env";
import { SERPAPI_BASE, getSerpApiKey } from "../../lib/api-keys";
import { internalGeocode } from "../../lib/geocode";
import { extractPlaceName, associatePreferencesToPoi } from "../../lib/itinerary-helpers";
import { getCachedItinerary, setCachedItinerary } from "../../lib/ai-cache";
import type { GenerateItineraryInput } from "./schema";
import { db } from "../../db";
import { pois, destinations as destTbl, poiType } from "../../../shared/schema";
import { and, eq, gte, lte, isNull, or, ilike, desc, sql } from "drizzle-orm";

interface SeedPoi {
  name: string;
  poiType: string | null;
  rating: number;
  estimatedCost: number | null;
  address: string | null;
}

/**
 * Option D — fetch pre-enriched DB POIs as HINTS for the AI prompt.
 * Filters by destination + preference category + estimated cost ≤ user's
 * per-activity budget × 1.2 (20% flex). Result is INJECTED into the prompt
 * as suggestions; AI is free to use them or invent new ones. Activities
 * generated whose names fuzzy-match these POIs skip SerpAPI on enrichment.
 */
async function fetchSeedPois(
  destinationName: string,
  preferences: string[] | undefined,
  budgetPerCategoryVnd: number,
  maxRows = 20,
): Promise<SeedPoi[]> {
  try {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
    const targetDest = norm(destinationName);
    // Find destinationId by name match
    const destRows = await db
      .select({ destinationId: destTbl.destinationId, name: destTbl.name })
      .from(destTbl)
      .limit(50);
    const matched = destRows.find((d) => norm(d.name) === targetDest);
    if (!matched) return [];

    const conds: any[] = [eq(pois.destinationId, matched.destinationId)];
    // Budget filter — keep POIs without cost (null) or within 1.2× per-cat budget
    if (budgetPerCategoryVnd > 0) {
      conds.push(
        or(
          isNull(pois.estimatedCost),
          lte(pois.estimatedCost, String(Math.round(budgetPerCategoryVnd * 1.2))),
        ),
      );
    }
    // Quality floor — only well-rated POIs
    conds.push(or(isNull(pois.rating), gte(pois.rating, "4.0")));

    const rows = await db
      .select({
        name: pois.name,
        rating: pois.rating,
        estimatedCost: pois.estimatedCost,
        address: pois.address,
        typeName: poiType.typeName,
      })
      .from(pois)
      .leftJoin(poiType, eq(pois.poitypeId, poiType.poitypeId))
      .where(and(...conds))
      .orderBy(desc(pois.reviewCounts))
      .limit(maxRows);

    return rows.map((r) => ({
      name: r.name,
      poiType: r.typeName,
      rating: r.rating ? Number(r.rating) : 0,
      estimatedCost: r.estimatedCost ? Number(r.estimatedCost) : null,
      address: r.address,
    }));
  } catch (err) {
    logger.warn({ err, destinationName }, "fetchSeedPois failed — proceeding without DB hints");
    return [];
  }
}

function formatSeedPoisForPrompt(seeds: SeedPoi[]): string {
  if (seeds.length === 0) return "";
  const lines = seeds.slice(0, 15).map((p) => {
    const cost = p.estimatedCost ? `~${Math.round(p.estimatedCost / 1000)}K` : "giá tuỳ";
    const type = p.poiType || "địa điểm";
    return `- ${p.name} (${type}, ${p.rating.toFixed(1)}★, ${cost})`;
  });
  return `\n=== GỢI Ý TỪ CƠ SỞ DỮ LIỆU PLANGO (đã được verify) ===\n${lines.join("\n")}\nLưu ý: ƯU TIÊN dùng nếu phù hợp với sở thích/ngân sách user; ĐƯỢC PHÉP gợi ý địa điểm mới ngoài list này. Tất cả POI gợi ý đã có rating tốt và giá hợp budget.`;
}

/** Normalize a name for fuzzy matching against DB. */
export function normalizePoiName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

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
    if (parts.length === 3)
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(d);
  };
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function buildPrompt(
  input: GenerateItineraryInput,
  numDays: number,
  province: string,
  seedHints = "",
): string {
  const {
    destination,
    destinations,
    startingPoint,
    startDate,
    endDate,
    totalBudget,
    numPeople,
    preferences,
  } = input;
  const prefsText = preferences && preferences.length > 0 ? preferences.join(", ") : "";
  const budgetPerDay = totalBudget ? Math.round(totalBudget / numDays) : 0;
  const fromCity = (startingPoint || "").trim();

  const isMulti = destinations && destinations.length > 1;
  const destLabel = isMulti
    ? destinations!.map((d) => `${d.name} (${d.days} ngày)`).join(" → ")
    : `${destination} (${province})`;

  // Day-by-day destination mapping for multi-city plans so AI knows which
  // city each day belongs to and inserts a transport activity between cities.
  let dayMap = "";
  if (isMulti) {
    let n = 1;
    const lines: string[] = [];
    for (let i = 0; i < destinations!.length; i++) {
      const seg = destinations![i];
      const start = n;
      const end = n + seg.days - 1;
      lines.push(`- Ngày ${start}-${end}: ${seg.name}`);
      if (i < destinations!.length - 1) {
        lines.push(
          `  → Ngày ${end} buổi chiều / tối có hoạt động transport sang ${destinations![i + 1].name}`,
        );
      }
      n += seg.days;
    }
    dayMap = "\n=== PHÂN BỔ NGÀY THEO ĐIỂM ĐẾN ===\n" + lines.join("\n");
  }

  const cityList = isMulti
    ? destinations!.map((d) => d.name).join(", ")
    : `${destination} (${province})`;

  // Compact prompt — trimmed ~45% from previous version to cut Gemini response
  // time from ~50s to ~15-25s. Rules preserved, decoration removed.
  const prefRules: string[] = [];
  if (prefsText?.includes("Biển") || prefsText?.includes("Thiên nhiên"))
    prefRules.push("ưu tiên biển/đảo/thiên nhiên");
  if (prefsText?.includes("Văn hóa") || prefsText?.includes("Lịch sử"))
    prefRules.push("ưu tiên đền chùa/bảo tàng/di tích");
  if (prefsText?.includes("Ẩm thực")) prefRules.push("ưu tiên quán đặc sản nổi tiếng");
  if (prefsText?.includes("Giải trí đêm") || prefsText?.includes("Mua sắm"))
    prefRules.push("phải có chợ đêm/bar/phố đi bộ sau 20:30");
  if (prefsText?.includes("Nhiếp ảnh") || prefsText?.includes("Núi"))
    prefRules.push("ưu tiên điểm check-in view đẹp");
  if (prefsText?.includes("Phiêu lưu")) prefRules.push("ưu tiên trekking/lặn biển");

  return `Bạn là chuyên gia du lịch VN. Tạo lịch trình ${numDays} ngày: ${destLabel}.

THÔNG TIN:
- Thành phố hợp lệ: ${cityList}${fromCity ? "\n- Xuất phát: " + fromCity : ""}
- ${startDate} → ${endDate} | ${numPeople || 2} người | NS ${totalBudget ? totalBudget.toLocaleString("vi-VN") + "đ (≈" + budgetPerDay.toLocaleString("vi-VN") + "đ/ngày)" : "tùy ý"}
- Sở thích: ${prefsText || "đa dạng"}${dayMap}${seedHints}

⚠️ CẤM TUYỆT ĐỐI:
- Đưa địa điểm/quán/khách sạn của TP khác (vd Bánh mì Phượng=Hội An, Phở Thìn=Hà Nội — KHÔNG dùng nếu TP đó không trong danh sách hợp lệ).
- Bịa tên POI. Mỗi POI phải có thật trên Google Maps, kèm tên TP trong địa chỉ.

QUY TẮC NGÀY:
- 8-10 activities/ngày: 1 sáng (07:30) + 2-3 sáng (08:15-11:30) + 1 trưa (11:30-12:00) + 2-3 chiều (14:00-17:30) + 1 tối (19:00-20:00) + 1 đêm (20:30+).
- KHÔNG 2 bữa ăn liền nhau không có hoạt động ở giữa.
- 2 POI liền kề ≤15km. Tổng 1 ngày ≤40km.${prefRules.length ? "\n- Ưu tiên: " + prefRules.join(", ") + "." : ""}

KHÁCH SẠN:
- ${isMulti ? "Mỗi TP CHỈ 1 khách sạn. Chuyển TP = check-out + check-in mới." : "TOÀN chuyến CHỈ 1 khách sạn tại " + (destination || province) + "."}
- activityType="hotel", title có "Khách sạn"/"Homestay" + tên. Chỉ xếp đầu/cuối ngày.${
    fromCity
      ? `\n\nDI CHUYỂN:\n- Ngày 1 hoạt động đầu = transport từ ${fromCity} → ${isMulti ? destinations![0].name : destination}.\n- Ngày cuối hoạt động cuối = transport từ ${isMulti ? destinations![destinations!.length - 1].name : destination} → ${fromCity}.\n- activityType="transport", title kèm phương tiện (vd "Bay HN→ĐN", "Xe giường nằm về HN").`
      : ""
  }

GIỜ MỞ CỬA (CHUẨN theo Google Maps):
- Ăn sáng/cafe sáng: 06:30-10:30. Trưa: 11:00-14:30. Cafe chiều: 14:00-18:00. Tối: 17:00-22:30 (KHÔNG sau 21:00).
- Bảo tàng/đền chùa/di tích: 07:00-17:00. Khu vui chơi/CV: 08:00-22:00. Chợ truyền thống: 05:00-12:00. Chợ đêm/bar/phố đi bộ: 18:00-02:00.
- Bãi biển: tránh 11:00-14:00. Mall: 09:30-22:00. KHÔNG xếp tham quan thường sau 21:00.

CHI PHÍ & THỜI GIAN:
- estimatedCost = giá thật cho ${numPeople || 2} người. Tổng chuyến ${totalBudget ? "≈" + totalBudget.toLocaleString("vi-VN") + "đ" : "hợp lý"}.
- Tham quan: 1-2h/điểm. Ăn: 1h/bữa.

OUTPUT (CHỈ JSON, không markdown):
{"days":[{"day":1,"title":"...","activities":[{"time":"07:30","title":"...","description":"...","duration":"1 giờ","estimatedCost":120000,"activityType":"food"}]}]}
activityType ∈ "food"|"sightseeing"|"transport"|"shopping"|"hotel"|"other"`;
}

// Circuit-breaker — if Gemini returns 429/quota errors, mark it dead for 5
// minutes so subsequent requests skip the call entirely (saves ~2s round-trip
// per request while the quota window resets).
let geminiCircuitOpenUntil = 0;
function isGeminiCircuitOpen(): boolean {
  return Date.now() < geminiCircuitOpenUntil;
}
function tripGeminiCircuit(durationMs = 5 * 60 * 1000) {
  geminiCircuitOpenUntil = Date.now() + durationMs;
}

async function callGemini(prompt: string, retries = 3): Promise<any> {
  if (!env.GEMINI_API_KEY)
    throw new AppError("AI_PROVIDER_UNAVAILABLE", "GEMINI_API_KEY not configured");
  if (isGeminiCircuitOpen()) throw new Error("Gemini circuit-breaker open");
  // Trim — Windows .env files use CRLF; dotenv sometimes leaves a trailing \r
  // on the value which Google decodes as a malformed key → 401 UNAUTHENTICATED.
  const apiKey = env.GEMINI_API_KEY.trim();
  // gemini-flash-latest — Google auto-routes to the current free-tier-eligible
  // model (gemini-2.5-flash as of 2025). Older fixed IDs like 2.0-flash now
  // return 429 limit:0 because free quota was migrated to 2.5.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

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
      // Retry only on transient errors (503 overloaded). 429 = quota exhausted;
      // retrying just costs time, fall through to OpenAI immediately.
      if (res.status === 503 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(errorText);
    } catch (err) {
      // If error string looks like a quota / rate-limit issue (429 RESOURCE_EXHAUSTED),
      // skip remaining retries AND open the circuit breaker for 5 minutes.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        tripGeminiCircuit();
        logger.warn("Gemini circuit-breaker opened for 5 minutes (quota exhausted)");
        throw err;
      }
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Gemini failed after retries");
}

async function callOpenAI(prompt: string): Promise<any> {
  if (!env.OPENAI_API_KEY)
    throw new AppError("AI_PROVIDER_UNAVAILABLE", "OPENAI_API_KEY not configured");
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Bạn là chuyên gia du lịch Việt Nam. BẮT BUỘC trả về JSON hợp lệ duy nhất theo format: { days: [...] }. KHÔNG markdown, KHÔNG giải thích.",
      },
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

// SerpAPI returns opening hours in inconsistent shapes — sometimes a
// {monday:"...", tuesday:"...", ...} object, sometimes an array of
// {day, hours} entries. Normalize to a 7-string array Mon..Sun.
function normalizeOpeningHours(src: unknown): string[] | null {
  if (!src) return null;
  const DAYS_VI = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const result: string[] = new Array(7).fill("");

  if (Array.isArray(src)) {
    for (const entry of src as any[]) {
      if (!entry) continue;
      const day = String(entry.day || "").toLowerCase();
      const hours = entry.hours || entry.opening_hours || "";
      const i = DAY_KEYS.findIndex((k) => day.startsWith(k.slice(0, 3)));
      if (i >= 0) result[i] = `${DAYS_VI[i]}: ${hours}`;
    }
  } else if (typeof src === "object") {
    for (let i = 0; i < DAY_KEYS.length; i++) {
      const v = (src as any)[DAY_KEYS[i]];
      if (v) result[i] = `${DAYS_VI[i]}: ${v}`;
    }
  } else {
    return null;
  }

  return result.some(Boolean) ? result : null;
}

// Map SerpAPI's `price` field (Google Maps $ tier) to approximate VND per
// person for Vietnamese cuisine. Restaurants only — these are gut-feel
// midpoints that match typical local pricing.
function priceTierToVNDPerPerson(price: unknown): number | null {
  if (price == null) return null;
  const s = String(price).trim();
  const dollars = (s.match(/\$/g) || []).length;
  if (dollars >= 4) return 600_000;
  if (dollars === 3) return 350_000;
  if (dollars === 2) return 180_000;
  if (dollars === 1) return 80_000;
  // Sometimes SerpAPI returns "Inexpensive"/"Moderate"/"Expensive"/"Very Expensive"
  const lower = s.toLowerCase();
  if (lower.includes("very expensive")) return 600_000;
  if (lower.includes("expensive")) return 350_000;
  if (lower.includes("moderate")) return 180_000;
  if (lower.includes("inexpensive") || lower.includes("cheap")) return 80_000;
  return null;
}

async function enrichActivitiesWithSerpApi(
  activities: any[],
  destination: string,
  province: string,
  destLat: number,
  destLng: number,
  numPeople: number = 2,
): Promise<boolean> {
  const serpApiKey = getSerpApiKey();
  if (!serpApiKey) return false;

  const locationBias = destLat && destLng ? `@${destLat},${destLng},14z` : "";

  // Skip meta-activities that don't represent real POIs.
  const skip = (t: string) => {
    const l = t.toLowerCase();
    return l.includes("chi phí") || l.includes("di chuyển") || l.includes("tổng kết");
  };
  const candidates = activities.filter((a) => !skip(a.title));

  // ── Option D Phase 2: DB-first match ──
  // Before hitting SerpAPI, fuzzy-match each candidate against pre-enriched DB
  // POIs for this destination. If the AI used a name that's already in DB
  // (because we seeded those names in the prompt), reuse the DB enrichment
  // and skip the slow paid SerpAPI call.
  let dbHits = 0;
  try {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
    const destNorm = norm(destination);
    const destRows = await db
      .select({ destinationId: destTbl.destinationId, name: destTbl.name })
      .from(destTbl)
      .limit(50);
    const matchedDest = destRows.find((d) => norm(d.name) === destNorm);
    if (matchedDest) {
      const dbPois = await db
        .select({
          poiId: pois.poiId,
          name: pois.name,
          address: pois.address,
          latitude: pois.latitude,
          longitude: pois.longitude,
          rating: pois.rating,
          reviewCounts: pois.reviewCounts,
          googlePlaceId: pois.googlePlaceId,
          estimatedCost: pois.estimatedCost,
        })
        .from(pois)
        .where(eq(pois.destinationId, matchedDest.destinationId));
      const dbByNorm = new Map(dbPois.map((p) => [norm(p.name), p]));
      for (const act of candidates) {
        const placeName = extractPlaceName(act.title);
        const variants = [
          norm(placeName),
          norm(act.title),
          norm(placeName).replace(/^(quan|nha hang|cafe|chua|tham|khu)\s+/, ""),
        ];
        let match: (typeof dbPois)[number] | undefined;
        for (const v of variants) {
          if (!v) continue;
          if (dbByNorm.has(v)) {
            match = dbByNorm.get(v);
            break;
          }
        }
        if (!match) {
          // Token-overlap fallback — match if ≥70% of significant tokens align
          const candTokens = new Set(variants[0].split(" ").filter((t) => t.length >= 3));
          if (candTokens.size === 0) continue;
          for (const [dbName, dbPoi] of dbByNorm) {
            const dbTokens = new Set(dbName.split(" ").filter((t) => t.length >= 3));
            if (dbTokens.size === 0) continue;
            let overlap = 0;
            for (const t of candTokens) if (dbTokens.has(t)) overlap++;
            const score = overlap / Math.max(candTokens.size, dbTokens.size);
            if (score >= 0.7) {
              match = dbPoi;
              break;
            }
          }
        }
        if (match) {
          act.address = act.address || match.address;
          act.latitude = match.latitude ? Number(match.latitude) : act.latitude;
          act.longitude = match.longitude ? Number(match.longitude) : act.longitude;
          if (match.rating) act.rating = Number(match.rating);
          if (match.reviewCounts) act.reviewCount = match.reviewCounts;
          if (match.googlePlaceId) act.googlePlaceId = match.googlePlaceId;
          if (match.estimatedCost && !act.estimatedCost) {
            act.estimatedCost = Number(match.estimatedCost);
          }
          act.poiId = match.poiId;
          act._dbHit = true;
          dbHits++;
        }
      }
      logger.info(
        { dbHits, totalCandidates: candidates.length, destination },
        "Option D enrichment — DB hits saved SerpAPI calls",
      );
    }
  } catch (err) {
    logger.warn({ err }, "DB-first enrichment failed — full SerpAPI fallback");
  }
  const toEnrich = candidates.filter((a) => !a._dbHit);

  let quotaExceeded = false;
  const enrichOne = async (act: any) => {
    if (quotaExceeded) return;
    const placeName = extractPlaceName(act.title);
    const baseName = placeName.length > 3 ? placeName : act.title;
    const city = destination || province || "";
    const searchQuery = baseName.toLowerCase().includes(city.toLowerCase())
      ? baseName.trim()
      : `${baseName} ${city}`.trim();

    try {
      const params = new URLSearchParams({
        engine: "google_maps",
        q: searchQuery,
        hl: "vi",
        type: "search",
        api_key: serpApiKey,
      });
      if (locationBias) params.set("ll", locationBias);
      // 6s timeout per request — one slow POI shouldn't block the whole batch.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const serpRes = await fetch(`${SERPAPI_BASE}?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await serpRes.json();
      if (!serpRes.ok) {
        if ((data as any)?.error?.includes("quota")) quotaExceeded = true;
        logger.warn(
          { title: act.title, status: serpRes.status, err: (data as any)?.error },
          "SerpAPI returned error",
        );
        return;
      }
      const results = data.local_results || (data.place_results ? [data.place_results] : []);
      if (results.length === 0) {
        logger.info(
          { title: act.title, query: searchQuery },
          "SerpAPI: no results — try simpler query?",
        );
        return;
      }
      const match =
        results.find(
          (r: any) =>
            r.address?.toLowerCase().includes(destination.toLowerCase()) ||
            r.address?.toLowerCase().includes((province || "").toLowerCase()),
        ) || results[0];

      if (match.gps_coordinates?.latitude) {
        act.latitude = match.gps_coordinates.latitude;
        act.longitude = match.gps_coordinates.longitude;
      }
      if (match.address) act.address = match.address;
      // SerpAPI sometimes returns rating as string ("4.5") — coerce to number.
      const r = match.rating ?? match.rating_summary;
      if (r != null) act.rating = typeof r === "number" ? r : parseFloat(String(r));
      const rc = match.reviews ?? match.user_review;
      if (rc != null) act.reviewCount = Number(rc) || 0;
      if (match.place_id) act.googlePlaceId = match.place_id;
      if (match.thumbnail) act.thumbnail = match.thumbnail;

      // Opening hours from SerpAPI — multiple shapes depending on result type.
      // Normalize into a 7-element array Mon..Sun like "07:00–22:00" or "Đóng cửa".
      const hoursSrc =
        (match.operating_hours as Record<string, string> | undefined) ||
        match.opening_hours ||
        match.hours;
      const normalized = normalizeOpeningHours(hoursSrc);
      if (normalized) {
        act.openingHours = normalized;
        const today = new Date().getDay(); // 0=Sun → map to index 6 since we store Mon..Sun
        const idx = today === 0 ? 6 : today - 1;
        act.openHours = normalized[idx] || normalized[0];
      }

      // Price tier → realistic VND estimate for food activities only.
      // Sightseeing / shopping / transport keep the AI's guess.
      const aType = String(act.activityType || "").toLowerCase();
      if (aType === "food") {
        const perPerson = priceTierToVNDPerPerson(match.price);
        if (perPerson != null) {
          act.estimatedCost = perPerson * Math.max(1, numPeople);
          act.priceSource = "google_maps";
        }
      }

      if (match.title) {
        const hoursHint = act.openHours ? ` · Giờ MC hôm nay: ${act.openHours}` : "";
        const priceHint =
          aType === "food" && match.price ? ` · ${String(match.price).trim()}` : "";
        act.description =
          `${match.title} — ★ ${act.rating || "N/A"}/5${priceHint}${hoursHint}. ${act.description || ""}`.trim();
      }
      act.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${act.latitude},${act.longitude}`;
    } catch (err) {
      logger.warn({ err, title: act.title }, "SerpAPI enrichment failed");
    }
  };

  // Fire ALL requests in parallel — SerpAPI handles ~100 concurrent per key,
  // batching was overkill. With 6s per-request timeout, wall-clock = slowest
  // single request, not sum of batches.
  const t0 = Date.now();
  await Promise.allSettled(toEnrich.map(enrichOne));
  logger.info(
    { count: toEnrich.length, ms: Date.now() - t0 },
    "SerpAPI enrichment complete",
  );
  return quotaExceeded;
}

async function fallbackGeocodeActivities(
  activities: any[],
  destination: string,
  destLat: number,
  destLng: number,
) {
  const t0 = Date.now();
  // Only activities missing coords need geocoding. Skip transport (no real
  // POI to look up) but keep ALL other activity types — including the new
  // starting-point transit (those have real coords from AI).
  const isMeta = (t: string) =>
    t.includes("chi phí") || t.includes("tổng kết");
  const toGeocode = activities.filter((act) => {
    const hasCoords = act.latitude && act.latitude !== 0 && act.latitude !== "0";
    return !hasCoords && !isMeta(String(act.title || "").toLowerCase());
  });

  // Parallel geocode — was sequential (27 acts × 700ms = ~20s). Now ~2s.
  await Promise.allSettled(
    toGeocode.map(async (act) => {
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
      } catch (err) {
        logger.warn({ err, title: act.title }, "Geocode fallback failed");
      }
    }),
  );
  logger.info(
    { count: toGeocode.length, ms: Date.now() - t0 },
    "Fallback geocode complete",
  );
}

async function linkPoisAndCleanup(parsedData: any) {
  if (!parsedData?.days) return;
  const t0 = Date.now();
  // Filter: drop AI's "summary" garbage activities (cost/summary lines).
  // KEEP transport — the new starting-point feature relies on real transit
  // activities ("Bay từ Hà Nội → Đà Nẵng"), only filter the meta junk.
  const isGarbage = (act: any) => {
    const t = String(act.title || "").toLowerCase();
    return (
      t.includes("chi phí ngày") ||
      t.includes("tổng kết ngày") ||
      t === "chi phí" ||
      t === "tổng kết"
    );
  };

  // Per-day cleanup + collect all activities for parallel POI linking.
  const allActsToLink: any[] = [];
  for (const day of parsedData.days) {
    const cleaned = day.activities.filter((act: any) => !isGarbage(act));
    day.activities = cleaned;
    day.title = day.title || `Ngày ${day.day}`;
    for (const act of cleaned) allActsToLink.push(act);
  }

  await Promise.allSettled(
    allActsToLink.map(async (act) => {
      try {
        const pName = extractPlaceName(act.title);
        const existing = act.googlePlaceId
          ? await storage.getPoiByGooglePlaceId(act.googlePlaceId)
          : await storage.getPoiByName(pName);
        const specificType = act.placeType || act.activityType;
        act.activityType = specificType;
        if (existing?.poiId) {
          act.poiId = existing.poiId;
          await associatePreferencesToPoi(
            existing.poiId,
            act.activityType,
            act.title,
            act.description,
          );
        }
      } catch (err) {
        logger.warn({ err, title: act.title }, "Failed to link POI");
      }
    }),
  );
  logger.info(
    { count: allActsToLink.length, ms: Date.now() - t0 },
    "Link POIs complete",
  );
}

async function persistPois(activities: any[], destination: string) {
  const t0 = Date.now();
  let resolvedDestId: number | null = null;
  const destRecord = await storage.getDestinationByName(destination);
  if (destRecord) resolvedDestId = destRecord.destinationId;

  // Sequential await was 14-20s for 28 activities (each call is a Neon round-trip
  // from VN ~400ms). Run all in parallel — Neon pool can handle 20+ concurrent.
  await Promise.allSettled(
    activities
      .filter((act) => act.latitude && act.latitude !== 0)
      .map(async (act) => {
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
      }),
  );
  logger.info({ count: activities.length, ms: Date.now() - t0 }, "Persist POIs complete");
}

export async function generateItinerary(input: GenerateItineraryInput): Promise<any> {
  // Check LRU cache first — saves $ + ~10s wait when input matches
  const cached = getCachedItinerary({
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    totalBudget: input.totalBudget,
    numPeople: input.numPeople,
    preferences: input.preferences,
  });
  if (cached) return cached;

  const numDays = computeNumDays(input.startDate, input.endDate);
  const destKey = input.destination.toLowerCase().trim();
  const province = PROVINCE_MAP[destKey] || input.destination;

  // ── Option D: seed DB POIs as hints for the AI ──
  // Per-category budget derivation honors all 5 user inputs:
  //   destination → POI filter; days+people+totalBudget → cost ceiling;
  //   preferences → ranking (passed via prompt text);
  //   The seeds are SUGGESTIONS only — AI may use or ignore. Skipping this
  //   step would just fall back to old behavior, so it's risk-free.
  const numActPerDay = 8; // upper bound, matches prompt rule "8-10 act/day"
  const totalActs = numDays * numActPerDay * (input.numPeople || 1);
  const budgetPerActivityVnd =
    input.totalBudget && totalActs > 0
      ? Math.round(input.totalBudget / totalActs)
      : 0;
  const tSeed = Date.now();
  const seedPois = await fetchSeedPois(
    input.destination,
    input.preferences,
    budgetPerActivityVnd,
  );
  const seedHints = formatSeedPoisForPrompt(seedPois);
  logger.info(
    {
      seedCount: seedPois.length,
      budgetPerActivityVnd,
      ms: Date.now() - tSeed,
    },
    "DB seed POIs fetched",
  );

  const prompt = buildPrompt(input, numDays, province, seedHints);

  let activeProvider = "gemini";
  let parsedData: any;
  const tAI = Date.now();
  try {
    logger.info("⚡ Using Gemini for itinerary generation");
    parsedData = await callGemini(prompt);
    parsedData.provider = "gemini";
    logger.info({ ms: Date.now() - tAI }, "Gemini done");
  } catch (err) {
    logger.warn({ err }, "Gemini failed → fallback to OpenAI");
    activeProvider = "openai";
    try {
      parsedData = await callOpenAI(prompt);
      parsedData.provider = "openai";
      logger.info({ ms: Date.now() - tAI }, "OpenAI done");
    } catch (openErr) {
      logger.error({ err: openErr }, "OpenAI also failed");
      throw new AppError("AI_PROVIDER_UNAVAILABLE", "Both Gemini and OpenAI failed", {
        details: String(openErr),
      });
    }
  }

  if (!parsedData?.days || !Array.isArray(parsedData.days)) {
    throw new AppError("AI_RESPONSE_INVALID", "Invalid AI response structure");
  }

  // ── Sanity filter: AI still occasionally hallucinates POIs from OTHER
  // Vietnamese cities (Bánh mì Phượng/Hội An in a Huế trip, etc.). Build a
  // set of allowed-city tokens + a list of common "famous" other-city POI
  // markers and drop activities whose title clearly belongs elsewhere.
  const allowedCities = new Set<string>();
  const addCity = (c?: string) => {
    if (!c) return;
    const norm = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    allowedCities.add(norm);
  };
  addCity(input.destination);
  addCity(province);
  if (input.destinations) {
    for (const d of input.destinations) addCity(d.name);
  }
  // Famous POI signatures → which city they belong to. Used only when the
  // signature appears in the AI title AND that city is NOT in the allowed set.
  const OTHER_CITY_POIS: { city: string; markers: string[] }[] = [
    { city: "ha noi", markers: ["pho thin", "hồ gươm", "ho guom", "văn miếu", "van mieu", "lăng bác", "lang bac", "phố cổ hà nội", "old quarter ha noi"] },
    { city: "hoi an", markers: ["bánh mì phượng", "banh mi phuong", "phố cổ hội an", "old town hoi an", "chùa cầu"] },
    { city: "hue", markers: ["bún bò huế", "bun bo hue", "đại nội", "dai noi", "cầu trường tiền", "lăng tự đức", "chợ đông ba"] },
    { city: "da nang", markers: ["cầu rồng", "cau rong", "bà nà hills", "ba na hills", "sun world"] },
    { city: "sai gon", markers: ["bến thành", "ben thanh", "nhà thờ đức bà", "bưu điện sài gòn"] },
    { city: "nha trang", markers: ["vinpearl nha trang", "tháp bà ponagar"] },
    { city: "phu quoc", markers: ["vinpearl phú quốc", "vinwonders phu quoc"] },
  ];
  const stripDiacritics = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dropForeignCity = (title: string): boolean => {
    const t = stripDiacritics(title);
    for (const entry of OTHER_CITY_POIS) {
      if (allowedCities.has(entry.city)) continue;
      for (const m of entry.markers) {
        const mNorm = stripDiacritics(m);
        if (t.includes(mNorm)) return true;
      }
    }
    return false;
  };

  let droppedCount = 0;
  for (const day of parsedData.days) {
    if (!day.activities) day.activities = [];
    day.activities = day.activities.filter((a: any) => {
      if (dropForeignCity(a.title || "")) {
        droppedCount++;
        return false;
      }
      return true;
    });
  }
  if (droppedCount > 0) {
    logger.warn({ droppedCount }, "Dropped AI hallucinated POIs from other cities");
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

  // Enrichment must run first (sets lat/lng on activities). After that the
  // 3 cleanup tasks (geocode fallback for any miss, link existing POIs, persist
  // new POIs) are independent of one another — run in parallel to cut latency.
  const quotaExceeded = await enrichActivitiesWithSerpApi(
    allActivities,
    input.destination,
    province,
    destLat,
    destLng,
    input.numPeople || 2,
  );
  void quotaExceeded;
  await Promise.allSettled([
    fallbackGeocodeActivities(allActivities, input.destination, destLat, destLng),
    linkPoisAndCleanup(parsedData),
    persistPois(allActivities, input.destination),
  ]);

  const result = { ...parsedData, provider: activeProvider };

  // Cache the enriched + geocoded result so a duplicate request skips AI + SerpAPI
  setCachedItinerary(
    {
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      totalBudget: input.totalBudget,
      numPeople: input.numPeople,
      preferences: input.preferences,
    },
    result,
  );

  return result;
}
