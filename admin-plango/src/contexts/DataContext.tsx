import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  Destination,
  Itinerary,
  Review,
  POI,
  UserData
} from "../lib/types";
import { apiRequest } from "../lib/api";

interface DataContextValue {
  users: UserData[];
  destinations: Destination[];
  destinationTypes: { id: number; name: string }[];
  itineraries: Itinerary[];
  reviews: Review[];
  pois: POI[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  
  // Users
  updateUser: (id: string, data: Partial<UserData>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  fetchUsers: (search?: string) => Promise<void>;

  // Destinations
  addDestination: (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive"> & { rating?: number; reviewCount?: number }) => Promise<Destination>;
  updateDestination: (id: string, data: Partial<Destination>) => Promise<void>;
  deleteDestination: (id: string) => Promise<void>;

  // POIs
  addPOI: (poi: Omit<POI, "id">) => Promise<POI>;
  updatePOI: (id: string, data: Partial<POI>) => Promise<void>;
  deletePOI: (id: string) => Promise<void>;

  // Trips
  deleteItinerary: (id: string) => Promise<void>;

  // Reviews
  deleteReview: (id: string) => Promise<void>;

  // Stats
  adminStats: any;
}

const DataContext = createContext<DataContextValue | null>(null);

function mapUser(u: any): UserData {
  return {
    id: (u.userId || u.id)?.toString() || "",
    username: u.userName || u.username || "",
    password: u.password || "",
    email: u.email || "",
    fullName: u.fullName || u.full_name || u.userName || "",
    phone: u.phone || "",
    avatar: u.avatar || "",
    role: u.role || "user",
    isLocked: u.status === "locked" || u.status === "banned" || u.isLocked || u.is_locked || false,
    preferences: u.preferences || [],
    createdAt: u.createdAt || u.created_at || "",
  };
}

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
    destinationId: (i.destinationId || i.destination_id)?.toString() || "",
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
    status: i.status || "draft",
    isShared: i.isShared ?? i.is_shared ?? false,
    createdAt: i.createdAt ?? i.created_at ?? new Date().toISOString(),
  };
}

function mapReview(r: any): Review {
  const reviewType: 'trip' | 'item' = r.type === 'item' ? 'item' : 'trip';
  // Build a unique ID by combining type + userId + tripId/itemId to avoid key collisions
  const rawId = r.reviewId || r.id || '';
  const uniqueId = `${reviewType}-${r.userId}-${rawId}`;
  return {
    id: uniqueId,
    userId: (r.userId ?? r.user_id ?? "")?.toString(),
    userName: r.userName ?? r.user_name ?? "",
    destinationId: (r.destinationId ?? r.destination_id ?? "")?.toString(),
    poiId: (r.poiId ?? r.poi_id ?? "")?.toString(),
    poiName: r.poiName ?? r.poi_name ?? "",
    activityId: (r.activityId ?? r.activity_id)?.toString(),
    activityTitle: r.activityTitle ?? r.activity_title,
    itineraryId: (r.itineraryId ?? r.itinerary_id ?? r.tripId)?.toString(),
    reviewType,
    destinationName: r.destinationName,
    rating: r.rating ? Number(r.rating) : 0,
    comment: r.comment || "",
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
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

export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationTypes, setDestinationTypes] = useState<{ id: number; name: string }[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiRequest("GET", "/api/users"),
        apiRequest("GET", "/api/destinations"),
        apiRequest("GET", "/api/destination-types"),
        apiRequest("GET", "/api/trips"),
        apiRequest("GET", "/api/pois"),
      ]);
      
      const [usersRes, destsRes, typesRes, itinsRes, poisRes] = results;

      if (usersRes.status === "fulfilled") setUsers(usersRes.value.map(mapUser));
      if (destsRes.status === "fulfilled") setDestinations(destsRes.value.map(mapDestination));
      if (typesRes.status === "fulfilled") {
        setDestinationTypes(typesRes.value.map((t: any) => ({
          id: t.destinationtypeId,
          name: t.typeName
        })));
      }
      if (itinsRes.status === "fulfilled") setItineraries(itinsRes.value.map(mapItinerary));
      if (poisRes.status === "fulfilled") setPois(poisRes.value.map(mapPoi));

      try {
        const stats = await apiRequest("GET", "/api/admin/stats");
        setAdminStats(stats);
      } catch (err) {
        console.log("Admin stats fetch failed");
      }
      
      try {
        const revsData = await apiRequest("GET", "/api/reviews");
        setReviews((revsData as any[]).map(mapReview));
      } catch (err) {
        console.log("No /api/reviews endpoint active");
      }
    } catch (err) {
      console.warn("[Data] Failed to load from server:", err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const updateUser = useCallback(async (id: string, data: Partial<UserData>) => {
    const res = await apiRequest("PUT", `/api/users/${id}`, data);
    const updated = mapUser(res);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/users/${id}`);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const fetchUsers = useCallback(async (search?: string) => {
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiRequest("GET", `/api/users${qs}`);
      setUsers(res.map(mapUser));
    } catch (err) {
      console.warn("Failed to fetch users", err);
    }
  }, []);

  const addDestination = useCallback(async (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive" | "tags"> & { rating?: number; reviewCount?: number; tags?: string[] }) => {
    const payload = { ...dest, rating: dest.rating || 0, reviewCount: dest.reviewCount || 0, isActive: true, tags: dest.tags || [] };
    const res = await apiRequest("POST", "/api/destinations", payload);
    const created = mapDestination(res);
    setDestinations((prev) => [...prev, created]);
    return created;
  }, []);

  const updateDestination = useCallback(async (id: string, data: Partial<Destination>) => {
    const res = await apiRequest("PUT", `/api/destinations/${id}`, data);
    const updated = mapDestination(res);
    setDestinations((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }, []);

  const deleteDestination = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/destinations/${id}`);
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addPOI = useCallback(async (poi: Omit<POI, "id">) => {
    const res = await apiRequest("POST", "/api/pois", poi);
    const created = mapPoi(res);
    setPois((prev) => [...prev, created]);
    return created;
  }, []);

  const updatePOI = useCallback(async (id: string, data: Partial<POI>) => {
    const res = await apiRequest("PUT", `/api/pois/${id}`, data);
    const updated = mapPoi(res);
    setPois((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }, []);

  const deletePOI = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/pois/${id}`);
    setPois((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const deleteItinerary = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/trips/${id}`);
    setItineraries((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/reviews/${id}`);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const value = useMemo(
    () => ({
      users,
      destinations,
      itineraries,
      reviews,
      pois,
      isLoading,
      refreshData,
      updateUser,
      deleteUser,
      fetchUsers,
      addDestination,
      updateDestination,
      deleteDestination,
      addPOI,
      updatePOI,
      deletePOI,
      deleteItinerary,
      deleteReview,
      adminStats,
      destinationTypes
    }),
    [users, destinations, itineraries, reviews, pois, isLoading, refreshData, updateUser, deleteUser, fetchUsers, addDestination, updateDestination, deleteDestination, addPOI, updatePOI, deletePOI, deleteItinerary, deleteReview, adminStats, destinationTypes]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
