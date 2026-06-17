import type { ItineraryActivity, ExpenseType } from "@/types";
import { t } from "@/lib/i18n";

export function getStatusLabel(status: string): string {
  const labels = t().trips;
  if (status === "draft") return labels.statusDraft;
  if (status === "active") return labels.statusActive;
  if (status === "completed") return labels.statusCompleted;
  return status;
}

export function getActivityTypeLabel(type: string, ets?: ExpenseType[]): string {
  const labels = t().itinerary;
  const standardTypes = ["sightseeing", "food", "transport", "shopping", "other"];
  if (standardTypes.includes(type)) {
    const map: Record<string, string> = {
      sightseeing: labels.sightseeing,
      food: labels.food,
      transport: labels.transport,
      shopping: labels.shopping,
      other: labels.other,
    };
    return map[type] || type;
  }
  const isNumeric = /^\d+$/.test(type);
  if (isNumeric && ets) {
    const found = ets.find((et) => et.id.toString() === type.toString());
    if (found) return found.name;
  }
  return type;
}

export function getActivityTypeIcon(type: string): string {
  const map: Record<string, string> = {
    sightseeing: "camera-outline",
    attraction: "camera-outline",
    food: "restaurant-outline",
    restaurant: "restaurant-outline",
    cafe: "cafe-outline",
    transport: "car-outline",
    transit: "car-outline",
    shopping: "bag-outline",
    hotel: "bed-outline",
    accommodation: "bed-outline",
    homestay: "bed-outline",
    other: "ellipse-outline",
  };
  return map[type] || "ellipse-outline";
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface TravelInfo {
  distanceKm: number;
  drivingMinutes: number;
  motorbikeMinutes: number;
  walkingMinutes: number;
  defaultMode: "driving" | "walking";
}

export function getTravelInfo(from: ItineraryActivity, to: ItineraryActivity): TravelInfo | null {
  if (
    from.latitude == null ||
    from.longitude == null ||
    to.latitude == null ||
    to.longitude == null
  )
    return null;
  const dist = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  if (dist < 0.01) return null;
  const roadDist = dist * 1.3;
  const drivingMin = Math.max(1, Math.round((roadDist / 40) * 60));
  const motorbikeMin = Math.max(1, Math.round((roadDist / 30) * 60));
  const walkingMin = Math.max(1, Math.round((roadDist / 5) * 60));
  return {
    distanceKm: Math.round(roadDist * 10) / 10,
    drivingMinutes: drivingMin,
    motorbikeMinutes: motorbikeMin,
    walkingMinutes: walkingMin,
    defaultMode: roadDist <= 1 ? "walking" : "driving",
  };
}

export function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
  if (!match) return -1;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

export function formatTimeInput(val: string): string {
  const cleaned = val.replace(/[^\d]/g, "");
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}:${cleaned.slice(4, 6)}`;
}

export function sortActivitiesByTime(activities: ItineraryActivity[]): ItineraryActivity[] {
  return [...activities].sort((a, b) => {
    const timeA = parseTimeToMinutes(a.time);
    const timeB = parseTimeToMinutes(b.time);
    if (timeA === timeB) return 0;
    if (timeA === -1) return 1;
    if (timeB === -1) return -1;
    return timeA - timeB;
  });
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function parseDurationToMinutes(duration: any): number {
  if (typeof duration === "number") return duration;
  if (!duration || typeof duration !== "string") return 60;
  const hourMatch = duration.match(/([\d.]+)\s*giờ/);
  const minMatch = duration.match(/(\d+)\s*phút/);
  let total = 0;
  if (hourMatch) total += parseFloat(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total > 0 ? total : 60;
}

export function formatDuration(duration: any): string {
  const mins = parseDurationToMinutes(duration);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  let res = "";
  if (h > 0) res += `${h} giờ`;
  if (m > 0) res += `${h > 0 ? " " : ""}${m} phút`;
  return res.trim();
}
