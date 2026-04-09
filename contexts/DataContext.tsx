import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import {
  type Destination,
  type Itinerary,
  type ItineraryDay,
  type ItineraryActivity,
  type Review,
  type Notification,
  type POI,
  generateId,
  formatVND,
} from "@/lib/storage";
import { SEED_DESTINATIONS } from "@/lib/seed-data";
import { apiRequest, getApiUrl, getApiHeaders } from "@/lib/query-client";

interface DataContextValue {
  destinations: Destination[];
  itineraries: Itinerary[];
  reviews: Review[];
  notifications: Notification[];
  pois: POI[];
  isLoading: boolean;
  addDestination: (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive"> & { rating?: number; reviewCount?: number }) => Promise<Destination>;
  updateDestination: (id: string, data: Partial<Destination>) => Promise<void>;
  deleteDestination: (id: string) => Promise<void>;
  addItinerary: (itin: Omit<Itinerary, "id" | "createdAt">) => Promise<Itinerary>;
  importItinerary: (itin: Itinerary) => Promise<void>;
  updateItinerary: (id: string, data: Partial<Itinerary>) => Promise<void>;
  deleteItinerary: (id: string) => Promise<void>;
  addReview: (review: Omit<Review, "id" | "createdAt">) => Promise<Review>;
  updateReview: (id: string, data: Partial<Review>) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  addPOI: (poi: Omit<POI, "id">) => Promise<POI>;
  updatePOI: (id: string, data: Partial<POI>) => Promise<void>;
  deletePOI: (id: string) => Promise<void>;
  generateItinerary: (params: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: string;
    totalBudget: number;
    startingPoint: string;
    numPeople: number;
    preferences: string[];
    userId: string;
    previewDays?: ItineraryDay[];
  }) => Promise<Itinerary>;
  addNotification: (notif: Omit<Notification, "id" | "createdAt" | "isRead">) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  clearNotifications: (userId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

// ═══════════════════════════════════════════
// Helper: map server response fields to client types
// ═══════════════════════════════════════════
function mapDestination(d: any): Destination {
  return {
    id: (d.destinationId || d.id)?.toString() || "",
    name: d.name || "",
    description: d.description || "",
    images: d.images || [],
    category: d.category || "",
    address: d.address || "",
    latitude: d.latitude || 0,
    longitude: d.longitude || 0,
    rating: d.rating ? Number(d.rating) : 0,
    reviewCount: d.reviewCount ?? d.review_count ?? d.reviewCounts ?? 0,
    priceRange: d.priceRange ?? d.price_range,
    tags: d.tags || [],
    openHours: d.openHours ?? d.open_hours,
    isActive: d.isActive ?? d.is_active ?? true,
    highlights: d.highlights || [],
    tips: d.tips || [],
    bestTimeToVisit: d.bestTimeToVisit ?? d.best_time_to_visit,
    estimatedCostPerPerson: d.estimatedCostPerPerson ?? d.estimated_cost_per_person,
    sampleReviews: d.sampleReviews ?? d.sample_reviews ?? [],
    nearbyFood: d.nearbyFood ?? d.nearby_food ?? [],
    googlePlaceId: d.googlePlaceId ?? d.google_place_id,
    googlePhotos: d.googlePhotos ?? d.google_photos ?? [],
    googleReviews: d.googleReviews ?? d.google_reviews ?? [],
  };
}

function mapItinerary(i: any): Itinerary {
  return {
    id: (i.tripId || i.id)?.toString() || "",
    userId: (i.ownerId || i.userId || i.user_id)?.toString() || "",
    title: i.title || "",
    destination: i.destination || "",
    startDate: i.startDate ?? i.start_date ?? "",
    endDate: i.endDate ?? i.end_date ?? "",
    budget: i.budget || "",
    totalBudget: i.totalBudget ?? i.total_budget ?? 0,
    spentAmount: i.spentAmount ?? i.spent_amount ?? 0,
    startingPoint: i.startingPoint ?? i.starting_point ?? "",
    numPeople: i.numPeople ?? i.num_people ?? 2,
    preferences: i.preferences || [],
    days: i.days || [],
    expenses: i.expenses || [],
    companions: i.companions || [],
    shareCode: i.shareCode ?? i.share_code ?? i.invitationToken,
    sharePermission: i.sharePermission ?? i.share_permission,
    status: i.status || "draft",
    resetCount: i.resetCount ?? i.reset_count ?? 0,
    isShared: i.isShared ?? i.is_shared ?? false,
    createdAt: i.createdAt ?? i.created_at ?? new Date().toISOString(),
  };
}

function mapReview(r: any): Review {
  return {
    id: (r.reviewId || r.id)?.toString() || `${r.userId}-${r.tripId}`,
    userId: (r.userId ?? r.user_id ?? "")?.toString(),
    userName: r.userName ?? r.user_name ?? "",
    destinationId: (r.destinationId ?? r.destination_id ?? "")?.toString(),
    poiId: (r.poiId ?? r.poi_id ?? "")?.toString(),
    poiName: r.poiName ?? r.poi_name ?? "",
    activityId: (r.activityId ?? r.activity_id)?.toString(),
    activityTitle: r.activityTitle ?? r.activity_title,
    itineraryId: (r.itineraryId ?? r.itinerary_id ?? r.tripId)?.toString(),
    rating: r.rating ? Number(r.rating) : 0,
    comment: r.comment || "",
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
  };
}

function mapNotification(n: any): Notification {
  return {
    id: (n.notificationId || n.id)?.toString() || "",
    userId: (n.userId ?? n.user_id ?? "")?.toString(),
    title: n.title || "",
    message: n.message || "",
    type: n.type || "info",
    itineraryId: (n.itineraryId ?? n.itinerary_id ?? n.tripId)?.toString(),
    createdAt: n.createdAt ?? n.created_at ?? new Date().toISOString(),
    isRead: n.isRead ?? n.is_read ?? false,
  };
}

function mapPoi(p: any): POI {
  return {
    id: (p.poiId || p.id)?.toString() || "",
    destinationId: (p.destinationId ?? p.destination_id ?? "")?.toString(),
    name: p.name || "",
    type: p.type || "attraction",
    address: p.address || "",
    latitude: p.latitude ? Number(p.latitude) : 0,
    longitude: p.longitude ? Number(p.longitude) : 0,
    rating: p.rating ? Number(p.rating) : 0,
    reviewCount: p.reviewCounts ?? p.reviewCount ?? p.review_count ?? 0,
    openHours: p.openHours ?? p.open_hours,
    openingHours: p.openingHours ?? p.opening_hours ?? [],
    priceLevel: p.priceLevel ?? p.price_level,
    estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : undefined,
    estimatedDuration: p.estimatedDuration ?? p.estimated_duration,
    description: p.description || "",
    images: p.images || [],
    googlePlaceId: p.googlePlaceId ?? p.google_place_id,
    googlePhotos: p.googlePhotos ?? p.google_photos ?? [],
    googleReviews: p.googleReviews ?? p.google_reviews ?? [],
    tags: p.tags || [],
    isActive: p.isActive ?? p.is_active ?? true,
  };
}

// ═══════════════════════════════════════════
// Local fallback generation (kept for offline/error cases)
// ═══════════════════════════════════════════

function parseDateInput(dateStr: string): Date {
  const match = dateStr.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }
  return new Date(dateStr);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STARTING_POINT_COORDS: Record<string, { lat: number; lng: number }> = {
  "hà nội": { lat: 21.0285, lng: 105.8542 },
  "tp.hcm": { lat: 10.8231, lng: 106.6297 },
  "tp hcm": { lat: 10.8231, lng: 106.6297 },
  "hồ chí minh": { lat: 10.8231, lng: 106.6297 },
  "đà nẵng": { lat: 16.0544, lng: 108.2022 },
  "huế": { lat: 16.4698, lng: 107.5792 },
  "hải phòng": { lat: 20.8449, lng: 106.6881 },
  "cần thơ": { lat: 10.0452, lng: 105.7469 },
  "nha trang": { lat: 12.2388, lng: 109.1967 },
  "đà lạt": { lat: 11.9404, lng: 108.4583 },
  "vinh": { lat: 18.6796, lng: 105.6813 },
};

function getStartingCoords(startingPoint: string): { lat: number; lng: number } | null {
  const key = startingPoint.toLowerCase().trim();
  for (const [name, coords] of Object.entries(STARTING_POINT_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

function generateDays(
  startDate: string,
  endDate: string,
  destination: string,
  preferences: string[],
  allDestinations: Destination[],
  numPeople: number,
  startingPoint: string,
  allPOIs?: POI[]
): ItineraryDay[] {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  let relevantDests = allDestinations.filter((d) => {
    return d.name.toLowerCase().includes(destination.toLowerCase()) ||
      d.address.toLowerCase().includes(destination.toLowerCase()) ||
      destination.toLowerCase().includes(d.name.toLowerCase());
  });

  if (relevantDests.length === 0) {
    relevantDests = [{
      id: "temp_dest",
      name: destination,
      description: `Khám phá ${destination}`,
      images: [],
      category: "Other",
      address: destination,
      latitude: 0,
      longitude: 0,
      rating: 0,
      reviewCount: 0,
      tags: [],
      openHours: "",
      isActive: true,
      highlights: [
        `Tham quan các điểm nổi bật tại ${destination}`,
        `Khám phá văn hóa địa phương ${destination}`,
        `Trải nghiệm ẩm thực ${destination}`,
        `Ngắm cảnh đẹp tại ${destination}`,
      ],
      tips: [],
      bestTimeToVisit: "",
      estimatedCostPerPerson: 200000,
      sampleReviews: [],
      nearbyFood: [],
    } as Destination];
  }

  const startCoords = getStartingCoords(startingPoint);
  if (startCoords) {
    relevantDests = [...relevantDests].sort((a, b) => {
      const distA = haversineDistance(startCoords.lat, startCoords.lng, a.latitude, a.longitude);
      const distB = haversineDistance(startCoords.lat, startCoords.lng, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  const destIds = new Set(relevantDests.map((d) => d.id));
  const destPOIs = (allPOIs || []).filter((p) => p.isActive && destIds.has(p.destinationId));
  const foodPOIs = destPOIs.filter((p) => p.type === "restaurant" || p.type === "cafe").sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const attractionPOIs = destPOIs.filter((p) => p.type === "attraction" || p.type === "shopping" || p.type === "other").sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const allSortedPOIs = [...destPOIs].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const morningActivities = [`Khám phá chợ địa phương tại ${destination}`, `Tham quan di tích lịch sử tại ${destination}`, `Đạp xe quanh ${destination}`];
  const afternoonActivities = [`Tham quan bảo tàng tại ${destination}`, `Chụp ảnh tại ${destination}`, `Mua sắm tại ${destination}`];
  const eveningActivities = [`Ngắm hoàng hôn tại ${destination}`, `Khám phá chợ đêm ${destination}`, `Dạo phố đêm ${destination}`];

  let foodIdx = 0, attractionIdx = 0;
  function pickFoodPOI(): POI | null {
    if (foodPOIs.length === 0) return null;
    return foodPOIs[foodIdx++ % foodPOIs.length];
  }
  function pickAttractionPOI(): POI | null {
    if (attractionPOIs.length === 0) {
      if (allSortedPOIs.length === 0) return null;
      return allSortedPOIs[attractionIdx++ % allSortedPOIs.length];
    }
    return attractionPOIs[attractionIdx++ % attractionPOIs.length];
  }

  const days: ItineraryDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const dest = relevantDests[i % relevantDests.length];
    const destName = dest?.name || destination;
    const destCost = dest?.estimatedCostPerPerson || 200000;
    const nearbyFoodList = dest?.nearbyFood || [];
    const breakfastPOI = pickFoodPOI();
    const morningPOI = pickAttractionPOI();
    const lunchPOI = pickFoodPOI();
    const afternoonPOI = pickAttractionPOI();
    const dinnerPOI = pickFoodPOI();
    const eveningPOI = pickAttractionPOI();
    const breakfastSpot = !breakfastPOI && nearbyFoodList.length > 0 ? nearbyFoodList[i % nearbyFoodList.length] : null;
    const lunchSpot = !lunchPOI && nearbyFoodList.length > 1 ? nearbyFoodList[(i + 1) % nearbyFoodList.length] : null;
    const dinnerSpot = !dinnerPOI && nearbyFoodList.length > 0 ? nearbyFoodList[(i + 2) % nearbyFoodList.length] : null;
    const destHighlights = dest?.highlights || [];
    const morningHighlight = destHighlights.length > 0 ? destHighlights[(i * 2) % destHighlights.length] : null;
    const afternoonHighlight = destHighlights.length > 1 ? destHighlights[(i * 2 + 1) % destHighlights.length] : null;

    const activities: ItineraryActivity[] = [
      {
        id: generateId(), time: "07:00", activityType: "food" as const, isCompleted: false, duration: "1 giờ",
        title: breakfastPOI ? `Ăn sáng tại ${breakfastPOI.name}` : breakfastSpot ? `Ăn sáng tại ${breakfastSpot.name}` : "Ăn sáng tại địa phương",
        description: breakfastPOI ? `★ ${breakfastPOI.rating}/5` : `Bữa sáng tại ${destName}`,
        destinationId: dest?.id, estimatedCost: (breakfastPOI?.estimatedCost || breakfastSpot?.costPerPerson || 50000) * numPeople,
        address: breakfastPOI?.address || breakfastSpot?.address || dest?.address,
        latitude: breakfastPOI?.latitude || breakfastSpot?.latitude || dest?.latitude,
        longitude: breakfastPOI?.longitude || breakfastSpot?.longitude || dest?.longitude,
      },
      {
        id: generateId(), time: "08:30", activityType: "sightseeing" as const, isCompleted: false, duration: "2.5 giờ",
        title: morningPOI ? `Tham quan ${morningPOI.name}` : morningHighlight || morningActivities[i % morningActivities.length],
        description: morningPOI ? `★ ${morningPOI.rating}/5` : `Tham quan ${destName}`,
        destinationId: dest?.id, estimatedCost: (morningPOI?.estimatedCost || Math.round(destCost * 0.4)) * numPeople,
        address: morningPOI?.address || dest?.address, latitude: morningPOI?.latitude || dest?.latitude, longitude: morningPOI?.longitude || dest?.longitude,
      },
      {
        id: generateId(), time: "12:00", activityType: "food" as const, isCompleted: false, duration: "1.5 giờ",
        title: lunchPOI ? `Ăn trưa tại ${lunchPOI.name}` : lunchSpot ? `Ăn trưa tại ${lunchSpot.name}` : "Ăn trưa tại nhà hàng địa phương",
        description: lunchPOI ? `★ ${lunchPOI.rating}/5` : `Bữa trưa tại ${destName}`,
        destinationId: dest?.id, estimatedCost: (lunchPOI?.estimatedCost || lunchSpot?.costPerPerson || 80000) * numPeople,
        address: lunchPOI?.address || lunchSpot?.address || dest?.address,
        latitude: lunchPOI?.latitude || lunchSpot?.latitude || dest?.latitude, longitude: lunchPOI?.longitude || lunchSpot?.longitude || dest?.longitude,
      },
      {
        id: generateId(), time: "14:00", activityType: "sightseeing" as const, isCompleted: false, duration: "3 giờ",
        title: afternoonPOI ? `Tham quan ${afternoonPOI.name}` : afternoonHighlight || afternoonActivities[i % afternoonActivities.length],
        description: afternoonPOI ? `★ ${afternoonPOI.rating}/5` : `Tham quan ${destName}`,
        destinationId: dest?.id, estimatedCost: (afternoonPOI?.estimatedCost || Math.round(destCost * 0.35)) * numPeople,
        address: afternoonPOI?.address || dest?.address, latitude: afternoonPOI?.latitude || dest?.latitude, longitude: afternoonPOI?.longitude || dest?.longitude,
      },
      {
        id: generateId(), time: "18:00", activityType: "food" as const, isCompleted: false, duration: "1.5 giờ",
        title: dinnerPOI ? `Ăn tối tại ${dinnerPOI.name}` : dinnerSpot ? `Ăn tối tại ${dinnerSpot.name}` : "Ăn tối với đặc sản địa phương",
        description: dinnerPOI ? `★ ${dinnerPOI.rating}/5` : `Bữa tối tại ${destName}`,
        destinationId: dest?.id, estimatedCost: (dinnerPOI?.estimatedCost || dinnerSpot?.costPerPerson || 120000) * numPeople,
        address: dinnerPOI?.address || dinnerSpot?.address || dest?.address,
        latitude: dinnerPOI?.latitude || dinnerSpot?.latitude || dest?.latitude, longitude: dinnerPOI?.longitude || dinnerSpot?.longitude || dest?.longitude,
      },
      {
        id: generateId(), time: "20:00", activityType: "sightseeing" as const, isCompleted: false, duration: "2 giờ",
        title: eveningPOI ? `Khám phá ${eveningPOI.name}` : eveningActivities[i % eveningActivities.length],
        description: eveningPOI ? `★ ${eveningPOI.rating}/5` : `Buổi tối tại ${destName}`,
        destinationId: dest?.id, estimatedCost: (eveningPOI?.estimatedCost || Math.round(destCost * 0.15)) * numPeople,
        address: eveningPOI?.address || dest?.address, latitude: eveningPOI?.latitude || dest?.latitude, longitude: eveningPOI?.longitude || dest?.longitude,
      },
    ];

    days.push({
      day: i + 1,
      title: i === 0 ? "Đến nơi & Khám phá" : i === dayCount - 1 ? "Ngày cuối & Khởi hành" : `Ngày ${i + 1} - Trải nghiệm`,
      activities,
    });
  }
  return days;
}

// ═══════════════════════════════════════════
// DataProvider — all CRUD operations via API
// ═══════════════════════════════════════════

export function DataProvider({ children }: { children: ReactNode }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Load all data from server API
      const [destsRes, itinsRes, revsRes, notifsRes, poisRes] = await Promise.all([
        apiRequest("GET", "/api/destinations"),
        apiRequest("GET", "/api/itineraries"),
        apiRequest("GET", "/api/reviews"),
        apiRequest("GET", "/api/notifications"),
        apiRequest("GET", "/api/pois"),
      ]);

      let dests = ((await destsRes.json()) as any[]).map(mapDestination);

      // Seed destinations if empty
      if (dests.length === 0) {
        console.log("[Data] Seeding destinations...");
        for (const seed of SEED_DESTINATIONS) {
          try {
            await apiRequest("POST", "/api/destinations", seed);
          } catch { }
        }
        const freshRes = await apiRequest("GET", "/api/destinations");
        dests = ((await freshRes.json()) as any[]).map(mapDestination);
      }

      setDestinations(dests);
      setItineraries(((await itinsRes.json()) as any[]).map(mapItinerary));
      setReviews(((await revsRes.json()) as any[]).map(mapReview));
      setNotifications(((await notifsRes.json()) as any[]).map(mapNotification));
      setPois(((await poisRes.json()) as any[]).map(mapPoi));
    } catch (err) {
      console.warn("[Data] Failed to load from server:", err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Destinations ──────────────────────────

  const addDestination = useCallback(async (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive"> & { rating?: number; reviewCount?: number }) => {
    const payload = { ...dest, rating: dest.rating || 0, reviewCount: dest.reviewCount || 0, isActive: true };
    const res = await apiRequest("POST", "/api/destinations", payload);
    const created = mapDestination(await res.json());
    setDestinations((prev) => [...prev, created]);
    return created;
  }, []);

  const updateDestination = useCallback(async (id: string, data: Partial<Destination>) => {
    const res = await apiRequest("PUT", `/api/destinations/${id}`, data);
    const updated = mapDestination(await res.json());
    setDestinations((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }, []);

  const deleteDestination = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/destinations/${id}`);
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // ── Itineraries ───────────────────────────

  const addItinerary = useCallback(async (itin: Omit<Itinerary, "id" | "createdAt">) => {
    const res = await apiRequest("POST", "/api/itineraries", itin);
    const created = mapItinerary(await res.json());
    setItineraries((prev) => [...prev, created]);
    return created;
  }, []);

  const importItinerary = useCallback(async (itin: Itinerary) => {
    // Check if already exists on server
    try {
      const existingRes = await apiRequest("GET", `/api/itineraries/${itin.id}`);
      const existing = mapItinerary(await existingRes.json());
      // Trip exists on server — update companions if the import has newer data
      if (itin.companions && itin.companions.length > 0) {
        const mergedCompanions = [...(existing.companions || [])];
        for (const c of itin.companions) {
          if (!mergedCompanions.some((mc) => mc.userId === c.userId)) {
            mergedCompanions.push(c);
          }
        }
        if (mergedCompanions.length > (existing.companions || []).length) {
          const res = await apiRequest("PUT", `/api/itineraries/${itin.id}`, { companions: mergedCompanions });
          const updated = mapItinerary(await res.json());
          setItineraries((prev) => {
            if (prev.some((i) => i.id === itin.id)) {
              return prev.map((i) => (i.id === itin.id ? updated : i));
            }
            return [...prev, updated];
          });
          return;
        }
      }
      // Ensure it's in local state even if no companion update needed
      setItineraries((prev) => {
        if (prev.some((i) => i.id === itin.id)) return prev;
        return [...prev, existing];
      });
    } catch {
      // not found on server, create it
      const res = await apiRequest("POST", "/api/itineraries", itin);
      const created = mapItinerary(await res.json());
      setItineraries((prev) => [...prev, created]);
    }
  }, []);

  const updateItinerary = useCallback(async (id: string, data: Partial<Itinerary>) => {
    const res = await apiRequest("PUT", `/api/itineraries/${id}`, data);
    const updated = mapItinerary(await res.json());
    setItineraries((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const deleteItinerary = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/itineraries/${id}`);
    setItineraries((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Reviews ───────────────────────────────

  const addReview = useCallback(async (review: Omit<Review, "id" | "createdAt">) => {
    const res = await apiRequest("POST", "/api/reviews", review);
    const created = mapReview(await res.json());
    setReviews((prev) => [...prev, created]);
    return created;
  }, []);

  const updateReview = useCallback(async (id: string, data: Partial<Review>) => {
    const res = await apiRequest("PUT", `/api/reviews/${id}`, data);
    const updated = mapReview(await res.json());
    setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/reviews/${id}`);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Notifications ─────────────────────────

  const addNotification = useCallback(async (notif: Omit<Notification, "id" | "createdAt" | "isRead">) => {
    const res = await apiRequest("POST", "/api/notifications", { ...notif, isRead: false });
    const created = mapNotification(await res.json());
    setNotifications((prev) => [...prev, created]);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    const res = await apiRequest("PUT", `/api/notifications/${id}`, { isRead: true });
    const updated = mapNotification(await res.json());
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }, []);

  const markAllNotificationsRead = useCallback(async (userId: string) => {
    // Mark each notification as read
    const userNotifs = notifications.filter((n) => n.userId === userId && !n.isRead);
    await Promise.all(
      userNotifs.map((n) => apiRequest("PUT", `/api/notifications/${n.id}`, { isRead: true }))
    );
    setNotifications((prev) =>
      prev.map((n) => (n.userId === userId ? { ...n, isRead: true } : n))
    );
  }, [notifications]);

  const clearNotifications = useCallback(async (userId: string) => {
    const userNotifs = notifications.filter((n) => n.userId === userId);
    await Promise.all(
      userNotifs.map((n) => apiRequest("DELETE", `/api/notifications/${n.id}`))
    );
    setNotifications((prev) => prev.filter((n) => n.userId !== userId));
  }, [notifications]);

  // ── POIs (now backed by server API) ───────────────────────────

  const addPOI = useCallback(async (poi: Omit<POI, "id">) => {
    const res = await apiRequest("POST", "/api/pois", poi);
    const created = mapPoi(await res.json());
    setPois((prev) => [...prev, created]);
    return created;
  }, []);

  const updatePOI = useCallback(async (id: string, data: Partial<POI>) => {
    const res = await apiRequest("PUT", `/api/pois/${id}`, data);
    const updated = mapPoi(await res.json());
    setPois((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const deletePOI = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/pois/${id}`);
    setPois((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Generate Itinerary ────────────────────

  const generateItinerary = useCallback(async (params: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: string;
    totalBudget: number;
    startingPoint: string;
    numPeople: number;
    preferences: string[];
    userId: string;
    previewDays?: ItineraryDay[];
  }) => {
    let days: ItineraryDay[];
    if (params.previewDays && params.previewDays.length > 0) {
      days = params.previewDays;
    } else {
      // Fallback to local generation with server data
      const allDests = destinations;
      let allPOIs = pois;

      // Auto-discover POIs if none exist
      const relevantDests = allDests.filter((d) =>
        d.name.toLowerCase().includes(params.destination.toLowerCase()) ||
        d.address.toLowerCase().includes(params.destination.toLowerCase()) ||
        params.destination.toLowerCase().includes(d.name.toLowerCase())
      );
      const destIds = new Set(relevantDests.map((d) => d.id));
      const existingPOIs = allPOIs.filter((p) => p.isActive && destIds.has(p.destinationId));

      if (existingPOIs.length < 3 && relevantDests.length > 0) {
        try {
          const dest = relevantDests[0];
          const baseUrl = getApiUrl().replace(/\/$/, "");
          const searchParams = new URLSearchParams({
            query: dest.name || params.destination,
            lat: String(dest.latitude || 0),
            lng: String(dest.longitude || 0),
          });
          const discoveryRes = await fetch(`${baseUrl}/api/places/auto-discover?${searchParams.toString()}`, {
            headers: getApiHeaders(),
          });
          if (discoveryRes.ok) {
            const discovered = await discoveryRes.json();
            const allDiscovered = [...(discovered.restaurants || []), ...(discovered.attractions || [])];
            const newPOIs: POI[] = allDiscovered
              .filter((item: any) => item.latitude && item.longitude && item.name)
              .map((item: any) => ({
                id: generateId(),
                destinationId: dest.id,
                name: item.name,
                type: item.type === "restaurant" ? "restaurant" : "attraction",
                address: item.address || "",
                latitude: item.latitude,
                longitude: item.longitude,
                rating: item.rating || 0,
                reviewCount: item.reviewCount || 0,
                estimatedCost: item.estimatedCost || (item.type === "restaurant" ? 80000 : 50000),
                description: item.description || "",
                images: item.thumbnail ? [item.thumbnail] : [],
                googlePlaceId: item.googlePlaceId || "",
                openHours: item.openHours || "",
                tags: [],
                isActive: true,
              } as POI));
            if (newPOIs.length > 0) {
              allPOIs = [...allPOIs, ...newPOIs];
              setPois(allPOIs);
            }
          }
        } catch (err) {
          console.warn("[AutoDiscover] Failed:", err);
        }
      }

      days = generateDays(params.startDate, params.endDate, params.destination, params.preferences, allDests, params.numPeople, params.startingPoint, allPOIs);
    }

    const itin: Omit<Itinerary, "id" | "createdAt"> = {
      userId: params.userId,
      title: `Chuyến đi ${params.destination}`,
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      budget: params.budget,
      totalBudget: params.totalBudget,
      spentAmount: 0,
      startingPoint: params.startingPoint,
      numPeople: params.numPeople,
      preferences: params.preferences,
      days,
      status: "draft",
      isShared: false,
    };
    const created = await addItinerary(itin);

    await addNotification({
      userId: params.userId,
      title: "Lịch trình mới đã được tạo",
      message: `Chuyến đi ${params.destination} (${params.startDate} - ${params.endDate}) đã được tạo thành công!`,
      type: "success",
      itineraryId: created.id,
    });

    return created;
  }, [addItinerary, addNotification, destinations, pois]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const value = useMemo(
    () => ({
      destinations,
      itineraries,
      reviews,
      notifications,
      pois,
      isLoading,
      addDestination,
      updateDestination,
      deleteDestination,
      addItinerary,
      importItinerary,
      updateItinerary,
      deleteItinerary,
      addReview,
      updateReview,
      deleteReview,
      addPOI,
      updatePOI,
      deletePOI,
      generateItinerary,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      refreshData,
    }),
    [destinations, itineraries, reviews, notifications, pois, isLoading, addDestination, updateDestination, deleteDestination, addItinerary, importItinerary, updateItinerary, deleteItinerary, addReview, updateReview, deleteReview, addPOI, updatePOI, deletePOI, generateItinerary, addNotification, markNotificationRead, markAllNotificationsRead, clearNotifications, refreshData]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
