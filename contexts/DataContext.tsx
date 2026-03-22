import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import {
  getDestinations,
  saveDestinations,
  getItineraries,
  saveItineraries,
  getReviews,
  saveReviews,
  getNotifications,
  saveNotifications,
  getPOIs,
  savePOIs,
  generateId,
  formatVND,
  type Destination,
  type Itinerary,
  type ItineraryDay,
  type ItineraryActivity,
  type Review,
  type Notification,
  type POI,
} from "@/lib/storage";
import { SEED_DESTINATIONS } from "@/lib/seed-data";
import { getApiUrl, getApiHeaders } from "@/lib/query-client";

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
  // ALWAYS stay within the user's chosen destination — never switch to another place
  let relevantDests = allDestinations.filter((d) => {
    return d.name.toLowerCase().includes(destination.toLowerCase()) ||
      d.address.toLowerCase().includes(destination.toLowerCase()) ||
      destination.toLowerCase().includes(d.name.toLowerCase());
  });

  // If no seed data matches, create a placeholder using the user's destination name
  if (relevantDests.length === 0) {
    relevantDests = [{
      id: "temp_dest",
      name: destination,
      description: `Khám phá ${destination}`,
      images: [],
      category: "Khác",
      address: destination,
      latitude: 0,
      longitude: 0,
      rating: 0,
      reviewCount: 0,
      priceRange: "2-5 triệu",
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

  // ═══════════════════════════════════════════
  // Collect POIs for this destination
  // ═══════════════════════════════════════════
  const destIds = new Set(relevantDests.map((d) => d.id));
  const destPOIs = (allPOIs || []).filter((p) => p.isActive && destIds.has(p.destinationId));

  // Split POIs by type and sort by rating (best first)
  const foodPOIs = destPOIs
    .filter((p) => p.type === "restaurant" || p.type === "cafe")
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const attractionPOIs = destPOIs
    .filter((p) => p.type === "attraction" || p.type === "shopping" || p.type === "other")
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const allSortedPOIs = [...destPOIs].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const hasPOIs = destPOIs.length > 0;

  // Fallback activities templates
  const morningActivities = [
    `Khám phá chợ địa phương và ăn sáng tại ${destination}`,
    `Tham quan các di tích lịch sử tại ${destination}`,
    `Tham gia tour đi bộ khám phá ${destination}`,
    `Thăm làng nghề truyền thống tại ${destination}`,
    `Đạp xe quanh ${destination}`,
    `Ngắm cảnh buổi sáng tại ${destination}`,
    `Khám phá điểm tham quan nổi tiếng ${destination}`,
  ];
  const afternoonActivities = [
    `Tham quan bảo tàng và di tích văn hóa tại ${destination}`,
    `Chụp ảnh tại các địa điểm nổi tiếng ${destination}`,
    `Mua sắm đồ thủ công mỹ nghệ tại ${destination}`,
    `Thưởng thức đặc sản vùng miền tại ${destination}`,
    `Khám phá thiên nhiên tại ${destination}`,
    `Trải nghiệm hoạt động giải trí tại ${destination}`,
  ];
  const eveningActivities = [
    `Ngắm hoàng hôn tại ${destination}`,
    `Khám phá chợ đêm ${destination}`,
    `Dạo phố đêm và thưởng thức cà phê tại ${destination}`,
    `Trải nghiệm ẩm thực đường phố ${destination}`,
    `Thư giãn buổi tối tại ${destination}`,
  ];

  // Helpers to pick POIs cyclically without repeating on the same day
  let foodIdx = 0;
  let attractionIdx = 0;

  function pickFoodPOI(): POI | null {
    if (foodPOIs.length === 0) return null;
    const poi = foodPOIs[foodIdx % foodPOIs.length];
    foodIdx++;
    return poi;
  }
  function pickAttractionPOI(): POI | null {
    if (attractionPOIs.length === 0) {
      // Fallback: use any POI
      if (allSortedPOIs.length === 0) return null;
      const poi = allSortedPOIs[attractionIdx % allSortedPOIs.length];
      attractionIdx++;
      return poi;
    }
    const poi = attractionPOIs[attractionIdx % attractionPOIs.length];
    attractionIdx++;
    return poi;
  }

  function sortActivitiesByProximity(acts: ItineraryActivity[]): ItineraryActivity[] {
    if (acts.length <= 1) return acts;
    const foodActs = acts.filter(a => a.activityType === "food");
    const nonFoodActs = acts.filter(a => a.activityType !== "food");
    if (nonFoodActs.length > 1) {
      const remaining = [...nonFoodActs];
      const sorted: ItineraryActivity[] = [remaining.shift()!];
      while (remaining.length > 0) {
        const last = sorted[sorted.length - 1];
        if (last.latitude == null || last.longitude == null) {
          sorted.push(remaining.shift()!);
          continue;
        }
        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let j = 0; j < remaining.length; j++) {
          if (remaining[j].latitude != null && remaining[j].longitude != null) {
            const d = haversineDistance(last.latitude, last.longitude, remaining[j].latitude!, remaining[j].longitude!);
            if (d < nearestDist) {
              nearestDist = d;
              nearestIdx = j;
            }
          }
        }
        sorted.push(remaining.splice(nearestIdx, 1)[0]);
      }
      nonFoodActs.splice(0, nonFoodActs.length, ...sorted);
    }
    const foodSlots = ["07:00", "12:00", "18:00"];
    const nonFoodSlots = ["08:30", "14:00", "20:00"];
    const result: ItineraryActivity[] = [];
    for (let i = 0; i < Math.max(foodActs.length, nonFoodActs.length); i++) {
      if (i < foodActs.length) result.push({ ...foodActs[i], time: foodSlots[i] || foodActs[i].time });
      if (i < nonFoodActs.length) result.push({ ...nonFoodActs[i], time: nonFoodSlots[i] || nonFoodActs[i].time });
    }
    result.sort((a, b) => a.time.localeCompare(b.time));
    return result;
  }

  const days: ItineraryDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const destIdx = i % relevantDests.length;
    const dest = relevantDests[destIdx];
    const destName = dest?.name || destination;
    const destCost = dest?.estimatedCostPerPerson || 200000;
    const nearbyFoodList = dest?.nearbyFood || [];

    // Pick POIs for this day
    const breakfastPOI = pickFoodPOI();
    const morningPOI = pickAttractionPOI();
    const lunchPOI = pickFoodPOI();
    const afternoonPOI = pickAttractionPOI();
    const dinnerPOI = pickFoodPOI();
    const eveningPOI = pickAttractionPOI();

    // Fallback to seed data nearbyFood if no POIs
    const breakfastSpot = !breakfastPOI && nearbyFoodList.length > 0 ? nearbyFoodList[i % nearbyFoodList.length] : null;
    const lunchSpot = !lunchPOI && nearbyFoodList.length > 1 ? nearbyFoodList[(i + 1) % nearbyFoodList.length] : null;
    const dinnerSpot = !dinnerPOI && nearbyFoodList.length > 0 ? nearbyFoodList[(i + 2) % nearbyFoodList.length] : null;

    const destHighlights = dest?.highlights || [];
    const morningHighlight = destHighlights.length > 0 ? destHighlights[(i * 2) % destHighlights.length] : null;
    const afternoonHighlight = destHighlights.length > 1 ? destHighlights[(i * 2 + 1) % destHighlights.length] : null;

    const rawActivities: ItineraryActivity[] = [
      // ── Breakfast ──
      {
        id: generateId(),
        time: "07:00",
        title: breakfastPOI
          ? `Ăn sáng tại ${breakfastPOI.name}`
          : breakfastSpot ? `Ăn sáng tại ${breakfastSpot.name}` : "Ăn sáng tại địa phương",
        description: breakfastPOI
          ? `Thưởng thức bữa sáng tại ${breakfastPOI.name} — ⭐ ${breakfastPOI.rating}/5 (${breakfastPOI.reviewCount} đánh giá)`
          : breakfastSpot ? `Thưởng thức ${breakfastSpot.cuisine} tại ${breakfastSpot.address}` : `Bữa sáng tại ${destName}`,
        destinationId: dest?.id,
        duration: "1 giờ",
        estimatedCost: breakfastPOI
          ? (breakfastPOI.estimatedCost || 50000) * numPeople
          : (breakfastSpot?.costPerPerson || 50000) * numPeople,
        isCompleted: false,
        address: breakfastPOI?.address || breakfastSpot?.address || dest?.address,
        latitude: breakfastPOI?.latitude || breakfastSpot?.latitude || dest?.latitude,
        longitude: breakfastPOI?.longitude || breakfastSpot?.longitude || dest?.longitude,
        activityType: "food" as const,
      },
      // ── Morning sightseeing ──
      {
        id: generateId(),
        time: "08:30",
        title: morningPOI
          ? `Tham quan ${morningPOI.name}`
          : morningHighlight || morningActivities[i % morningActivities.length],
        description: morningPOI
          ? `Khám phá ${morningPOI.name} — ⭐ ${morningPOI.rating}/5 (${morningPOI.reviewCount} đánh giá). ${morningPOI.description || ""}`
          : `Bắt đầu ngày mới tại ${destName}`,
        destinationId: dest?.id,
        duration: morningPOI?.estimatedDuration || "2.5 giờ",
        estimatedCost: morningPOI
          ? (morningPOI.estimatedCost || Math.round(destCost * 0.4)) * numPeople
          : Math.round(destCost * 0.4) * numPeople,
        isCompleted: false,
        address: morningPOI?.address || dest?.address,
        latitude: morningPOI?.latitude || dest?.latitude,
        longitude: morningPOI?.longitude || dest?.longitude,
        activityType: "sightseeing" as const,
      },
      // ── Lunch ──
      {
        id: generateId(),
        time: "12:00",
        title: lunchPOI
          ? `Ăn trưa tại ${lunchPOI.name}`
          : lunchSpot ? `Ăn trưa tại ${lunchSpot.name}` : "Ăn trưa tại nhà hàng địa phương",
        description: lunchPOI
          ? `Thưởng thức bữa trưa tại ${lunchPOI.name} — ⭐ ${lunchPOI.rating}/5 (${lunchPOI.reviewCount} đánh giá)`
          : lunchSpot ? `Thưởng thức ${lunchSpot.cuisine} tại ${lunchSpot.address}` : `Bữa trưa ngon tại ${destName}`,
        destinationId: dest?.id,
        duration: "1.5 giờ",
        estimatedCost: lunchPOI
          ? (lunchPOI.estimatedCost || 80000) * numPeople
          : (lunchSpot?.costPerPerson || 80000) * numPeople,
        isCompleted: false,
        address: lunchPOI?.address || lunchSpot?.address || dest?.address,
        latitude: lunchPOI?.latitude || lunchSpot?.latitude || dest?.latitude,
        longitude: lunchPOI?.longitude || lunchSpot?.longitude || dest?.longitude,
        activityType: "food" as const,
      },
      // ── Afternoon sightseeing ──
      {
        id: generateId(),
        time: "14:00",
        title: afternoonPOI
          ? `Tham quan ${afternoonPOI.name}`
          : afternoonHighlight || afternoonActivities[i % afternoonActivities.length],
        description: afternoonPOI
          ? `Tận hưởng buổi chiều tại ${afternoonPOI.name} — ⭐ ${afternoonPOI.rating}/5 (${afternoonPOI.reviewCount} đánh giá). ${afternoonPOI.description || ""}`
          : `Dành buổi chiều tham quan ${destName}`,
        destinationId: dest?.id,
        duration: afternoonPOI?.estimatedDuration || "3 giờ",
        estimatedCost: afternoonPOI
          ? (afternoonPOI.estimatedCost || Math.round(destCost * 0.35)) * numPeople
          : Math.round(destCost * 0.35) * numPeople,
        isCompleted: false,
        address: afternoonPOI?.address || dest?.address,
        latitude: afternoonPOI?.latitude || dest?.latitude,
        longitude: afternoonPOI?.longitude || dest?.longitude,
        activityType: "sightseeing" as const,
      },
      // ── Dinner ──
      {
        id: generateId(),
        time: "18:00",
        title: dinnerPOI
          ? `Ăn tối tại ${dinnerPOI.name}`
          : dinnerSpot ? `Ăn tối tại ${dinnerSpot.name}` : "Ăn tối với món đặc sản địa phương",
        description: dinnerPOI
          ? `Thưởng thức bữa tối tại ${dinnerPOI.name} — ⭐ ${dinnerPOI.rating}/5 (${dinnerPOI.reviewCount} đánh giá)`
          : dinnerSpot ? `Thưởng thức ${dinnerSpot.cuisine} tại ${dinnerSpot.address}` : `Bữa tối đặc sản tại ${destName}`,
        destinationId: dest?.id,
        duration: "1.5 giờ",
        estimatedCost: dinnerPOI
          ? (dinnerPOI.estimatedCost || 120000) * numPeople
          : (dinnerSpot?.costPerPerson || 120000) * numPeople,
        isCompleted: false,
        address: dinnerPOI?.address || dinnerSpot?.address || dest?.address,
        latitude: dinnerPOI?.latitude || dinnerSpot?.latitude || dest?.latitude,
        longitude: dinnerPOI?.longitude || dinnerSpot?.longitude || dest?.longitude,
        activityType: "food" as const,
      },
      // ── Evening ──
      {
        id: generateId(),
        time: "20:00",
        title: eveningPOI
          ? `Khám phá ${eveningPOI.name}`
          : eveningActivities[i % eveningActivities.length],
        description: eveningPOI
          ? `Kết thúc ngày tại ${eveningPOI.name} — ⭐ ${eveningPOI.rating}/5 (${eveningPOI.reviewCount} đánh giá). ${eveningPOI.description || ""}`
          : `Thưởng thức buổi tối thư giãn tại ${destName}`,
        destinationId: dest?.id,
        duration: eveningPOI?.estimatedDuration || "2 giờ",
        estimatedCost: eveningPOI
          ? (eveningPOI.estimatedCost || Math.round(destCost * 0.15)) * numPeople
          : Math.round(destCost * 0.15) * numPeople,
        isCompleted: false,
        address: eveningPOI?.address || dest?.address,
        latitude: eveningPOI?.latitude || dest?.latitude,
        longitude: eveningPOI?.longitude || dest?.longitude,
        activityType: "sightseeing" as const,
      },
    ];

    const activities = sortActivitiesByProximity(rawActivities);

    days.push({
      day: i + 1,
      title: i === 0 ? "Đến nơi & Khám phá" : i === dayCount - 1 ? "Ngày cuối & Khởi hành" : `Ngày ${i + 1} - Trải nghiệm`,
      activities,
    });
  }
  return days;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    let dests = await getDestinations();
    const needsReseed = dests.length === 0 || (dests.length > 0 && !dests[0]?.estimatedCostPerPerson);
    if (needsReseed) {
      dests = SEED_DESTINATIONS;
      await saveDestinations(dests);
    }
    setDestinations(dests);
    setItineraries(await getItineraries());
    setReviews(await getReviews());
    setNotifications(await getNotifications());
    setPois(await getPOIs());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addDestination = useCallback(async (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive"> & { rating?: number; reviewCount?: number }) => {
    const newDest: Destination = { ...dest, id: generateId(), rating: dest.rating || 0, reviewCount: dest.reviewCount || 0, isActive: true };
    const updated = [...(await getDestinations()), newDest];
    await saveDestinations(updated);
    setDestinations(updated);
    return newDest;
  }, []);

  const updateDestination = useCallback(async (id: string, data: Partial<Destination>) => {
    const all = await getDestinations();
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...data };
    await saveDestinations(all);
    setDestinations([...all]);
  }, []);

  const deleteDestination = useCallback(async (id: string) => {
    const all = (await getDestinations()).filter((d) => d.id !== id);
    await saveDestinations(all);
    setDestinations(all);
  }, []);

  const addItinerary = useCallback(async (itin: Omit<Itinerary, "id" | "createdAt">) => {
    const newItin: Itinerary = { ...itin, id: generateId(), createdAt: new Date().toISOString() };
    const updated = [...(await getItineraries()), newItin];
    await saveItineraries(updated);
    setItineraries(updated);
    return newItin;
  }, []);

  const importItinerary = useCallback(async (itin: Itinerary) => {
    const all = await getItineraries();
    if (all.some((i) => i.id === itin.id)) return; // already exists
    const updated = [...all, itin];
    await saveItineraries(updated);
    setItineraries(updated);
  }, []);

  const updateItinerary = useCallback(async (id: string, data: Partial<Itinerary>) => {
    const all = await getItineraries();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...data };
    await saveItineraries(all);
    setItineraries([...all]);
  }, []);

  const deleteItinerary = useCallback(async (id: string) => {
    const all = (await getItineraries()).filter((i) => i.id !== id);
    await saveItineraries(all);
    setItineraries(all);
  }, []);

  const addReview = useCallback(async (review: Omit<Review, "id" | "createdAt">) => {
    const newReview: Review = { ...review, id: generateId(), createdAt: new Date().toISOString() };
    const allReviews = [...(await getReviews()), newReview];
    await saveReviews(allReviews);
    setReviews(allReviews);

    const allDests = await getDestinations();
    const destReviews = allReviews.filter((r) => r.destinationId === review.destinationId);
    const avgRating = destReviews.reduce((sum, r) => sum + r.rating, 0) / destReviews.length;
    const destIdx = allDests.findIndex((d) => d.id === review.destinationId);
    if (destIdx !== -1) {
      allDests[destIdx].rating = Math.round(avgRating * 10) / 10;
      allDests[destIdx].reviewCount = destReviews.length;
      await saveDestinations(allDests);
      setDestinations([...allDests]);
    }

    return newReview;
  }, []);

  const updateReview = useCallback(async (id: string, data: Partial<Review>) => {
    const allReviews = await getReviews();
    const idx = allReviews.findIndex((r) => r.id === id);
    if (idx === -1) return;
    allReviews[idx] = { ...allReviews[idx], ...data };
    await saveReviews(allReviews);
    setReviews([...allReviews]);

    const destId = allReviews[idx].destinationId;
    const destReviewsArr = allReviews.filter((r) => r.destinationId === destId);
    const avgRating = destReviewsArr.reduce((sum, r) => sum + r.rating, 0) / destReviewsArr.length;
    const allDests = await getDestinations();
    const destIdx = allDests.findIndex((d) => d.id === destId);
    if (destIdx !== -1) {
      allDests[destIdx].rating = Math.round(avgRating * 10) / 10;
      allDests[destIdx].reviewCount = destReviewsArr.length;
      await saveDestinations(allDests);
      setDestinations([...allDests]);
    }
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    const currentReviews = await getReviews();
    const deleted = currentReviews.find((r) => r.id === id);
    const all = currentReviews.filter((r) => r.id !== id);
    await saveReviews(all);
    setReviews(all);

    if (deleted) {
      const destReviews = all.filter((r) => r.destinationId === deleted.destinationId);
      const newRating = destReviews.length > 0
        ? destReviews.reduce((sum, r) => sum + r.rating, 0) / destReviews.length
        : 0;
      const currentDests = await getDestinations();
      const destIdx = currentDests.findIndex((d) => d.id === deleted.destinationId);
      if (destIdx !== -1) {
        currentDests[destIdx].rating = Math.round(newRating * 10) / 10;
        currentDests[destIdx].reviewCount = destReviews.length;
        await saveDestinations(currentDests);
        setDestinations([...currentDests]);
      }
    }
  }, []);

  const addNotification = useCallback(async (notif: Omit<Notification, "id" | "createdAt" | "isRead">) => {
    const newNotif: Notification = { ...notif, id: generateId(), createdAt: new Date().toISOString(), isRead: false };
    const all = [...(await getNotifications()), newNotif];
    await saveNotifications(all);
    setNotifications(all);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    const all = await getNotifications();
    const idx = all.findIndex((n) => n.id === id);
    if (idx !== -1) {
      all[idx].isRead = true;
      await saveNotifications(all);
      setNotifications([...all]);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async (userId: string) => {
    const all = await getNotifications();
    all.forEach((n) => { if (n.userId === userId) n.isRead = true; });
    await saveNotifications(all);
    setNotifications([...all]);
  }, []);

  const clearNotifications = useCallback(async (userId: string) => {
    const all = (await getNotifications()).filter((n) => n.userId !== userId);
    await saveNotifications(all);
    setNotifications(all);
  }, []);

  const addPOI = useCallback(async (poi: Omit<POI, "id">) => {
    const newPoi: POI = { ...poi, id: generateId() };
    const updated = [...(await getPOIs()), newPoi];
    await savePOIs(updated);
    setPois(updated);
    return newPoi;
  }, []);

  const updatePOI = useCallback(async (id: string, data: Partial<POI>) => {
    const all = await getPOIs();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...data };
    await savePOIs(all);
    setPois([...all]);
  }, []);

  const deletePOI = useCallback(async (id: string) => {
    const all = (await getPOIs()).filter((p) => p.id !== id);
    await savePOIs(all);
    setPois(all);
  }, []);

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
    // If preview days are provided (from AI preview), use them directly
    let days: ItineraryDay[];
    if (params.previewDays && params.previewDays.length > 0) {
      days = params.previewDays;
    } else {
      // Fallback to local generation
      const allDests = await getDestinations();
      let allPOIs = await getPOIs();

      // ═══ Auto-discover POIs if none exist for this destination ═══
      const relevantDests = allDests.filter((d) =>
        d.name.toLowerCase().includes(params.destination.toLowerCase()) ||
        d.address.toLowerCase().includes(params.destination.toLowerCase()) ||
        params.destination.toLowerCase().includes(d.name.toLowerCase())
      );
      const destIds = new Set(relevantDests.map((d) => d.id));
      const existingPOIs = allPOIs.filter((p) => p.isActive && destIds.has(p.destinationId));

      if (existingPOIs.length < 3 && relevantDests.length > 0) {
        console.log(`[AutoDiscover] No POIs for "${params.destination}", fetching from SerpAPI...`);
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
            const allDiscovered = [
              ...(discovered.restaurants || []),
              ...(discovered.attractions || []),
            ];

            // Save discovered POIs to database
            const newPOIs: POI[] = [];
            for (const item of allDiscovered) {
              if (!item.latitude || !item.longitude || !item.name) continue;
              const newPOI: POI = {
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
              };
              newPOIs.push(newPOI);
            }

            if (newPOIs.length > 0) {
              const updatedAll = [...allPOIs, ...newPOIs];
              await savePOIs(updatedAll);
              setPois(updatedAll);
              allPOIs = updatedAll;
              console.log(`[AutoDiscover] Saved ${newPOIs.length} POIs for "${dest.name}"`);
            }
          }
        } catch (err) {
          console.warn("[AutoDiscover] Failed to auto-discover POIs:", err);
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
    });

    return created;
  }, [addItinerary, addNotification]);

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
