import { storage } from "../../storage";
import { errors } from "../../lib/errors";
import { resolvePoiTypeId } from "../../lib/lookups";
import type { CreatePoiInput, UpdatePoiInput, ListPoisQuery } from "./schema";

// ─── Enrich + opening hours helpers ───

async function enrichPoi(poi: any, allPoiTypes?: any[], allHours?: any[]) {
  const enriched: any = { ...poi };

  if (poi.poitypeId) {
    const pt = allPoiTypes
      ? allPoiTypes.find((t: any) => t.poitypeId === poi.poitypeId)
      : await storage.getPoiType(poi.poitypeId);
    enriched.type = pt?.typeName || "other";
  } else {
    enriched.type = "other";
  }

  try {
    const hours = allHours
      ? allHours.filter((h: any) => h.poiId === poi.poiId)
      : await storage.getPoiOpeningHours(poi.poiId);
    if (hours && hours.length > 0) {
      const dayNamesShort = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      const dayNamesFull = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
      const sorted = hours.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);
      const first = sorted[0];
      const allSame = sorted.every(
        (h: any) => h.openTime === first.openTime && h.closeTime === first.closeTime,
      );

      if (allSame && sorted.length > 1) {
        const startDay = dayNamesFull[sorted[0].dayOfWeek];
        const endDay = dayNamesFull[sorted[sorted.length - 1].dayOfWeek];
        const openT = (first.openTime || "00:00").slice(0, 5);
        const closeT = (first.closeTime || "00:00").slice(0, 5);
        enriched.openHours = `${startDay} - ${endDay} | ${openT} - ${closeT}`;
      } else {
        enriched.openHours = sorted
          .map((h: any) =>
            `${dayNamesShort[h.dayOfWeek] || h.dayOfWeek}: ${(h.openTime || "?").slice(0, 5)}-${(h.closeTime || "?").slice(0, 5)}`)
          .join(" | ");
      }
    }
  } catch { }

  return enriched;
}

async function saveOpeningHours(poiId: number, openHoursStr: string | undefined) {
  if (!openHoursStr || !openHoursStr.trim()) return;
  try { await storage.deletePoiOpeningHours(poiId); } catch { }

  const trimmed = openHoursStr.trim();
  const dayMap: Record<string, number> = {
    CN: 0, "CHỦ NHẬT": 0,
    T2: 1, "THỨ 2": 1,
    T3: 2, "THỨ 3": 2,
    T4: 3, "THỨ 4": 3,
    T5: 4, "THỨ 5": 4,
    T6: 5, "THỨ 6": 5,
    T7: 6, "THỨ 7": 6,
  };

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

        let current = startDayIdx;
        const target = endDayIdx;
        const daysToSave: number[] = [];
        let safety = 0;
        while (safety < 10) {
          daysToSave.push(current);
          if (current === target) break;
          current = (current + 1) % 7;
          safety++;
        }
        for (const d of daysToSave) {
          try { await storage.createPoiOpeningHours({ poiId, dayOfWeek: d, openTime, closeTime }); } catch { }
        }
        return;
      }
    }
  }

  const hasDayPrefix = /^(CN|T[2-7])\s*:/i.test(trimmed);
  if (hasDayPrefix) {
    const segments = trimmed.split("|").map((s) => s.trim());
    for (const seg of segments) {
      const match = seg.match(/^(CN|T[2-7])\s*:\s*(.+)$/i);
      if (match) {
        const dayIndex = dayMap[match[1].toUpperCase()] ?? 0;
        const times = match[2].trim().split("-").map((t) => t.trim());
        try {
          await storage.createPoiOpeningHours({
            poiId, dayOfWeek: dayIndex,
            openTime: times[0] || null, closeTime: times[1] || null,
          });
        } catch { }
      }
    }
  } else {
    const times = trimmed.split("-").map((t) => t.trim());
    const openTime = times[0] || null;
    const closeTime = times[1] || null;
    for (let day = 0; day < 7; day++) {
      try { await storage.createPoiOpeningHours({ poiId, dayOfWeek: day, openTime, closeTime }); } catch { }
    }
  }
}

async function preparePoiData(body: any) {
  const data: any = { ...body };
  if (data.type && !data.poitypeId) {
    const typeId = await resolvePoiTypeId(data.type);
    if (typeId) data.poitypeId = typeId;
  }
  const openHoursStr = data.openHours;
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
  delete data.images;
  delete data.category;
  if (body.reviewCount !== undefined) data.reviewCounts = body.reviewCount;
  return { data, openHoursStr };
}

// ─── Service ───

export async function listPois(query: ListPoisQuery) {
  const items = query.destinationId
    ? await storage.getPoisByDestination(query.destinationId)
    : await storage.getPois();

  const [allTypes, allHours] = await Promise.all([
    storage.getPoiTypes(),
    storage.getBatchPoiOpeningHours(items.map((i) => i.poiId)),
  ]);
  return Promise.all(items.map((poi) => enrichPoi(poi, allTypes, allHours)));
}

export async function getPoiById(id: number) {
  const poi = await storage.getPoi(id);
  if (!poi) throw errors.notFound("POI");
  return enrichPoi(poi);
}

export async function createPoi(input: CreatePoiInput) {
  const { data, openHoursStr } = await preparePoiData(input);
  const poi = await storage.createPoi(data);
  if (openHoursStr) await saveOpeningHours(poi.poiId, openHoursStr);
  return enrichPoi(poi);
}

export async function updatePoi(id: number, input: UpdatePoiInput) {
  const { data, openHoursStr } = await preparePoiData(input);
  delete data.id;
  delete data.poiId;
  const poi = await storage.updatePoi(id, data);
  if (!poi) throw errors.notFound("POI");
  if (openHoursStr) await saveOpeningHours(poi.poiId, openHoursStr);
  return enrichPoi(poi);
}

export async function deletePoi(id: number) {
  const ok = await storage.deletePoi(id);
  if (!ok) throw errors.notFound("POI");
}

// ─── POI types ───
export async function listPoiTypes() {
  return storage.getPoiTypes();
}
export async function createPoiType(input: any) {
  return storage.createPoiType(input);
}
export async function updatePoiType(id: number, input: any) {
  const item = await storage.updatePoiType(id, input);
  if (!item) throw errors.notFound("Type");
  return item;
}
export async function deletePoiType(id: number) {
  const ok = await storage.deletePoiType(id);
  if (!ok) throw errors.notFound("Type");
}
