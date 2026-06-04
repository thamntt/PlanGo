import type {
  Destination,
  Itinerary,
  ItineraryDay,
  ItineraryActivity,
  Review,
  Notification,
  POI,
  DestinationType,
  ExpenseType,
  Preference,
  PoiType,
} from "@/types";
import { generateId } from "@/lib/format";

export function mapDestination(d: any): Destination {
  return {
    id: (d.destinationId || d.id)?.toString() || "",
    name: d.name || "",
    description: d.description || "",
    images: d.images || [],
    category: d.category || "",
    address: d.address || "",
    latitude: d.latitude ? Number(d.latitude) : 0,
    longitude: d.longitude ? Number(d.longitude) : 0,
    rating: d.rating ? Number(d.rating) : 0,
    reviewCount: d.reviewCount ?? d.review_count ?? d.reviewCounts ?? 0,
    priceRange: d.priceRange ?? d.price_range,
    tags: d.tags || [],
    openHours: d.openHours ?? d.open_hours,
    isActive: d.isActive ?? d.is_active ?? true,
    highlights: d.highlights || [],
    tips: d.tips || [],
    bestTimeToVisit: d.bestTimeToVisit ?? d.best_time_to_visit,
    estimatedCostPerPerson: d.estimatedCostPerPerson
      ? Number(d.estimatedCostPerPerson)
      : d.estimated_cost_per_person
        ? Number(d.estimated_cost_per_person)
        : undefined,
    sampleReviews: d.sampleReviews ?? d.sample_reviews ?? [],
    nearbyFood: d.nearbyFood ?? d.nearby_food ?? [],
    googlePlaceId: d.googlePlaceId ?? d.google_place_id,
    googlePhotos: d.googlePhotos ?? d.google_photos ?? [],
    googleReviews: d.googleReviews ?? d.google_reviews ?? [],
  };
}

export function mapDestinationType(t: any): DestinationType {
  return {
    id: (t.destinationtypeId || t.id)?.toString() || "",
    typeName: t.typeName || "",
    description: t.description || "",
  };
}

export function mapExpenseType(t: any): ExpenseType {
  return {
    id: (t.expenseTypeId || t.id)?.toString() || "",
    name: t.name || "",
    description: t.description || "",
  };
}

export function mapPoiType(t: any): PoiType {
  return {
    id: (t.poitypeId || t.id)?.toString() || "",
    typeName: t.typeName || "",
    description: t.description || "",
  };
}

export function mapPreference(p: any): Preference {
  return {
    id: (p.preferenceId || p.id)?.toString() || "",
    preferenceName: p.preferenceName || "",
    description: p.description || "",
  };
}

export function mapItinerary(i: any): Itinerary {
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
    ownerName: i.ownerName,
    createdAt: i.createdAt ?? i.created_at ?? new Date().toISOString(),
  };
}

export function mapReview(r: any): Review {
  const destinationId = r.destinationId ?? r.destination_id;
  const poiId = r.poiId ?? r.poi_id;
  const itineraryId = r.itineraryId ?? r.itinerary_id ?? r.tripId;
  const activityId = r.activityId ?? r.activity_id;
  const userId = r.userId ?? r.user_id;

  const review: any = {
    id:
      (
        r.id ||
        r.reviewId ||
        r.itemId ||
        r.activity_id ||
        r.activityId ||
        r.tripId ||
        r.itineraryId
      )?.toString() || `${r.userId || userId}-${r.tripId || itineraryId}`,
    rating: r.rating !== undefined ? Number(r.rating) : 0,
    comment: r.comment ?? "",
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
  };

  if (userId !== undefined) review.userId = userId.toString();
  if (r.userName || r.user_name) review.userName = r.userName ?? r.user_name;
  if (r.userAvatarUrl || r.user_avatar_url)
    review.userAvatarUrl = r.userAvatarUrl ?? r.user_avatar_url;
  if (destinationId !== undefined) review.destinationId = destinationId.toString();
  if (poiId !== undefined) review.poiId = poiId.toString();
  if (r.poiName || r.poi_name) review.poiName = r.poiName ?? r.poi_name;
  if (r.activityTitle || r.activity_title)
    review.activityTitle = r.activityTitle ?? r.activity_title;
  if (activityId !== undefined) review.activityId = activityId.toString();
  if (itineraryId !== undefined) review.itineraryId = itineraryId.toString();
  // Trip visit context (TripAdvisor-style review label)
  if (r.tripTitle || r.trip_title) review.tripTitle = r.tripTitle ?? r.trip_title;
  if (r.tripStartDate || r.trip_start_date)
    review.tripStartDate = r.tripStartDate ?? r.trip_start_date;
  if (r.tripEndDate || r.trip_end_date) review.tripEndDate = r.tripEndDate ?? r.trip_end_date;
  const np = r.tripNumPeople ?? r.trip_num_people;
  if (np !== undefined && np !== null) review.tripNumPeople = Number(np);
  // Phase 1.5 engagement
  const photos = r.photos ?? r.photo_urls;
  if (Array.isArray(photos)) review.photos = photos.map(String).filter(Boolean);
  const lvl = r.userReviewerLevel ?? r.user_reviewer_level ?? r.reviewerLevel;
  if (lvl) review.userReviewerLevel = lvl;
  const rc = r.userReviewCount ?? r.user_review_count;
  if (rc !== undefined && rc !== null) review.userReviewCount = Number(rc);

  return review as Review;
}

export function mapNotification(n: any): Notification {
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

export function mapPoi(p: any): POI {
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
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STARTING_POINT_COORDS: Record<string, { lat: number; lng: number }> = {
  "hà nội": { lat: 21.0285, lng: 105.8542 },
  "tp.hcm": { lat: 10.8231, lng: 106.6297 },
  "tp hcm": { lat: 10.8231, lng: 106.6297 },
  "hồ chí minh": { lat: 10.8231, lng: 106.6297 },
  "đà nẵng": { lat: 16.0544, lng: 108.2022 },
  huế: { lat: 16.4698, lng: 107.5792 },
  "hải phòng": { lat: 20.8449, lng: 106.6881 },
  "cần thơ": { lat: 10.0452, lng: 105.7469 },
  "nha trang": { lat: 12.2388, lng: 109.1967 },
  "đà lạt": { lat: 11.9404, lng: 108.4583 },
  vinh: { lat: 18.6796, lng: 105.6813 },
};

function getStartingCoords(startingPoint: string): { lat: number; lng: number } | null {
  const key = startingPoint.toLowerCase().trim();
  for (const [name, coords] of Object.entries(STARTING_POINT_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

export function generateDays(
  startDate: string,
  endDate: string,
  destination: string,
  preferences: string[],
  allDestinations: Destination[],
  numPeople: number,
  startingPoint: string,
  allPOIs?: POI[],
): ItineraryDay[] {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const dayCount = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  let relevantDests = allDestinations.filter((d) => {
    return (
      d.name.toLowerCase().includes(destination.toLowerCase()) ||
      d.address.toLowerCase().includes(destination.toLowerCase()) ||
      destination.toLowerCase().includes(d.name.toLowerCase())
    );
  });

  if (relevantDests.length === 0) {
    relevantDests = [
      {
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
      } as Destination,
    ];
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
  const foodPOIs = destPOIs
    .filter((p) => p.type === "restaurant" || p.type === "cafe")
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const attractionPOIs = destPOIs
    .filter((p) => p.type === "attraction" || p.type === "shopping" || p.type === "other")
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const allSortedPOIs = [...destPOIs].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const morningActivities = [
    `Khám phá chợ địa phương tại ${destination}`,
    `Tham quan di tích lịch sử tại ${destination}`,
    `Đạp xe quanh ${destination}`,
  ];
  const afternoonActivities = [
    `Tham quan bảo tàng tại ${destination}`,
    `Chụp ảnh tại ${destination}`,
    `Mua sắm tại ${destination}`,
  ];
  const eveningActivities = [
    `Ngắm hoàng hôn tại ${destination}`,
    `Khám phá chợ đêm ${destination}`,
    `Dạo phố đêm ${destination}`,
  ];

  let foodIdx = 0,
    attractionIdx = 0;
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
    const breakfastSpot =
      !breakfastPOI && nearbyFoodList.length > 0 ? nearbyFoodList[i % nearbyFoodList.length] : null;
    const lunchSpot =
      !lunchPOI && nearbyFoodList.length > 1
        ? nearbyFoodList[(i + 1) % nearbyFoodList.length]
        : null;
    const dinnerSpot =
      !dinnerPOI && nearbyFoodList.length > 0
        ? nearbyFoodList[(i + 2) % nearbyFoodList.length]
        : null;
    const destHighlights = dest?.highlights || [];
    const morningHighlight =
      destHighlights.length > 0 ? destHighlights[(i * 2) % destHighlights.length] : null;
    const afternoonHighlight =
      destHighlights.length > 1 ? destHighlights[(i * 2 + 1) % destHighlights.length] : null;

    const activities: ItineraryActivity[] = [
      {
        id: generateId(),
        time: "07:00",
        activityType: "food" as const,
        isCompleted: false,
        duration: "1 giờ",
        title: breakfastPOI
          ? `Ăn sáng tại ${breakfastPOI.name}`
          : breakfastSpot
            ? `Ăn sáng tại ${breakfastSpot.name}`
            : "Ăn sáng tại địa phương",
        description: breakfastPOI ? `★ ${breakfastPOI.rating}/5` : `Bữa sáng tại ${destName}`,
        destinationId: dest?.id,
        estimatedCost:
          (breakfastPOI?.estimatedCost || breakfastSpot?.costPerPerson || 50000) * numPeople,
        address: breakfastPOI?.address || breakfastSpot?.address || dest?.address,
        latitude: breakfastPOI?.latitude || breakfastSpot?.latitude || dest?.latitude,
        longitude: breakfastPOI?.longitude || breakfastSpot?.longitude || dest?.longitude,
      },
      {
        id: generateId(),
        time: "08:30",
        activityType: "sightseeing" as const,
        isCompleted: false,
        duration: "2.5 giờ",
        title: morningPOI
          ? `Tham quan ${morningPOI.name}`
          : morningHighlight || morningActivities[i % morningActivities.length],
        description: morningPOI ? `★ ${morningPOI.rating}/5` : `Tham quan ${destName}`,
        destinationId: dest?.id,
        estimatedCost: (morningPOI?.estimatedCost || Math.round(destCost * 0.4)) * numPeople,
        address: morningPOI?.address || dest?.address,
        latitude: morningPOI?.latitude || dest?.latitude,
        longitude: morningPOI?.longitude || dest?.longitude,
      },
      {
        id: generateId(),
        time: "12:00",
        activityType: "food" as const,
        isCompleted: false,
        duration: "1.5 giờ",
        title: lunchPOI
          ? `Ăn trưa tại ${lunchPOI.name}`
          : lunchSpot
            ? `Ăn trưa tại ${lunchSpot.name}`
            : "Ăn trưa tại nhà hàng địa phương",
        description: lunchPOI ? `★ ${lunchPOI.rating}/5` : `Bữa trưa tại ${destName}`,
        destinationId: dest?.id,
        estimatedCost: (lunchPOI?.estimatedCost || lunchSpot?.costPerPerson || 80000) * numPeople,
        address: lunchPOI?.address || lunchSpot?.address || dest?.address,
        latitude: lunchPOI?.latitude || lunchSpot?.latitude || dest?.latitude,
        longitude: lunchPOI?.longitude || lunchSpot?.longitude || dest?.longitude,
      },
      {
        id: generateId(),
        time: "14:00",
        activityType: "sightseeing" as const,
        isCompleted: false,
        duration: "3 giờ",
        title: afternoonPOI
          ? `Tham quan ${afternoonPOI.name}`
          : afternoonHighlight || afternoonActivities[i % afternoonActivities.length],
        description: afternoonPOI ? `★ ${afternoonPOI.rating}/5` : `Tham quan ${destName}`,
        destinationId: dest?.id,
        estimatedCost: (afternoonPOI?.estimatedCost || Math.round(destCost * 0.35)) * numPeople,
        address: afternoonPOI?.address || dest?.address,
        latitude: afternoonPOI?.latitude || dest?.latitude,
        longitude: afternoonPOI?.longitude || dest?.longitude,
      },
      {
        id: generateId(),
        time: "18:00",
        activityType: "food" as const,
        isCompleted: false,
        duration: "1.5 giờ",
        title: dinnerPOI
          ? `Ăn tối tại ${dinnerPOI.name}`
          : dinnerSpot
            ? `Ăn tối tại ${dinnerSpot.name}`
            : "Ăn tối tại nhà hàng địa phương",
        description: dinnerPOI ? `★ ${dinnerPOI.rating}/5` : `Bữa tối tại ${destName}`,
        destinationId: dest?.id,
        estimatedCost:
          (dinnerPOI?.estimatedCost || dinnerSpot?.costPerPerson || 100000) * numPeople,
        address: dinnerPOI?.address || dinnerSpot?.address || dest?.address,
        latitude: dinnerPOI?.latitude || dinnerSpot?.latitude || dest?.latitude,
        longitude: dinnerPOI?.longitude || dinnerSpot?.longitude || dest?.longitude,
      },
      {
        id: generateId(),
        time: "20:00",
        activityType: "other" as const,
        isCompleted: false,
        duration: "2 giờ",
        title: eveningPOI
          ? `Khám phá ${eveningPOI.name}`
          : eveningActivities[i % eveningActivities.length],
        description: eveningPOI ? `★ ${eveningPOI.rating}/5` : `Buổi tối tại ${destName}`,
        destinationId: dest?.id,
        estimatedCost: (eveningPOI?.estimatedCost || Math.round(destCost * 0.15)) * numPeople,
        address: eveningPOI?.address || dest?.address,
        latitude: eveningPOI?.latitude || dest?.latitude,
        longitude: eveningPOI?.longitude || dest?.longitude,
      },
    ];

    days.push({
      day: i + 1,
      title:
        i === 0
          ? "Đến nơi & Khám phá"
          : i === dayCount - 1
            ? "Ngày cuối & Khởi hành"
            : `Ngày ${i + 1} - Trải nghiệm`,
      activities,
    });
  }

  return days;
}
