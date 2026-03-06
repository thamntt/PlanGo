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
    "Explore local markets and enjoy breakfast",
    "Visit historical landmarks",
    "Morning yoga by the beach",
    "Take a guided walking tour",
    "Hike to scenic viewpoints",
  ];

  const afternoonActivities = [
    "Lunch at a local restaurant",
    "Visit museums and cultural sites",
    "Water sports and beach activities",
    "Photography at iconic spots",
    "Shopping for local crafts",
  ];

  const eveningActivities = [
    "Sunset watching at the waterfront",
    "Dinner with local cuisine specialties",
    "Night market exploration",
    "Traditional performance show",
    "Relaxation at the hotel spa",
  ];

  const days: ItineraryDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const destIdx = i % destsToUse.length;
    const dest = destsToUse[destIdx];
    const activities: ItineraryActivity[] = [
      {
        id: generateId(),
        time: "08:00",
        title: morningActivities[i % morningActivities.length],
        description: `Start your day at ${dest?.name || destination}`,
        destinationId: dest?.id,
        duration: "2 hours",
      },
      {
        id: generateId(),
        time: "12:00",
        title: afternoonActivities[i % afternoonActivities.length],
        description: `Enjoy the afternoon exploring ${dest?.name || destination}`,
        destinationId: dest?.id,
        duration: "3 hours",
      },
      {
        id: generateId(),
        time: "18:00",
        title: eveningActivities[i % eveningActivities.length],
        description: `Wind down your evening in ${dest?.name || destination}`,
        destinationId: dest?.id,
        duration: "2 hours",
      },
    ];

    days.push({
      day: i + 1,
      title: i === 0 ? "Arrival & Exploration" : i === dayCount - 1 ? "Final Day & Departure" : `Day ${i + 1} Adventure`,
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
    if (dests.length === 0) {
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
