import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import {
  type Destination,
  type Itinerary,
  type ItineraryDay,
  type Review,
  type Notification,
  type POI,
  type DestinationType,
  type ExpenseType,
  type Preference,
  type PoiType,
  generateId,
} from "@/lib/storage";
import { SEED_DESTINATIONS } from "@/lib/seed-data";
import { apiRequest, getApiUrl, getApiHeaders } from "@/lib/query-client";
import {
  mapDestination as mapDestinationFromUtils,
  mapDestinationType as mapDestinationTypeFromUtils,
  mapExpenseType as mapExpenseTypeFromUtils,
  mapItinerary as mapItineraryFromUtils,
  mapNotification as mapNotificationFromUtils,
  mapPoi as mapPoiFromUtils,
  mapPoiType as mapPoiTypeFromUtils,
  mapPreference as mapPreferenceFromUtils,
  mapReview as mapReviewFromUtils,
  generateDays as generateDaysFromUtils,
} from "@/lib/mappers";

interface DataContextValue {
  destinations: Destination[];
  destinationTypes: DestinationType[];
  itineraries: Itinerary[];
  reviews: Review[];
  notifications: Notification[];
  pois: POI[];
  expenseTypes: ExpenseType[];
  poiTypes: PoiType[];
  preferences: Preference[];
  isLoading: boolean;
  addDestination: (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive"> & { rating?: number; reviewCount?: number }) => Promise<Destination>;
  updateDestination: (id: string, data: Partial<Destination>) => Promise<void>;
  deleteDestination: (id: string) => Promise<void>;
  addItinerary: (itin: Omit<Itinerary, "id" | "createdAt">) => Promise<Itinerary>;
  importItinerary: (itin: Itinerary) => Promise<void>;
  updateItinerary: (id: string, data: Partial<Itinerary>) => Promise<void>;
  deleteItinerary: (id: string) => Promise<void>;
  addReview: (review: Omit<Review, "id" | "createdAt">) => Promise<Review>;
  updateReview: (id: string, data: Partial<Review> & { userId?: number | string; type?: 'trip' | 'item' }) => Promise<void>;
  deleteReview: (id: string, params?: { userId: string | number; type?: string }) => Promise<void>;
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
  refreshData: (filters?: { destinationTypeId?: string | number }) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

// ═══════════════════════════════════════════
// Helper: map server response fields to client types
// ═══════════════════════════════════════════
async function unwrapResponse(res: Response): Promise<any> {
  const json = await res.json();
  console.log(`[Data] Raw response from ${res.url}:`, JSON.stringify(json).substring(0, 100) + "...");
  // Handle backend envelope { status, message, data, errors }
  if (json && typeof json === 'object' && 'data' in json && 'status' in json) {
    console.log(`[Data] Unwrapped data from ${res.url}, count:`, Array.isArray(json.data) ? json.data.length : "object");
    return json.data;
  }
  return json;
}

// ═══════════════════════════════════════════
// DataProvider - all CRUD operations via API
// ═══════════════════════════════════════════

export function DataProvider({ children }: { children: ReactNode }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationTypes, setDestinationTypes] = useState<DestinationType[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [poiTypes, setPoiTypes] = useState<PoiType[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    console.log("[Data] Starting loadData (Robust)...");
    setIsLoading(true);

    const fetchEntity = async (route: string, mapper: (d: any) => any, setter: (val: any) => void) => {
      try {
        const res = await apiRequest("GET", route);
        const data = await unwrapResponse(res);
        if (Array.isArray(data)) {
          setter(data.map(mapper));
          console.log(`[Data] Loaded ${route} successfully:`, data.length);
        } else {
          console.warn(`[Data] Expected array from ${route}, got:`, typeof data);
        }
      } catch (err: any) {
        console.warn(`[Data] Failed to load ${route}:`, err.message || err);
      }
    };

    try {
      // 1. Destinations (Critical)
      try {
        const destsRes = await apiRequest("GET", "/api/destinations");
        let dests = (await unwrapResponse(destsRes) as any[]).map(mapDestinationFromUtils);

        if (dests.length === 0) {
          console.log("[Data] No destinations found, seeding...");
          for (const seed of SEED_DESTINATIONS) {
            try { await apiRequest("POST", "/api/destinations", seed); } catch { }
          }
          const freshRes = await apiRequest("GET", "/api/destinations");
          dests = (await unwrapResponse(freshRes) as any[]).map(mapDestinationFromUtils);
        }
        setDestinations(dests);
        console.log("[Data] Destinations loaded:", dests.length);
      } catch (err) {
        console.error("[Data] Critical error loading destinations:", err);
      }

      // 2. Others (Non-critical, independent)
      await Promise.all([
        fetchEntity("/api/trips", mapItineraryFromUtils, setItineraries),
        fetchEntity("/api/pois", mapPoiFromUtils, setPois),
        fetchEntity("/api/reviews", mapReviewFromUtils, setReviews), // Might 404, handled by fetchEntity try-catch
        fetchEntity("/api/notifications", mapNotificationFromUtils, setNotifications),
        fetchEntity("/api/destination-types", mapDestinationTypeFromUtils, setDestinationTypes),
        fetchEntity("/api/expense-types", mapExpenseTypeFromUtils, setExpenseTypes),
        fetchEntity("/api/poi-types", mapPoiTypeFromUtils, setPoiTypes),
        fetchEntity("/api/preferences", mapPreferenceFromUtils, setPreferences),
      ]);

    } catch (err) {
      console.warn("[Data] Global loadData error:", err);
    } finally {
      setIsLoading(false);
      console.log("[Data] loadData complete.");
    }
  }, []);

  const fetchDestinations = useCallback(async (filters?: { destinationTypeId?: string | number }) => {
    try {
      let url = "/api/destinations";
      if (filters?.destinationTypeId) {
        url += `?typeId=${filters.destinationTypeId}`;
      }
      const res = await apiRequest("GET", url);
      const data = await unwrapResponse(res);
      if (Array.isArray(data)) {
        setDestinations(data.map(mapDestinationFromUtils));
        console.log(`[Data] Cached destinations updated (filtered: ${!!filters?.destinationTypeId})`);
      }
    } catch (err) {
      console.error("[Data] Error fetching destinations:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Destinations ──────────────────────────

  const addDestination = useCallback(async (dest: Omit<Destination, "id" | "rating" | "reviewCount" | "isActive"> & { rating?: number; reviewCount?: number }) => {
    const payload = { ...dest, rating: dest.rating || 0, reviewCount: dest.reviewCount || 0, isActive: true };
    const res = await apiRequest("POST", "/api/destinations", payload);
    const created = mapDestinationFromUtils(await unwrapResponse(res));
    setDestinations((prev) => [...prev, created]);
    return created;
  }, []);

  const updateDestination = useCallback(async (id: string, data: Partial<Destination>) => {
    const res = await apiRequest("PUT", `/api/destinations/${id}`, data);
    const updated = mapDestinationFromUtils(await unwrapResponse(res));
    setDestinations((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }, []);

  const deleteDestination = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/destinations/${id}`);
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // ── Itineraries ───────────────────────────

  const addItinerary = useCallback(async (itin: Omit<Itinerary, "id" | "createdAt">) => {
    const res = await apiRequest("POST", "/api/trips", itin);
    const created = mapItineraryFromUtils(await unwrapResponse(res));
    setItineraries((prev) => [...prev, created]);
    return created;
  }, []);

  const importItinerary = useCallback(async (itin: Itinerary) => {
    // Check if already exists on server
    try {
      const existingRes = await apiRequest("GET", `/api/trips/${itin.id}`);
      const existing = mapItineraryFromUtils(await unwrapResponse(existingRes));
      // Trip exists on server — update companions if the import has newer data
      if (itin.companions && itin.companions.length > 0) {
        const mergedCompanions = [...(existing.companions || [])];
        for (const c of itin.companions) {
          if (!mergedCompanions.some((mc) => mc.userId === c.userId)) {
            mergedCompanions.push(c);
          }
        }
        if (mergedCompanions.length > (existing.companions || []).length) {
          const res = await apiRequest("PUT", `/api/trips/${itin.id}`, { companions: mergedCompanions });
          const updated = mapItineraryFromUtils(await unwrapResponse(res));
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
      const res = await apiRequest("POST", "/api/trips", itin);
      const created = mapItineraryFromUtils(await unwrapResponse(res));
      setItineraries((prev) => [...prev, created]);
    }
  }, []);

  const updateItinerary = useCallback(async (id: string, data: Partial<Itinerary>) => {
    const res = await apiRequest("PUT", `/api/trips/${id}`, data);
    const updated = mapItineraryFromUtils(await unwrapResponse(res));
    setItineraries((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }, []);

  const deleteItinerary = useCallback(async (id: string) => {
    await apiRequest("DELETE", `/api/trips/${id}`);
    setItineraries((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Reviews ───────────────────────────────

  const addReview = useCallback(async (review: Omit<Review, "id" | "createdAt">) => {
    const res = await apiRequest("POST", "/api/reviews", review);
    const created = mapReviewFromUtils(await unwrapResponse(res));
    // Merge input data to ensure fields like poiId, activityId are preserved if missing in server response
    const finalReview = { ...review, ...created };
    setReviews((prev) => [...prev, finalReview]);
    return finalReview;
  }, []);

  const updateReview = useCallback(async (id: string, data: Partial<Review> & { userId?: number | string; type?: 'trip' | 'item' }) => {
    const { type, ...body } = data;
    const res = await apiRequest("PUT", `/api/reviews/${id}${type ? `?type=${type}` : ""}`, body);
    const serverResult = await unwrapResponse(res);
    const updated = mapReviewFromUtils(serverResult);

    setReviews((prev) => prev.map((r) => {
      if (r.id === id) {
        // Only merge if we actually found a match
        return { ...r, ...updated };
      }
      return r;
    }));
  }, []);

  const deleteReview = useCallback(async (id: string, params?: { userId: string | number; type?: string }) => {
    let url = `/api/reviews/${id}?userId=${params?.userId}`;
    if (params?.type) url += `&type=${params.type}`;
    await apiRequest("DELETE", url);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Notifications ─────────────────────────

  const addNotification = useCallback(async (notif: Omit<Notification, "id" | "createdAt" | "isRead">) => {
    const res = await apiRequest("POST", "/api/notifications", { ...notif, isRead: false });
    const created = mapNotificationFromUtils(await unwrapResponse(res));
    setNotifications((prev) => [...prev, created]);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    const res = await apiRequest("PUT", `/api/notifications/${id}`, { isRead: true });
    const updated = mapNotificationFromUtils(await unwrapResponse(res));
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }, []);

  const markAllNotificationsRead = useCallback(async (userId: string) => {
    try {
      await apiRequest("PATCH", "/api/notifications/mark-read", { userId });
      console.log(`[Data] All notifications for user ${userId} marked as read`);
    } catch (err: any) {
      console.warn("[Data] Failed to mark all notifications read on server:", err.message);
    }

    setNotifications((prev) =>
      prev.map((n) => (n.userId === userId ? { ...n, isRead: true } : n))
    );
  }, []);

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
    const created = mapPoiFromUtils(await unwrapResponse(res));
    setPois((prev) => [...prev, created]);
    return created;
  }, []);

  const updatePOI = useCallback(async (id: string, data: Partial<POI>) => {
    const res = await apiRequest("PUT", `/api/pois/${id}`, data);
    const updated = mapPoiFromUtils(await unwrapResponse(res));
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
            const discovered = await unwrapResponse(discoveryRes);
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

      days = generateDaysFromUtils(params.startDate, params.endDate, params.destination, params.preferences, allDests, params.numPeople, params.startingPoint, allPOIs);
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

  const refreshData = useCallback(async (filters?: { destinationTypeId?: string | number }) => {
    if (filters) {
      await fetchDestinations(filters);
    } else {
      await loadData();
    }
  }, [loadData, fetchDestinations]);

  const value = useMemo(
    () => ({
      destinations,
      destinationTypes,
      itineraries,
      reviews,
      notifications,
      pois,
      expenseTypes,
      poiTypes,
      preferences,
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
    [destinations, destinationTypes, itineraries, reviews, notifications, pois, expenseTypes, poiTypes, preferences, isLoading, addDestination, updateDestination, deleteDestination, addItinerary, importItinerary, updateItinerary, deleteItinerary, addReview, updateReview, deleteReview, addPOI, updatePOI, deletePOI, generateItinerary, addNotification, markNotificationRead, markAllNotificationsRead, clearNotifications, refreshData]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
