import { storage } from "../storage";

/**
 * Strip Vietnamese activity prefixes to get the actual place name.
 * E.g. "Ăn sáng tại Bánh đa cua Bà Cụ" → "Bánh đa cua Bà Cụ"
 */
export function extractPlaceName(title: string): string {
  return title
    .replace(
      /^(Ăn sáng|Ăn trưa|Ăn tối|Ăn chiều|Nghỉ trưa|Nghỉ đêm|Nghỉ ngơi|Check-in|Check-out|Tham quan|Khám phá|Trải nghiệm|Dạo chơi|Đi bộ|Di chuyển|Mua sắm|Thưởng thức|Ghé thăm|Uống cà phê|Cà phê|Cafe)\s*(tại|ở|đến|quanh|trong|trên|vào|lúc)?\s*/i,
      "",
    )
    .trim();
}

/** Map AI activity type → DB expense type ID */
export function mapActivityTypeToExpenseId(type?: string): number | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("food")) return 1;
  if (t.includes("transport") || t.includes("travel")) return 2;
  if (t.includes("hotel") || t.includes("accommodation")) return 3;
  if (t.includes("sightseeing") || t.includes("attraction")) return 4;
  if (t.includes("shopping")) return 5;
  return 6;
}

export function mapExpenseIdToActivityType(id?: number | null): string | null {
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

/** Map activity type + textual content → list of localized preference names */
export function mapToPreferenceNames(
  type?: string,
  title?: string,
  description?: string,
): string[] {
  const prefs: string[] = [];
  const t = (type || "").toLowerCase();
  const text = ((title || "") + " " + (description || "")).toLowerCase();

  if (t.includes("food")) prefs.push("Ẩm thực");
  if (t.includes("shopping")) prefs.push("Mua sắm");
  if (t.includes("hotel") || t.includes("accommodation")) prefs.push("Nghỉ dưỡng");

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

  if (t.includes("sightseeing") && prefs.length === 0) {
    prefs.push("Văn hóa");
    prefs.push("Thành phố");
  }

  return [...new Set(prefs)];
}

export async function associatePreferencesToPoi(
  poiId: number,
  type?: string,
  title?: string,
  description?: string,
) {
  try {
    const prefNames = mapToPreferenceNames(type, title, description);
    if (prefNames.length === 0) return;

    console.log(`[POI-Pref] Associating ${prefNames.join(", ")} with POI ${poiId}`);
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

export async function associatePreferencesToTrip(tripId: number, prefNames: string[]) {
  if (!prefNames || prefNames.length === 0) return;
  try {
    console.log(`[Trip-Pref] Associating ${prefNames.join(", ")} with Trip ${tripId}`);
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
