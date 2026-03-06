import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import {
  getDestinations,
  saveDestinations,
  getItineraries,
  saveItineraries,
  getReviews,
  saveReviews,
  generateId,
  type Destination,
  type Itinerary,
  type ItineraryDay,
  type ItineraryActivity,
  type Review,
} from "@/lib/storage";
import { SEED_DESTINATIONS } from "@/lib/seed-data";

interface DataContextValue {
  destinations: Destination[];
  itineraries: Itinerary[];
  reviews: Review[];
  isLoading: boolean;
  addDestination: (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive">) => Promise<Destination>;
  updateDestination: (id: string, data: Partial<Destination>) => Promise<void>;
  deleteDestination: (id: string) => Promise<void>;
  addItinerary: (itin: Omit<Itinerary, "id" | "createdAt">) => Promise<Itinerary>;
  updateItinerary: (id: string, data: Partial<Itinerary>) => Promise<void>;
  deleteItinerary: (id: string) => Promise<void>;
  addReview: (review: Omit<Review, "id" | "createdAt">) => Promise<Review>;
  deleteReview: (id: string) => Promise<void>;
  generateItinerary: (params: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: string;
    numPeople: number;
    preferences: string[];
    userId: string;
  }) => Promise<Itinerary>;
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

function generateDays(
  startDate: string,
  endDate: string,
  destination: string,
  preferences: string[],
  allDestinations: Destination[]
): ItineraryDay[] {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const relevantDests = allDestinations.filter((d) => {
    const matchesDest = d.name.toLowerCase().includes(destination.toLowerCase()) ||
      d.address.toLowerCase().includes(destination.toLowerCase());
    const matchesTags = preferences.some((p) =>
      d.tags.some((t) => t.toLowerCase().includes(p.toLowerCase())) ||
      d.category.toLowerCase().includes(p.toLowerCase())
    );
    return matchesDest || matchesTags;
  });

  const destsToUse = relevantDests.length > 0 ? relevantDests : allDestinations.slice(0, 3);

  const morningActivities = [
    "Khám phá chợ địa phương và ăn sáng",
    "Tham quan các di tích lịch sử",
    "Tập yoga buổi sáng bên bờ biển",
    "Tham gia tour đi bộ khám phá",
    "Leo núi ngắm cảnh từ trên cao",
    "Thăm làng nghề truyền thống",
    "Đạp xe quanh khu phố cổ",
  ];

  const afternoonActivities = [
    "Ăn trưa tại nhà hàng địa phương",
    "Tham quan bảo tàng và di tích văn hóa",
    "Các hoạt động thể thao dưới nước",
    "Chụp ảnh tại các địa điểm nổi tiếng",
    "Mua sắm đồ thủ công mỹ nghệ",
    "Thưởng thức đặc sản vùng miền",
    "Khám phá hang động và khu sinh thái",
  ];

  const eveningActivities = [
    "Ngắm hoàng hôn tại bờ biển",
    "Ăn tối với các món đặc sản địa phương",
    "Khám phá chợ đêm",
    "Xem biểu diễn nghệ thuật truyền thống",
    "Nghỉ ngơi và thư giãn tại khách sạn",
    "Dạo phố đêm và thưởng thức cà phê",
    "Trải nghiệm ẩm thực đường phố",
  ];

  const morningDescriptions = [
    (name: string) => `Bắt đầu ngày mới tại ${name} với bữa sáng truyền thống`,
    (name: string) => `Khám phá vẻ đẹp văn hóa lịch sử tại ${name}`,
    (name: string) => `Tận hưởng không khí trong lành buổi sáng tại ${name}`,
    (name: string) => `Tìm hiểu cuộc sống người dân địa phương tại ${name}`,
  ];

  const afternoonDescriptions = [
    (name: string) => `Tận hưởng buổi chiều khám phá ${name}`,
    (name: string) => `Trải nghiệm những hoạt động thú vị tại ${name}`,
    (name: string) => `Dành buổi chiều tham quan các điểm nổi bật tại ${name}`,
  ];

  const eveningDescriptions = [
    (name: string) => `Kết thúc ngày với trải nghiệm tuyệt vời tại ${name}`,
    (name: string) => `Thưởng thức buổi tối thư giãn tại ${name}`,
    (name: string) => `Tận hưởng không gian đêm tại ${name}`,
  ];

  const days: ItineraryDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const destIdx = i % destsToUse.length;
    const dest = destsToUse[destIdx];
    const destName = dest?.name || destination;

    const destHighlights = dest?.highlights || [];
    const morningHighlight = destHighlights.length > 0 ? destHighlights[(i * 2) % destHighlights.length] : null;
    const afternoonHighlight = destHighlights.length > 1 ? destHighlights[(i * 2 + 1) % destHighlights.length] : null;

    const activities: ItineraryActivity[] = [
      {
        id: generateId(),
        time: "08:00",
        title: morningHighlight || morningActivities[i % morningActivities.length],
        description: morningDescriptions[i % morningDescriptions.length](destName),
        destinationId: dest?.id,
        duration: "2 giờ",
      },
      {
        id: generateId(),
        time: "12:00",
        title: afternoonHighlight || afternoonActivities[i % afternoonActivities.length],
        description: afternoonDescriptions[i % afternoonDescriptions.length](destName),
        destinationId: dest?.id,
        duration: "3 giờ",
      },
      {
        id: generateId(),
        time: "18:00",
        title: eveningActivities[i % eveningActivities.length],
        description: eveningDescriptions[i % eveningDescriptions.length](destName),
        destinationId: dest?.id,
        duration: "2 giờ",
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

export function DataProvider({ children }: { children: ReactNode }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    let dests = await getDestinations();
    const needsReseed = dests.length === 0 || (dests.length > 0 && dests[0]?.name === "Ha Long Bay");
    if (needsReseed) {
      dests = SEED_DESTINATIONS;
      await saveDestinations(dests);
    }
    setDestinations(dests);
    setItineraries(await getItineraries());
    setReviews(await getReviews());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addDestination = useCallback(async (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive">) => {
    const newDest: Destination = { ...dest, id: generateId(), rating: 0, reviewCount: 0, isActive: true };
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

  const deleteReview = useCallback(async (id: string) => {
    const all = (await getReviews()).filter((r) => r.id !== id);
    await saveReviews(all);
    setReviews(all);
  }, []);

  const generateItinerary = useCallback(async (params: {
    destination: string;
    startDate: string;
    endDate: string;
    budget: string;
    numPeople: number;
    preferences: string[];
    userId: string;
  }) => {
    const allDests = await getDestinations();
    const days = generateDays(params.startDate, params.endDate, params.destination, params.preferences, allDests);
    const itin: Omit<Itinerary, "id" | "createdAt"> = {
      userId: params.userId,
      title: `Trip to ${params.destination}`,
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      budget: params.budget,
      numPeople: params.numPeople,
      preferences: params.preferences,
      days,
      status: "draft",
      isShared: false,
    };
    return addItinerary(itin);
  }, [addItinerary]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const value = useMemo(
    () => ({
      destinations,
      itineraries,
      reviews,
      isLoading,
      addDestination,
      updateDestination,
      deleteDestination,
      addItinerary,
      updateItinerary,
      deleteItinerary,
      addReview,
      deleteReview,
      generateItinerary,
      refreshData,
    }),
    [destinations, itineraries, reviews, isLoading, addDestination, updateDestination, deleteDestination, addItinerary, updateItinerary, deleteItinerary, addReview, deleteReview, generateItinerary, refreshData]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
