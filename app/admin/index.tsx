import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { formatVND, type UserData } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";
import { validateDestinationName, validateAddress } from "@/lib/validation";
import { t } from "@/lib/i18n";
import { searchPlaces, getPlaceDetails, getPhotoUrl, mapGoogleTypeToPOIType, getPOITypeLabel, getPOITypeIcon, type PlaceSearchResult } from "@/lib/places";
import { CATEGORIES } from "@/lib/seed-data";
import type { POI } from "@/lib/storage";

type Tab = "dashboard" | "users" | "destinations" | "reviews" | "pois";

interface DestFormErrors {
  name?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: t().common.cancel, style: "cancel" },
      { text: t().common.delete, style: "destructive", onPress: onConfirm },
    ]);
  }
}

function StatCard({ icon, label, value, color, colors }: { icon: string; label: string; value: number; color: string; colors: any }) {
  return (
    <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[s.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user: currentUser, isAdmin } = useAuth();
  const { destinations, itineraries, reviews, pois, deleteDestination, deleteReview, deleteItinerary, updateDestination, addDestination, addPOI, updatePOI, deletePOI } = useData();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const [destModalVisible, setDestModalVisible] = useState(false);
  const [editingDestId, setEditingDestId] = useState<string | null>(null);
  const [destName, setDestName] = useState("");
  const [destDesc, setDestDesc] = useState("");
  const [destAddr, setDestAddr] = useState("");
  const [destCategory, setDestCategory] = useState("City");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [destRating, setDestRating] = useState(0);
  const [destReviewCount, setDestReviewCount] = useState(0);
  const [destGooglePlaceId, setDestGooglePlaceId] = useState("");
  const [destGooglePhotos, setDestGooglePhotos] = useState<{ name: string; attributions: string[] }[]>([]);
  const [destGoogleReviews, setDestGoogleReviews] = useState<{ author: string; rating: number; text: string; time: string }[]>([]);
  const [destErrors, setDestErrors] = useState<DestFormErrors>({});

  const [userDetailId, setUserDetailId] = useState<string | null>(null);
  const [userDetailTab, setUserDetailTab] = useState<"info" | "trips" | "reviews">("info");
  const [editUserModal, setEditUserModal] = useState(false);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState<"user" | "admin">("user");
  const [editUserPassword, setEditUserPassword] = useState("");

  const [destDetailId, setDestDetailId] = useState<string | null>(null);
  const [reviewDetailId, setReviewDetailId] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "active" | "locked">("all");

  const [destSearch, setDestSearch] = useState("");
  const [destCategoryFilter, setDestCategoryFilter] = useState<string>("all");

  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewStarFilter, setReviewStarFilter] = useState<number>(0);
  const [reviewSubTab, setReviewSubTab] = useState<"destinations" | "pois">("destinations");

  // Google Places search state (for destinations)
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<PlaceSearchResult[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);

  // POI management state
  const [poiModalVisible, setPoiModalVisible] = useState(false);
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null);
  const [poiName, setPoiName] = useState("");
  const [poiAddress, setPoiAddress] = useState("");
  const [poiType, setPoiType] = useState<POI["type"]>("attraction");
  const [poiDestId, setPoiDestId] = useState("");
  const [poiLat, setPoiLat] = useState("");
  const [poiLng, setPoiLng] = useState("");
  const [poiRating, setPoiRating] = useState("");
  const [poiReviewCount, setPoiReviewCount] = useState("");
  const [poiCost, setPoiCost] = useState("");
  const [poiDuration, setPoiDuration] = useState("");
  const [poiDesc, setPoiDesc] = useState("");
  const [poiOpenHours, setPoiOpenHours] = useState("");
  const [poiGooglePlaceId, setPoiGooglePlaceId] = useState("");
  const [poiGooglePhotos, setPoiGooglePhotos] = useState<{ name: string; attributions: string[] }[]>([]);
  const [poiGoogleReviews, setPoiGoogleReviews] = useState<{ author: string; rating: number; text: string; time: string }[]>([]);
  const [poiSearch, setPoiSearch] = useState("");
  const [poiFilterDest, setPoiFilterDest] = useState<string>("all");
  const [poiGoogleQuery, setPoiGoogleQuery] = useState("");
  const [poiGoogleResults, setPoiGoogleResults] = useState<PlaceSearchResult[]>([]);
  const [poiGoogleLoading, setPoiGoogleLoading] = useState(false);


  const poiTypes: POI["type"][] = ["attraction", "restaurant", "cafe", "hotel", "shopping", "other"];

  // Google search for destinations
  const handleGoogleSearch = async (query: string) => {
    if (!query.trim()) { setGoogleResults([]); return; }
    setGoogleLoading(true);
    const results = await searchPlaces(query);
    setGoogleResults(results);
    setGoogleLoading(false);
  };

  const fillFromGoogleResult = async (place: PlaceSearchResult) => {
    // Check duplicate before filling
    const dup = destinations.find(
      (d) => d.name.toLowerCase() === place.name.toLowerCase() && d.id !== editingDestId
    );
    if (dup) {
      const msg = `Địa điểm "${place.name}" đã tồn tại trong hệ thống. Không thể thêm trùng.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Trùng địa điểm", msg);
      }
      return;
    }
    setDestName(place.name);
    setDestAddr(place.address);
    setDestLat(place.latitude.toString());
    setDestLng(place.longitude.toString());
    setDestDesc(place.editorialSummary || "");
    setDestRating(place.rating || 0);
    setDestReviewCount(place.reviewCount || 0);
    setDestGooglePlaceId(place.placeId || "");
    setDestGooglePhotos(place.photos || []);
    setGoogleResults([]);
    setGoogleQuery("");
    // Load full details for reviews, photos, and more accurate rating
    let finalPhotos = place.photos || [];
    const details = await getPlaceDetails(place.placeId);
    if (details) {
      if (details.rating > 0) setDestRating(details.rating);
      if (details.reviewCount > 0) setDestReviewCount(details.reviewCount);
      if (details.editorialSummary) setDestDesc(prev => prev || String(details.editorialSummary || ""));
      setDestGoogleReviews(details.reviews || []);
      if (details.photos && details.photos.length > 0) {
        finalPhotos = details.photos;
        setDestGooglePhotos(details.photos);
      }
    }
    // Fallback: if still no photos (common for cities), try to search for images by name
    if (finalPhotos.length === 0 && place.name) {
      try {
        const imgResults = await searchPlaces(`${place.name} du lịch`);
        if (imgResults.length > 0) {
          const photosFromSearch: { name: string; attributions: string[] }[] = [];
          for (const r of imgResults) {
            if (r.photos && r.photos.length > 0) {
              photosFromSearch.push(...r.photos);
            }
          }
          if (photosFromSearch.length > 0) {
            setDestGooglePhotos(photosFromSearch.slice(0, 5));
          }
        }
      } catch { /* optional fallback */ }
    }
  };

  // Google search for POIs
  const handlePoiGoogleSearch = async (query: string) => {
    if (!query.trim()) { setPoiGoogleResults([]); return; }
    setPoiGoogleLoading(true);
    const results = await searchPlaces(query);
    setPoiGoogleResults(results);
    setPoiGoogleLoading(false);
  };

  const fillPoiFromGoogle = async (place: PlaceSearchResult) => {
    setPoiName(place.name);
    setPoiAddress(place.address);
    setPoiLat(place.latitude.toString());
    setPoiLng(place.longitude.toString());
    setPoiRating(place.rating.toString());
    setPoiReviewCount(place.reviewCount.toString());
    setPoiType(mapGoogleTypeToPOIType(place.types, place.primaryType));
    setPoiGooglePlaceId(place.placeId);
    setPoiGooglePhotos(place.photos || []);
    setPoiGoogleResults([]);
    setPoiGoogleQuery("");
    // Get full details — rating, reviews, opening hours, price level
    const details = await getPlaceDetails(place.placeId);
    if (details) {
      // Override with more accurate rating from details
      if (details.rating > 0) setPoiRating(details.rating.toString());
      if (details.reviewCount > 0) setPoiReviewCount(details.reviewCount.toString());
      setPoiDesc(details.editorialSummary || "");
      if (details.openingHours && details.openingHours.length > 0) {
        setPoiOpenHours(details.openingHours.join(" | "));
      }
      if (details.website) setPoiDesc(prev => prev ? prev : details.editorialSummary || "");
      setPoiGoogleReviews(details.reviews || []);
      setPoiGooglePhotos(details.photos && details.photos.length > 0 ? details.photos : place.photos || []);
    }
  };

  const openAddPoi = () => {
    setEditingPoiId(null);
    setPoiName(""); setPoiAddress(""); setPoiType("attraction"); setPoiDestId(destinations[0]?.id || "");
    setPoiLat(""); setPoiLng(""); setPoiRating(""); setPoiReviewCount("");
    setPoiCost(""); setPoiDuration(""); setPoiDesc(""); setPoiOpenHours("");
    setPoiGooglePlaceId(""); setPoiGooglePhotos([]); setPoiGoogleReviews([]);
    setPoiGoogleQuery(""); setPoiGoogleResults([]);
    setPoiModalVisible(true);
  };

  const openEditPoi = (id: string) => {
    const poi = pois.find(p => p.id === id);
    if (!poi) return;
    setEditingPoiId(id);
    setPoiName(poi.name); setPoiAddress(poi.address); setPoiType(poi.type);
    setPoiDestId(poi.destinationId); setPoiLat(poi.latitude.toString()); setPoiLng(poi.longitude.toString());
    setPoiRating(poi.rating.toString()); setPoiReviewCount(poi.reviewCount.toString());
    setPoiCost(poi.estimatedCost?.toString() || ""); setPoiDuration(poi.estimatedDuration || "");
    setPoiDesc(poi.description || ""); setPoiOpenHours(poi.openHours || "");
    setPoiGooglePlaceId(poi.googlePlaceId || ""); setPoiGooglePhotos(poi.googlePhotos || []);
    setPoiGoogleReviews(poi.googleReviews || []);
    setPoiGoogleQuery(""); setPoiGoogleResults([]);
    setPoiModalVisible(true);
  };

  const handleSavePoi = async () => {
    if (!poiName.trim()) return;
    const poiData: Omit<POI, "id"> = {
      destinationId: poiDestId,
      name: poiName.trim(),
      type: poiType,
      address: poiAddress.trim(),
      latitude: parseFloat(poiLat) || 0,
      longitude: parseFloat(poiLng) || 0,
      rating: parseFloat(poiRating) || 0,
      reviewCount: parseInt(poiReviewCount) || 0,
      openHours: poiOpenHours || undefined,
      estimatedCost: parseInt(poiCost) || undefined,
      estimatedDuration: poiDuration || undefined,
      description: poiDesc || undefined,
      images: poiGooglePhotos.length > 0 ? poiGooglePhotos.slice(0, 3).map(p => getPhotoUrl(p.name)) : [],
      googlePlaceId: poiGooglePlaceId || undefined,
      googlePhotos: poiGooglePhotos.length > 0 ? poiGooglePhotos : undefined,
      googleReviews: poiGoogleReviews.length > 0 ? poiGoogleReviews : undefined,
      isActive: true,
    };
    if (editingPoiId) {
      await updatePOI(editingPoiId, poiData);
    } else {
      await addPOI(poiData);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPoiModalVisible(false);
  };

  const handleDeletePoi = (id: string, name: string) => {
    confirmAction("Xóa POI", `Bạn có chắc muốn xóa "${name}"?`, () => {
      deletePOI(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const filteredPois = useMemo(() => {
    let result = [...pois];
    if (poiSearch.trim()) {
      const q = poiSearch.toLowerCase().trim();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
    }
    if (poiFilterDest !== "all") result = result.filter(p => p.destinationId === poiFilterDest);
    return result;
  }, [pois, poiSearch, poiFilterDest]);

  const mapUser = (u: any): UserData => ({
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
  });

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/users");
      const data = (await res.json()) as any[];
      setUsers(data.map(mapUser));
    } catch { }
    setUsersLoaded(true);
  }, []);

  useEffect(() => {
    if (!usersLoaded) loadUsers();
  }, [usersLoaded, loadUsers]);

  const txt = t().admin;

  const cleanReviewComment = (comment: string) => comment.replace(/\[activity:[^\]]+\]/g, "").replace(/\[resetBefore:[^\]]+\]/g, "").trim();

  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      result = result.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (userStatusFilter === "active") result = result.filter((u) => !u.isLocked);
    else if (userStatusFilter === "locked") result = result.filter((u) => u.isLocked);
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [users, userSearch, userStatusFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    const seenLabels = new Set<string>();
    destinations.forEach((d) => {
      const label = t().categories[d.category] || d.category;
      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        cats.add(d.category);
      }
    });
    return Array.from(cats).sort((a, b) => {
      const la = t().categories[a] || a;
      const lb = t().categories[b] || b;
      return la.localeCompare(lb, "vi");
    });
  }, [destinations]);

  const filteredDestinations = useMemo(() => {
    let result = [...destinations];
    if (destSearch.trim()) {
      const q = destSearch.toLowerCase().trim();
      result = result.filter((d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || (t().categories[d.category] || "").toLowerCase().includes(q));
    }
    if (destCategoryFilter !== "all") {
      const filterLabel = t().categories[destCategoryFilter] || destCategoryFilter;
      result = result.filter((d) => {
        const destLabel = t().categories[d.category] || d.category;
        return d.category === destCategoryFilter || destLabel === filterLabel;
      });
    }
    result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [destinations, destSearch, destCategoryFilter]);

  const filteredReviews = useMemo(() => {
    let result = [...reviews];
    if (reviewSearch.trim()) {
      const q = reviewSearch.toLowerCase().trim();
      result = result.filter((r) => {
        const dest = destinations.find((d) => d.id === r.destinationId);
        return r.userName.toLowerCase().includes(q) || (dest?.name || "").toLowerCase().includes(q);
      });
    }
    if (reviewStarFilter > 0) result = result.filter((r) => r.rating === reviewStarFilter);
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [reviews, reviewSearch, reviewStarFilter, destinations]);

  const topDestinations = useMemo(() => {
    const destCount: Record<string, number> = {};
    itineraries.forEach((itin) => {
      const name = itin.destination;
      destCount[name] = (destCount[name] || 0) + 1;
    });
    return Object.entries(destCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [itineraries]);

  const recentActivities = useMemo(() => {
    const activities: { icon: string; text: string; date: string; timestamp: number }[] = [];

    itineraries.forEach((itin) => {
      const user = users.find((u) => u.id === itin.userId);
      const userName = user?.fullName || "Người dùng";
      activities.push({
        icon: "map-outline",
        text: `${userName} ${txt.createdTrip} ${itin.destination}`,
        date: new Date(itin.createdAt).toLocaleDateString("vi-VN"),
        timestamp: new Date(itin.createdAt).getTime(),
      });
    });

    reviews.forEach((r) => {
      const dest = destinations.find((d) => d.id === r.destinationId);
      activities.push({
        icon: "star-outline",
        text: `${r.userName} ${txt.reviewedDest} ${dest?.name || ""}`,
        date: new Date(r.createdAt).toLocaleDateString("vi-VN"),
        timestamp: new Date(r.createdAt).getTime(),
      });
    });

    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [itineraries, reviews, destinations, users]);

  const toggleLock = async (userId: string) => {
    const current = users.find((u) => u.id === userId);
    if (!current) return;
    try {
      const numericId = parseInt(userId);
      const res = await apiRequest("PUT", `/api/users/${numericId}`, { isLocked: !current.isLocked });
      const updated = mapUser(await res.json());
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch { }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteUser = async (userId: string, name: string) => {
    confirmAction(txt.deleteUser, txt.deleteUserMsg(name), async () => {
      try {
        const numericId = parseInt(userId);
        await apiRequest("DELETE", `/api/users/${numericId}`);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } catch { }
      if (userDetailId === userId) setUserDetailId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const saveEditUser = async () => {
    if (!userDetailId) return;
    const updateData: Record<string, any> = { role: editUserRole };
    if (editUserName.trim()) updateData.fullName = editUserName.trim();
    if (editUserEmail.trim()) updateData.email = editUserEmail.trim();
    if (editUserPassword.trim()) updateData.password = editUserPassword.trim();
    try {
      const numericId = parseInt(userDetailId);
      const res = await apiRequest("PUT", `/api/users/${numericId}`, updateData);
      const updated = mapUser(await res.json());
      setUsers((prev) => prev.map((u) => (u.id === userDetailId ? updated : u)));
    } catch { }
    setEditUserModal(false);
    setEditUserPassword("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openAddDest = () => {
    setEditingDestId(null);
    setDestName("");
    setDestDesc("");
    setDestAddr("");
    setDestCategory("City");
    setDestLat("");
    setDestLng("");
    setDestErrors({});
    setDestRating(0);
    setDestReviewCount(0);
    setDestGooglePlaceId("");
    setDestGooglePhotos([]);
    setDestGoogleReviews([]);
    setDestModalVisible(true);
  };

  const openEditDest = (id: string) => {
    const dest = destinations.find((d) => d.id === id);
    if (!dest) return;
    setEditingDestId(id);
    setDestName(dest.name);
    setDestDesc(typeof dest.description === "string" ? dest.description : "");
    setDestAddr(dest.address);
    setDestCategory(dest.category);
    setDestLat(dest.latitude?.toString() || "");
    setDestLng(dest.longitude?.toString() || "");
    setDestRating(dest.rating || 0);
    setDestReviewCount(dest.reviewCount || 0);
    setDestGooglePlaceId(dest.googlePlaceId || "");
    setDestGooglePhotos(dest.googlePhotos || []);
    setDestGoogleReviews(dest.googleReviews || []);
    setDestErrors({});
    setDestModalVisible(true);
  };

  const validateDestForm = (): boolean => {
    const newErrors: DestFormErrors = {};
    const nameErr = validateDestinationName(destName);
    if (nameErr) newErrors.name = nameErr;
    const addrErr = validateAddress(destAddr);
    if (addrErr) newErrors.address = addrErr;
    const hasLat = destLat.trim() !== "";
    const hasLng = destLng.trim() !== "";
    if (hasLat && !hasLng) {
      newErrors.longitude = t().admin.coordBothRequired;
    } else if (!hasLat && hasLng) {
      newErrors.latitude = t().admin.coordBothRequired;
    }
    if (hasLat) {
      const lat = parseFloat(destLat);
      if (isNaN(lat) || lat < -90 || lat > 90) newErrors.latitude = t().admin.invalidLatitude;
    }
    if (hasLng) {
      const lng = parseFloat(destLng);
      if (isNaN(lng) || lng < -180 || lng > 180) newErrors.longitude = t().admin.invalidLongitude;
    }
    setDestErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDest = async () => {
    if (!validateDestForm()) return;
    // Check duplicate destination name
    const normalizedName = destName.trim().toLowerCase();
    const duplicate = destinations.find(
      (d) => d.name.toLowerCase() === normalizedName && d.id !== editingDestId
    );
    if (duplicate) {
      const msg = `Địa điểm "${destName.trim()}" đã tồn tại. Không thể thêm trùng.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Trùng địa điểm", msg);
      }
      return;
    }
    const hasCoords = destLat.trim() !== "" && destLng.trim() !== "";
    const parsedLat = hasCoords ? parseFloat(destLat) : null;
    const parsedLng = hasCoords ? parseFloat(destLng) : null;
    if (editingDestId) {
      const updates: Record<string, any> = {
        name: destName.trim(),
        description: (typeof destDesc === "string" ? destDesc.trim() : String(destDesc || "").trim()) || "Một điểm đến tuyệt vời",
        address: destAddr.trim(),
        category: destCategory,
      };
      if (hasCoords && parsedLat !== null && !isNaN(parsedLat) && parsedLng !== null && !isNaN(parsedLng)) {
        updates.latitude = parsedLat;
        updates.longitude = parsedLng;
      }
      if (destRating > 0) updates.rating = destRating;
      if (destReviewCount > 0) updates.reviewCount = destReviewCount;
      if (destGooglePlaceId) updates.googlePlaceId = destGooglePlaceId;
      if (destGooglePhotos.length > 0) updates.googlePhotos = destGooglePhotos;
      if (destGoogleReviews.length > 0) updates.googleReviews = destGoogleReviews;
      await updateDestination(editingDestId, updates);
    } else {
      await addDestination({
        name: destName.trim(),
        description: (typeof destDesc === "string" ? destDesc.trim() : String(destDesc || "").trim()) || "Một điểm đến tuyệt vời",
        images: destGooglePhotos.length > 0 ? destGooglePhotos.slice(0, 3).map(p => p.name.startsWith("http") ? p.name : getPhotoUrl(p.name)) : ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"],
        category: destCategory,
        address: destAddr.trim(),
        latitude: hasCoords && parsedLat !== null && !isNaN(parsedLat) ? parsedLat : 16.0 + Math.random() * 6,
        longitude: hasCoords && parsedLng !== null && !isNaN(parsedLng) ? parsedLng : 105.0 + Math.random() * 5,
        rating: destRating,
        reviewCount: destReviewCount,
        tags: [destCategory],
        googlePlaceId: destGooglePlaceId || undefined,
        googlePhotos: destGooglePhotos.length > 0 ? destGooglePhotos : undefined,
        googleReviews: destGoogleReviews.length > 0 ? destGoogleReviews : undefined,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDestModalVisible(false);
  };

  const handleDeleteDest = (id: string, name: string) => {
    confirmAction(txt.deleteDestination, txt.deleteDestMsg(name), () => {
      deleteDestination(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const handleDeleteReview = (id: string) => {
    confirmAction(txt.deleteReview, txt.deleteReviewMsg, () => {
      deleteReview(id);
      if (reviewDetailId === id) setReviewDetailId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const handleDeleteTrip = (id: string, name: string) => {
    confirmAction(txt.deleteTrip, txt.deleteTripMsg(name), () => {
      deleteItinerary(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  if (!isAdmin) {
    return (
      <View style={[s.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="lock-closed" size={48} color={colors.error} />
        <Text style={[s.accessDenied, { color: colors.error }]}>{txt.accessDenied}</Text>
      </View>
    );
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "dashboard", icon: "grid-outline", label: txt.dashboard },
    { key: "users", icon: "people-outline", label: txt.users },
    { key: "destinations", icon: "location-outline", label: txt.places },
    { key: "reviews", icon: "chatbubbles-outline", label: txt.reviewsTab },
    { key: "pois", icon: "pin-outline", label: "POI" },
  ];

  const selectedUser = userDetailId ? users.find((u) => u.id === userDetailId) : null;
  const userTrips = selectedUser
    ? itineraries.filter(
      (i) =>
        i.userId === selectedUser.id ||
        (i.companions || []).some((c) => c.userId === selectedUser.id)
    )
    : [];
  const userOwnedTrips = selectedUser ? itineraries.filter((i) => i.userId === selectedUser.id) : [];
  const userReviews = selectedUser ? reviews.filter((r) => r.userId === selectedUser.id) : [];
  const selectedDest = destDetailId ? destinations.find((d) => d.id === destDetailId) : null;
  const selectedReview = reviewDetailId ? reviews.find((r) => r.id === reviewDetailId) : null;
  const selectedReviewDest = selectedReview ? destinations.find((d) => d.id === selectedReview.destinationId) : null;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => {
          if (userDetailId) { setUserDetailId(null); return; }
          if (destDetailId) { setDestDetailId(null); return; }
          if (reviewDetailId) { setReviewDetailId(null); return; }
          router.canGoBack() ? router.back() : router.replace("/(tabs)");
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          {userDetailId ? txt.userDetail : destDetailId ? txt.destDetail : reviewDetailId ? txt.reviewDetail : txt.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {!userDetailId && !destDetailId && !reviewDetailId && (
        <View style={s.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab.key);
                if (tab.key === "users") loadUsers();
              }}
              style={[s.tab, { borderBottomColor: activeTab === tab.key ? colors.primary : "transparent" }]}
            >
              <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? colors.primary : colors.textTertiary} />
              <Text style={[s.tabText, { color: activeTab === tab.key ? colors.primary : colors.textTertiary }]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {userDetailId && selectedUser && (
          <>
            <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={s.detailHeader}>
                <View style={[s.userAvatar, { backgroundColor: selectedUser.role === "admin" ? colors.accent : colors.primary }]}>
                  <Text style={s.userAvatarText}>{selectedUser.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.detailName, { color: colors.text }]}>{selectedUser.fullName}</Text>
                  <Text style={[s.detailSub, { color: colors.textSecondary }]}>@{selectedUser.username}</Text>
                </View>
                <View style={[s.statusTag, { backgroundColor: selectedUser.isLocked ? colors.error + "20" : colors.success + "20" }]}>
                  <Text style={[s.statusTagText, { color: selectedUser.isLocked ? colors.error : colors.success }]}>
                    {selectedUser.isLocked ? txt.locked : txt.active}
                  </Text>
                </View>
              </View>
              <View style={s.detailInfo}>
                <View style={s.infoRow}>
                  <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                  <Text style={[s.infoText, { color: colors.text }]}>{selectedUser.email}</Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={[s.infoText, { color: colors.text }]}>{txt.createdDate}: {new Date(selectedUser.createdAt).toLocaleDateString("vi-VN")}</Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="map-outline" size={16} color={colors.textSecondary} />
                  <Text style={[s.infoText, { color: colors.text }]}>{txt.tripsCount}: {userTrips.length} ({userOwnedTrips.length} chủ sở hữu, {userTrips.length - userOwnedTrips.length} tham gia)</Text>
                </View>
              </View>
              {selectedUser.id !== currentUser?.id && (
                <View style={s.detailActions}>
                  <Pressable
                    onPress={() => {
                      setEditUserName(selectedUser.fullName);
                      setEditUserEmail(selectedUser.email);
                      setEditUserRole(selectedUser.role);
                      setEditUserPassword("");
                      setEditUserModal(true);
                    }}
                    style={[s.detailBtn, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="create-outline" size={16} color="#fff" />
                    <Text style={s.detailBtnText}>{txt.editUser}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleLock(selectedUser.id)}
                    style={[s.detailBtn, { backgroundColor: selectedUser.isLocked ? colors.success : colors.warning }]}
                  >
                    <Ionicons name={selectedUser.isLocked ? "lock-open" : "lock-closed"} size={16} color="#fff" />
                    <Text style={s.detailBtnText}>{selectedUser.isLocked ? txt.unlockAccount : txt.lockAccount}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteUser(selectedUser.id, selectedUser.fullName)}
                    style={[s.detailBtn, { backgroundColor: colors.error }]}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={s.detailBtnText}>{txt.deleteUser}</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={s.subTabBar}>
              {([
                { key: "info" as const, label: "Thông tin", icon: "person-outline" },
                { key: "trips" as const, label: txt.userTrips, icon: "map-outline" },
                { key: "reviews" as const, label: txt.userReviews, icon: "star-outline" },
              ]).map((st) => (
                <Pressable
                  key={st.key}
                  onPress={() => setUserDetailTab(st.key)}
                  style={[s.subTab, { borderBottomColor: userDetailTab === st.key ? colors.primary : "transparent" }]}
                >
                  <Ionicons name={st.icon as any} size={16} color={userDetailTab === st.key ? colors.primary : colors.textTertiary} />
                  <Text style={[s.subTabText, { color: userDetailTab === st.key ? colors.primary : colors.textTertiary }]}>{st.label}</Text>
                </Pressable>
              ))}
            </View>

            {userDetailTab === "info" && (
              <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Thông tin chi tiết</Text>
                <View style={s.detailInfo}>
                  <View style={s.infoRow}>
                    <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.infoText, { color: colors.text }]}>Username: @{selectedUser.username}</Text>
                  </View>
                  <View style={s.infoRow}>
                    <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.infoText, { color: colors.text }]}>Email: {selectedUser.email}</Text>
                  </View>
                  <View style={s.infoRow}>
                    <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.infoText, { color: colors.text }]}>Vai trò: {selectedUser.role === "admin" ? "Quản trị viên" : "Người dùng"}</Text>
                  </View>
                  <View style={s.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={[s.infoText, { color: colors.text }]}>{txt.createdDate}: {new Date(selectedUser.createdAt).toLocaleDateString("vi-VN")}</Text>
                  </View>
                  <View style={s.infoRow}>
                    <Ionicons name={selectedUser.isLocked ? "lock-closed" : "lock-open-outline"} size={16} color={selectedUser.isLocked ? colors.error : colors.success} />
                    <Text style={[s.infoText, { color: selectedUser.isLocked ? colors.error : colors.success }]}>
                      Trạng thái: {selectedUser.isLocked ? txt.locked : txt.active}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Thống kê</Text>
                  <View style={s.statsGrid}>
                    <View style={[s.statCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, width: "47%" as any }]}>
                      <View style={[s.statIcon, { backgroundColor: "#3B82F620" }]}>
                        <Ionicons name="map-outline" size={20} color="#3B82F6" />
                      </View>
                      <Text style={[s.statValue, { color: colors.text, fontSize: 22 }]}>{userTrips.length}</Text>
                      <Text style={[s.statLabel, { color: colors.textSecondary }]}>Chuyến đi</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, width: "47%" as any }]}>
                      <View style={[s.statIcon, { backgroundColor: "#F59E0B20" }]}>
                        <Ionicons name="star-outline" size={20} color="#F59E0B" />
                      </View>
                      <Text style={[s.statValue, { color: colors.text, fontSize: 22 }]}>{userReviews.length}</Text>
                      <Text style={[s.statLabel, { color: colors.textSecondary }]}>Đánh giá</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, width: "47%" as any }]}>
                      <View style={[s.statIcon, { backgroundColor: "#EF444420" }]}>
                        <Ionicons name="cash-outline" size={20} color="#EF4444" />
                      </View>
                      <Text style={[s.statValue, { color: colors.text, fontSize: 22 }]}>
                        {formatVND(userTrips.reduce((sum, trip) => {
                          // Only count the user's own split amount in each expense
                          const expenseSpent = (trip.expenses || []).reduce((es, exp) => {
                            const split = (exp.splits || []).find(s => s.userId === selectedUser.id);
                            if (split) return es + split.amount;
                            return es;
                          }, 0);
                          return sum + expenseSpent;
                        }, 0))}
                      </Text>
                      <Text style={[s.statLabel, { color: colors.textSecondary }]}>Đã chi tiêu</Text>
                    </View>
                  </View>
                </View>

                {selectedUser.preferences && selectedUser.preferences.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 8 }]}>Sở thích</Text>
                    <View style={s.tagsRow}>
                      {selectedUser.preferences.map((pref) => (
                        <View key={pref} style={[s.tagChip, { backgroundColor: colors.tagBg }]}>
                          <Text style={[s.tagText, { color: colors.tagText }]}>{pref}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {userDetailTab === "trips" && (
              <>
                {userTrips.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="map-outline" size={40} color={colors.textTertiary} />
                    <Text style={[s.noData, { color: colors.textTertiary }]}>{txt.noTripsYet}</Text>
                  </View>
                ) : (
                  userTrips.map((trip) => (
                    <Pressable
                      key={trip.id}
                      onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: trip.id } })}
                      style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.itemTitle, { color: colors.text }]}>{trip.title}</Text>
                        <Text style={[s.itemSub, { color: colors.textSecondary }]}>
                          {trip.destination} • {trip.startDate} - {trip.endDate}
                        </Text>
                        <Text style={[s.itemSub, { color: colors.textTertiary }]}>
                          {formatVND(trip.totalBudget)} • {trip.days.length} ngày
                        </Text>
                      </View>
                      <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteTrip(trip.id, trip.title); }} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </Pressable>
                  ))
                )}
              </>
            )}

            {userDetailTab === "reviews" && (
              <>
                {userReviews.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="star-outline" size={40} color={colors.textTertiary} />
                    <Text style={[s.noData, { color: colors.textTertiary }]}>{txt.noReviewsYet}</Text>
                  </View>
                ) : (
                  userReviews.map((r) => {
                    // Resolve display title: activity → POI → destination
                    const reviewTitle = r.activityTitle || r.poiName || destinations.find((d) => d.id === r.destinationId)?.name || "—";
                    // Resolve trip context subtitle
                    const tripContext = r.itineraryId ? itineraries.find((i) => i.id === r.itineraryId) : null;
                    const reviewSubtitle = tripContext
                      ? `${tripContext.destination} • ${tripContext.title}`
                      : r.destinationId && !r.activityId && !r.poiId
                        ? destinations.find((d) => d.id === r.destinationId)?.address || ""
                        : "";
                    return (
                      <View key={r.id} style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.itemTitle, { color: colors.text }]}>{reviewTitle}</Text>
                          {!!reviewSubtitle && (
                            <Text style={[s.itemSub, { color: colors.textSecondary, marginBottom: 2 }]} numberOfLines={1}>{reviewSubtitle}</Text>
                          )}
                          <View style={s.ratingRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons key={star} name={star <= r.rating ? "star" : "star-outline"} size={14} color="#F59E0B" />
                            ))}
                          </View>
                          <Text style={[s.reviewText, { color: colors.textSecondary }]} numberOfLines={2}>{cleanReviewComment(r.comment)}</Text>
                        </View>
                        <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteReview(r.id); }} hitSlop={8}>
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
        )}

        {destDetailId && selectedDest && (
          <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[s.detailName, { color: colors.text, fontSize: 20, marginBottom: 12 }]}>{selectedDest.name}</Text>
            <View style={s.detailInfo}>
              <View style={s.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[s.infoText, { color: colors.text }]}>{selectedDest.address}</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                <Text style={[s.infoText, { color: colors.text }]}>{txt.category}: {t().categories[selectedDest.category] || selectedDest.category}</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={[s.infoText, { color: colors.text }]}>{selectedDest.rating.toFixed(1)}/5 ({selectedDest.reviewCount} {txt.reviewsTab.toLowerCase()})</Text>
              </View>

              {selectedDest.openHours && (
                <View style={s.infoRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={[s.infoText, { color: colors.text }]}>{selectedDest.openHours}</Text>
                </View>
              )}
              {(selectedDest.latitude != null && selectedDest.longitude != null) && (
                <View style={s.infoRow}>
                  <Ionicons name="navigate-outline" size={16} color={colors.textSecondary} />
                  <Text style={[s.infoText, { color: colors.text }]}>{txt.location}: {selectedDest.latitude.toFixed(4)}, {selectedDest.longitude.toFixed(4)}</Text>
                </View>
              )}
            </View>
            <Text style={[s.descLabel, { color: colors.textSecondary }]}>{txt.description}</Text>
            <Text style={[s.descText, { color: colors.text }]}>{selectedDest.description}</Text>

            {selectedDest.tags && selectedDest.tags.length > 0 && (
              <View style={s.tagsRow}>
                {selectedDest.tags.map((tag) => (
                  <View key={tag} style={[s.tagChip, { backgroundColor: colors.tagBg }]}>
                    <Text style={[s.tagText, { color: colors.tagText }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[s.detailActions, { marginTop: 16 }]}>
              <Pressable onPress={() => { setDestDetailId(null); openEditDest(selectedDest.id); }} style={[s.detailBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={s.detailBtnText}>{txt.editDestination}</Text>
              </Pressable>
              <Pressable onPress={() => handleDeleteDest(selectedDest.id, selectedDest.name)} style={[s.detailBtn, { backgroundColor: colors.error }]}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={s.detailBtnText}>{txt.deleteDestination}</Text>
              </Pressable>
            </View>

            <Text style={[s.sectionLabel, { color: colors.text }]}>{txt.reviewsTab} ({reviews.filter((r) => r.destinationId === selectedDest.id).length})</Text>
            {reviews.filter((r) => r.destinationId === selectedDest.id).length === 0 ? (
              <Text style={[s.noData, { color: colors.textTertiary }]}>{txt.noReviews}</Text>
            ) : (
              reviews.filter((r) => r.destinationId === selectedDest.id).map((r) => (
                <View key={r.id} style={[s.reviewCard, { backgroundColor: colors.inputBg }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.reviewerName, { color: colors.text }]}>{r.userName}</Text>
                    <View style={s.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons key={star} name={star <= r.rating ? "star" : "star-outline"} size={12} color="#F59E0B" />
                      ))}
                    </View>
                    <Text style={[s.reviewText, { color: colors.textSecondary }]}>{cleanReviewComment(r.comment)}</Text>
                  </View>
                  <Pressable onPress={() => handleDeleteReview(r.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {reviewDetailId && selectedReview && (
          <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={s.detailHeader}>
              <View style={[s.userAvatar, { backgroundColor: colors.primary }]}>
                <Text style={s.userAvatarText}>{selectedReview.userName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.detailName, { color: colors.text }]}>{selectedReview.userName}</Text>
                <Text style={[s.detailSub, { color: colors.textSecondary }]}>
                  {new Date(selectedReview.createdAt).toLocaleDateString("vi-VN")}
                </Text>
              </View>
            </View>

            <View style={s.detailInfo}>
              {(() => {
                const actTag = selectedReview.comment.match(/\[activity:([^\]]+)\]/);
                let reviewPlaceName = selectedReviewDest?.name || "—";
                if (actTag) {
                  const actId = actTag[1];
                  for (const itin of itineraries) {
                    for (const day of itin.days) {
                      const act = day.activities.find((a) => a.id === actId);
                      if (act) { reviewPlaceName = act.title; break; }
                    }
                    if (reviewPlaceName !== (selectedReviewDest?.name || "—")) break;
                  }
                }
                return (
                  <>
                    <View style={s.infoRow}>
                      <Ionicons name="pin-outline" size={16} color={colors.textSecondary} />
                      <Text style={[s.infoText, { color: colors.text }]}>Địa điểm: {reviewPlaceName}</Text>
                    </View>
                    {actTag && selectedReviewDest && (
                      <View style={s.infoRow}>
                        <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                        <Text style={[s.infoText, { color: colors.textSecondary }]}>{txt.destination}: {selectedReviewDest.name}</Text>
                      </View>
                    )}
                    {!actTag && (
                      <View style={s.infoRow}>
                        <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                        <Text style={[s.infoText, { color: colors.text }]}>{txt.destination}: {selectedReviewDest?.name || "—"}</Text>
                      </View>
                    )}
                  </>
                );
              })()}
              <View style={s.infoRow}>
                <Text style={[s.infoText, { color: colors.textSecondary }]}>{txt.rating}:</Text>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons key={star} name={star <= selectedReview.rating ? "star" : "star-outline"} size={18} color="#F59E0B" />
                ))}
                <Text style={[s.infoText, { color: colors.text }]}>{selectedReview.rating}/5</Text>
              </View>
            </View>

            <Text style={[s.descLabel, { color: colors.textSecondary }]}>{txt.comment}</Text>
            <Text style={[s.descText, { color: colors.text }]}>{cleanReviewComment(selectedReview.comment)}</Text>

            <View style={[s.detailActions, { marginTop: 16 }]}>
              <Pressable onPress={() => handleDeleteReview(selectedReview.id)} style={[s.detailBtn, { backgroundColor: colors.error }]}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={s.detailBtnText}>{txt.deleteReview}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!userDetailId && !destDetailId && !reviewDetailId && activeTab === "dashboard" && (
          <>
            <View style={s.statsGrid}>
              <StatCard icon="people" label={txt.users} value={users.length || 0} color="#3B82F6" colors={colors} />
              <StatCard icon="location" label={txt.places} value={destinations.length} color="#10B981" colors={colors} />
              <StatCard icon="airplane" label={txt.totalTrips} value={itineraries.length} color="#F59E0B" colors={colors} />
              <StatCard icon="chatbubble" label={txt.reviewsTab} value={reviews.length} color="#EF4444" colors={colors} />
            </View>

            {topDestinations.length > 0 && (
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>{txt.topDestinations}</Text>
                {topDestinations.map(([name, count], idx) => (
                  <View key={name} style={[s.topDestRow, { borderColor: colors.divider }]}>
                    <View style={[s.rankBadge, { backgroundColor: idx === 0 ? "#F59E0B" : idx === 1 ? "#9CA3AF" : idx === 2 ? "#CD7F32" : colors.inputBg }]}>
                      <Text style={[s.rankText, { color: idx < 3 ? "#fff" : colors.text }]}>{idx + 1}</Text>
                    </View>
                    <Text style={[s.topDestName, { color: colors.text }]}>{name}</Text>
                    <Text style={[s.topDestCount, { color: colors.textSecondary }]}>{count} {txt.timesChosen}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>{txt.recentActivity}</Text>
              {recentActivities.length === 0 ? (
                <Text style={[s.noData, { color: colors.textTertiary }]}>{txt.noActivity}</Text>
              ) : (
                recentActivities.map((act, idx) => (
                  <View key={idx} style={[s.timelineRow, { borderColor: colors.divider }]}>
                    <View style={[s.timelineDot, { backgroundColor: colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.timelineText, { color: colors.text }]}>{act.text}</Text>
                      <Text style={[s.timelineDate, { color: colors.textTertiary }]}>{act.date}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {!userDetailId && !destDetailId && !reviewDetailId && activeTab === "users" && (
          <>
            <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                placeholder={txt.searchUserPlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={userSearch}
                onChangeText={setUserSearch}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <View style={s.filterRow}>
              {(["all", "active", "locked"] as const).map((status) => (
                <Pressable
                  key={status}
                  onPress={() => setUserStatusFilter(status)}
                  style={[s.filterChip, { backgroundColor: userStatusFilter === status ? colors.primary : colors.inputBg, borderColor: userStatusFilter === status ? colors.primary : colors.inputBorder }]}
                >
                  <Text style={[s.filterChipText, { color: userStatusFilter === status ? "#fff" : colors.textSecondary }]}>
                    {status === "all" ? t().common.all : status === "active" ? txt.active : txt.locked}
                  </Text>
                </Pressable>
              ))}
            </View>
            {filteredUsers.length === 0 ? (
              <Text style={[s.noData, { color: colors.textTertiary }]}>{t().common.noData}</Text>
            ) : null}
            {filteredUsers.map((u) => (
              <Pressable
                key={u.id}
                onPress={() => { setUserDetailId(u.id); setUserDetailTab("info"); }}
                style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <View style={[s.userAvatar, { backgroundColor: u.role === "admin" ? colors.accent : colors.primary }]}>
                  <Text style={s.userAvatarText}>{u.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemTitle, { color: colors.text }]}>{u.fullName}</Text>
                  <Text style={[s.itemSub, { color: colors.textSecondary }]}>{u.email}</Text>
                  <Text style={[s.itemSub, { color: colors.textTertiary }]}>
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")} • {itineraries.filter((i) => i.userId === u.id).length} {txt.userTrips.toLowerCase()}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View style={[s.statusTag, { backgroundColor: u.isLocked ? colors.error + "20" : colors.success + "20" }]}>
                    <Text style={[s.statusTagText, { color: u.isLocked ? colors.error : colors.success }]}>
                      {u.isLocked ? txt.locked : txt.active}
                    </Text>
                  </View>
                  {u.id !== currentUser?.id && (
                    <Pressable onPress={(e) => { e.stopPropagation(); toggleLock(u.id); }} hitSlop={8}>
                      <Ionicons name={u.isLocked ? "lock-closed" : "lock-open"} size={16} color={u.isLocked ? colors.error : colors.success} />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            ))}
          </>
        )}

        {!userDetailId && !destDetailId && !reviewDetailId && activeTab === "destinations" && (
          <>
            <Pressable
              onPress={openAddDest}
              style={({ pressed }) => [s.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={s.addBtnText}>{txt.addDestination}</Text>
            </Pressable>
            <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                placeholder={txt.searchDestPlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={destSearch}
                onChangeText={setDestSearch}
              />
              {destSearch.length > 0 && (
                <Pressable onPress={() => setDestSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              <Pressable
                onPress={() => setDestCategoryFilter("all")}
                style={[s.filterChip, { backgroundColor: destCategoryFilter === "all" ? colors.primary : colors.inputBg, borderColor: destCategoryFilter === "all" ? colors.primary : colors.inputBorder }]}
              >
                <Text style={[s.filterChipText, { color: destCategoryFilter === "all" ? "#fff" : colors.textSecondary }]}>{t().common.all}</Text>
              </Pressable>
              {uniqueCategories.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setDestCategoryFilter(cat)}
                  style={[s.filterChip, { backgroundColor: destCategoryFilter === cat ? colors.primary : colors.inputBg, borderColor: destCategoryFilter === cat ? colors.primary : colors.inputBorder }]}
                >
                  <Text style={[s.filterChipText, { color: destCategoryFilter === cat ? "#fff" : colors.textSecondary }]}>{t().categories[cat] || cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {filteredDestinations.length === 0 ? (
              <Text style={[s.noData, { color: colors.textTertiary }]}>{t().common.noData}</Text>
            ) : null}
            {filteredDestinations.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => setDestDetailId(d.id)}
                style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemTitle, { color: colors.text }]}>{d.name}</Text>
                  <Text style={[s.itemSub, { color: colors.textSecondary }]}>{t().categories[d.category] || d.category} - {d.address}</Text>
                  <View style={s.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons key={star} name={star <= Math.round(d.rating) ? "star" : "star-outline"} size={12} color="#F59E0B" />
                    ))}
                    <Text style={[s.ratingText, { color: colors.textTertiary }]}>{d.rating.toFixed(1)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={(e) => { e.stopPropagation(); openEditDest(d.id); }} hitSlop={8}>
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteDest(d.id, d.name); }} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {!userDetailId && !destDetailId && !reviewDetailId && activeTab === "pois" && (
          <>
            <Pressable
              onPress={openAddPoi}
              style={({ pressed }) => [s.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={s.addBtnText}>Thêm POI</Text>
            </Pressable>
            <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                placeholder="Tìm POI theo tên, địa chỉ..."
                placeholderTextColor={colors.textTertiary}
                value={poiSearch}
                onChangeText={setPoiSearch}
              />
              {poiSearch.length > 0 && (
                <Pressable onPress={() => setPoiSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              <Pressable
                onPress={() => setPoiFilterDest("all")}
                style={[s.filterChip, { backgroundColor: poiFilterDest === "all" ? colors.primary : colors.inputBg, borderColor: poiFilterDest === "all" ? colors.primary : colors.inputBorder }]}
              >
                <Text style={[s.filterChipText, { color: poiFilterDest === "all" ? "#fff" : colors.textSecondary }]}>{t().common.all}</Text>
              </Pressable>
              {destinations.map(d => (
                <Pressable
                  key={d.id}
                  onPress={() => setPoiFilterDest(d.id)}
                  style={[s.filterChip, { backgroundColor: poiFilterDest === d.id ? colors.primary : colors.inputBg, borderColor: poiFilterDest === d.id ? colors.primary : colors.inputBorder }]}
                >
                  <Text style={[s.filterChipText, { color: poiFilterDest === d.id ? "#fff" : colors.textSecondary }]}>{d.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {filteredPois.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="pin-outline" size={48} color={colors.textTertiary} />
                <Text style={[s.noData, { color: colors.textTertiary }]}>Chưa có POI nào</Text>
              </View>
            ) : (
              filteredPois.map(poi => {
                const parentDest = destinations.find(d => d.id === poi.destinationId);
                return (
                  <Pressable
                    key={poi.id}
                    onPress={() => openEditPoi(poi.id)}
                    style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  >
                    <View style={[s.statIcon, { backgroundColor: colors.tagBg, width: 36, height: 36 }]}>
                      <Ionicons name={getPOITypeIcon(poi.type) as any} size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemTitle, { color: colors.text }]}>{poi.name}</Text>
                      <Text style={[s.itemSub, { color: colors.textSecondary }]}>
                        {getPOITypeLabel(poi.type)} • {parentDest?.name || "—"}
                      </Text>
                      <View style={s.ratingRow}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={[s.ratingText, { color: colors.textTertiary }]}>{poi.rating.toFixed(1)} ({poi.reviewCount})</Text>
                        {poi.estimatedCost ? <Text style={[s.ratingText, { color: colors.textTertiary }]}> • {formatVND(poi.estimatedCost)}</Text> : null}
                      </View>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation(); handleDeletePoi(poi.id, poi.name); }} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </>
        )}

        {!userDetailId && !destDetailId && !reviewDetailId && activeTab === "reviews" && (
          <>
            <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                placeholder={txt.searchReviewPlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={reviewSearch}
                onChangeText={setReviewSearch}
              />
              {reviewSearch.length > 0 && (
                <Pressable onPress={() => setReviewSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <View style={s.filterRow}>
              <Pressable
                onPress={() => setReviewSubTab("destinations")}
                style={[s.filterChip, { backgroundColor: reviewSubTab === "destinations" ? colors.primary : colors.inputBg, borderColor: reviewSubTab === "destinations" ? colors.primary : colors.inputBorder }]}
              >
                <Ionicons name="location-outline" size={12} color={reviewSubTab === "destinations" ? "#fff" : colors.textSecondary} />
                <Text style={[s.filterChipText, { color: reviewSubTab === "destinations" ? "#fff" : colors.textSecondary }]}>Điểm đến</Text>
              </Pressable>
              <Pressable
                onPress={() => setReviewSubTab("pois")}
                style={[s.filterChip, { backgroundColor: reviewSubTab === "pois" ? colors.primary : colors.inputBg, borderColor: reviewSubTab === "pois" ? colors.primary : colors.inputBorder }]}
              >
                <Ionicons name="pin-outline" size={12} color={reviewSubTab === "pois" ? "#fff" : colors.textSecondary} />
                <Text style={[s.filterChipText, { color: reviewSubTab === "pois" ? "#fff" : colors.textSecondary }]}>Địa điểm</Text>
              </Pressable>
            </View>
            <View style={s.filterRow}>
              <Pressable
                onPress={() => setReviewStarFilter(0)}
                style={[s.filterChip, { backgroundColor: reviewStarFilter === 0 ? colors.primary : colors.inputBg, borderColor: reviewStarFilter === 0 ? colors.primary : colors.inputBorder }]}
              >
                <Text style={[s.filterChipText, { color: reviewStarFilter === 0 ? "#fff" : colors.textSecondary }]}>{t().common.all}</Text>
              </Pressable>
              {[5, 4, 3, 2, 1].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setReviewStarFilter(reviewStarFilter === star ? 0 : star)}
                  style={[s.filterChip, { backgroundColor: reviewStarFilter === star ? colors.primary : colors.inputBg, borderColor: reviewStarFilter === star ? colors.primary : colors.inputBorder }]}
                >
                  <Ionicons name="star" size={12} color={reviewStarFilter === star ? "#fff" : "#F59E0B"} />
                  <Text style={[s.filterChipText, { color: reviewStarFilter === star ? "#fff" : colors.textSecondary }]}>{star}</Text>
                </Pressable>
              ))}
            </View>
            {(() => {
              const subFiltered = reviewSubTab === "pois"
                ? filteredReviews.filter((r) => /\[activity:[^\]]+\]/.test(r.comment))
                : filteredReviews.filter((r) => !/\[activity:[^\]]+\]/.test(r.comment));
              if (subFiltered.length === 0) return (
                <View style={s.emptyState}>
                  <Ionicons name="chatbubble-outline" size={48} color={colors.textTertiary} />
                  <Text style={[s.noData, { color: colors.textTertiary }]}>{txt.noReviews}</Text>
                </View>
              );
              return subFiltered.map((r) => {
                const dest = destinations.find((d) => d.id === r.destinationId);
                // For POI reviews, extract the activity name
                let placeName = dest?.name || "—";
                if (reviewSubTab === "pois") {
                  const actTag = r.comment.match(/\[activity:([^\]]+)\]/);
                  if (actTag) {
                    const actId = actTag[1];
                    for (const itin of itineraries) {
                      for (const day of itin.days) {
                        const act = day.activities.find((a) => a.id === actId);
                        if (act) { placeName = act.title; break; }
                      }
                      if (placeName !== (dest?.name || "—")) break;
                    }
                  }
                }
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setReviewDetailId(r.id)}
                    style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemTitle, { color: colors.text }]}>{r.userName}</Text>
                      <Text style={[s.itemSub, { color: colors.textSecondary }]}>{placeName} - {new Date(r.createdAt).toLocaleDateString("vi-VN")}</Text>
                      <View style={s.ratingRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons key={star} name={star <= r.rating ? "star" : "star-outline"} size={12} color="#F59E0B" />
                        ))}
                      </View>
                      <Text style={[s.reviewText, { color: colors.textSecondary }]} numberOfLines={2}>{cleanReviewComment(r.comment)}</Text>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation(); handleDeleteReview(r.id); }} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </Pressable>
                  </Pressable>
                );
              });
            })()}
          </>
        )}
      </ScrollView>

      <Modal visible={destModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                {editingDestId ? txt.editDestination : txt.addDestination}
              </Text>
              <Pressable onPress={() => setDestModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              {/* Google Places Search */}
              <View>
                <Text style={[s.categoryLabel, { color: colors.primary, marginBottom: 6 }]}>🔍 Tìm trên Google Maps</Text>
                <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                  <TextInput
                    style={[s.searchInput, { color: colors.text }]}
                    placeholder="Nhập tên địa điểm để tìm từ Google..."
                    placeholderTextColor={colors.textTertiary}
                    value={googleQuery}
                    onChangeText={setGoogleQuery}
                    onSubmitEditing={() => handleGoogleSearch(googleQuery)}
                    returnKeyType="search"
                  />
                  {googleLoading ? (
                    <Text style={{ color: colors.primary, fontSize: 12 }}>...</Text>
                  ) : (
                    <Pressable onPress={() => handleGoogleSearch(googleQuery)}>
                      <Ionicons name="search" size={20} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
                {googleResults.length > 0 && (
                  <View style={{ backgroundColor: colors.inputBg, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: colors.inputBorder, maxHeight: 200 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {googleResults.map((place) => (
                        <Pressable
                          key={place.placeId}
                          onPress={() => fillFromGoogleResult(place)}
                          style={{ padding: 12, borderBottomWidth: 0.5, borderColor: colors.divider }}
                        >
                          <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{place.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>{place.address}</Text>
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" }}>
                            <Ionicons name="star" size={12} color="#F59E0B" />
                            <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{place.rating} ({place.reviewCount})</Text>
                            {place.primaryTypeDisplay ? <Text style={{ color: colors.textTertiary, fontSize: 11 }}>• {place.primaryTypeDisplay}</Text> : null}
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 4 }} />

              <View>
                <TextInput
                  style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: destErrors.name ? colors.error : colors.inputBorder }]}
                  placeholder={txt.destName}
                  placeholderTextColor={colors.textTertiary}
                  value={destName}
                  onChangeText={(v) => { setDestName(v); if (destErrors.name) setDestErrors((e) => ({ ...e, name: undefined })); }}
                />
                {destErrors.name && <Text style={[s.fieldError, { color: colors.error }]}>{destErrors.name}</Text>}
              </View>
              <View>
                <TextInput
                  style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: destErrors.address ? colors.error : colors.inputBorder }]}
                  placeholder={txt.address}
                  placeholderTextColor={colors.textTertiary}
                  value={destAddr}
                  onChangeText={(v) => { setDestAddr(v); if (destErrors.address) setDestErrors((e) => ({ ...e, address: undefined })); }}
                />
                {destErrors.address && <Text style={[s.fieldError, { color: colors.error }]}>{destErrors.address}</Text>}
              </View>
              <TextInput
                style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, minHeight: 80 }]}
                placeholder={txt.description}
                placeholderTextColor={colors.textTertiary}
                value={destDesc}
                onChangeText={setDestDesc}
                multiline
              />
              <Text style={[s.categoryLabel, { color: colors.text }]}>{txt.location}</Text>
              <View style={s.coordRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: destErrors.latitude ? colors.error : colors.inputBorder }]}
                    placeholder={txt.latitude}
                    placeholderTextColor={colors.textTertiary}
                    value={destLat}
                    onChangeText={(v) => { setDestLat(v); if (destErrors.latitude) setDestErrors((e) => ({ ...e, latitude: undefined })); }}
                    keyboardType="decimal-pad"
                  />
                  {destErrors.latitude && <Text style={[s.fieldError, { color: colors.error }]}>{destErrors.latitude}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: destErrors.longitude ? colors.error : colors.inputBorder }]}
                    placeholder={txt.longitude}
                    placeholderTextColor={colors.textTertiary}
                    value={destLng}
                    onChangeText={(v) => { setDestLng(v); if (destErrors.longitude) setDestErrors((e) => ({ ...e, longitude: undefined })); }}
                    keyboardType="decimal-pad"
                  />
                  {destErrors.longitude && <Text style={[s.fieldError, { color: colors.error }]}>{destErrors.longitude}</Text>}
                </View>
              </View>
              <Text style={[s.categoryLabel, { color: colors.text }]}>{txt.category}</Text>
              <View style={s.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setDestCategory(cat)}
                    style={[s.categoryChip, { backgroundColor: destCategory === cat ? colors.primary : colors.inputBg, borderColor: destCategory === cat ? colors.primary : colors.inputBorder }]}
                  >
                    <Text style={[s.categoryChipText, { color: destCategory === cat ? "#fff" : colors.textSecondary }]}>
                      {t().categories[cat] || cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={handleSaveDest}
                style={({ pressed }) => [s.modalSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={s.modalSaveBtnText}>{editingDestId ? t().common.update : t().common.save}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* POI Modal */}
      <Modal visible={poiModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                {editingPoiId ? "Sửa POI" : "Thêm POI"}
              </Text>
              <Pressable onPress={() => setPoiModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              {/* Google Search for POI */}
              <View>
                <Text style={[s.categoryLabel, { color: colors.primary, marginBottom: 6 }]}>🔍 Tìm trên Google Maps</Text>
                <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                  <TextInput
                    style={[s.searchInput, { color: colors.text }]}
                    placeholder="Nhập tên quán ăn, điểm tham quan..."
                    placeholderTextColor={colors.textTertiary}
                    value={poiGoogleQuery}
                    onChangeText={setPoiGoogleQuery}
                    onSubmitEditing={() => handlePoiGoogleSearch(poiGoogleQuery)}
                    returnKeyType="search"
                  />
                  {poiGoogleLoading ? (
                    <Text style={{ color: colors.primary, fontSize: 12 }}>...</Text>
                  ) : (
                    <Pressable onPress={() => handlePoiGoogleSearch(poiGoogleQuery)}>
                      <Ionicons name="search" size={20} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
                {poiGoogleResults.length > 0 && (
                  <View style={{ backgroundColor: colors.inputBg, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: colors.inputBorder, maxHeight: 180 }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {poiGoogleResults.map((place) => (
                        <Pressable
                          key={place.placeId}
                          onPress={() => fillPoiFromGoogle(place)}
                          style={{ padding: 12, borderBottomWidth: 0.5, borderColor: colors.divider }}
                        >
                          <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{place.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>{place.address}</Text>
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 4, alignItems: "center" }}>
                            <Ionicons name="star" size={12} color="#F59E0B" />
                            <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{place.rating} ({place.reviewCount})</Text>
                            {place.primaryTypeDisplay ? <Text style={{ color: colors.textTertiary, fontSize: 11 }}>• {place.primaryTypeDisplay}</Text> : null}
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 4 }} />

              {/* POI Name */}
              <TextInput
                style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                placeholder="Tên POI *"
                placeholderTextColor={colors.textTertiary}
                value={poiName}
                onChangeText={setPoiName}
              />

              {/* Destination Picker */}
              <Text style={[s.categoryLabel, { color: colors.text }]}>Thuộc điểm đến:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {destinations.map(d => (
                  <Pressable
                    key={d.id}
                    onPress={() => setPoiDestId(d.id)}
                    style={[s.categoryChip, { backgroundColor: poiDestId === d.id ? colors.primary : colors.inputBg, borderColor: poiDestId === d.id ? colors.primary : colors.inputBorder }]}
                  >
                    <Text style={[s.categoryChipText, { color: poiDestId === d.id ? "#fff" : colors.textSecondary }]}>{d.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* POI Type */}
              <Text style={[s.categoryLabel, { color: colors.text }]}>Loại:</Text>
              <View style={s.categoryGrid}>
                {poiTypes.map(type => (
                  <Pressable
                    key={type}
                    onPress={() => setPoiType(type)}
                    style={[s.categoryChip, { backgroundColor: poiType === type ? colors.primary : colors.inputBg, borderColor: poiType === type ? colors.primary : colors.inputBorder }]}
                  >
                    <Text style={[s.categoryChipText, { color: poiType === type ? "#fff" : colors.textSecondary }]}>{getPOITypeLabel(type)}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Address */}
              <TextInput
                style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                placeholder="Địa chỉ"
                placeholderTextColor={colors.textTertiary}
                value={poiAddress}
                onChangeText={setPoiAddress}
              />

              {/* Lat/Lng */}
              <View style={s.coordRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    placeholder="Vĩ độ"
                    placeholderTextColor={colors.textTertiary}
                    value={poiLat}
                    onChangeText={setPoiLat}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    placeholder="Kinh độ"
                    placeholderTextColor={colors.textTertiary}
                    value={poiLng}
                    onChangeText={setPoiLng}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Cost & Duration */}
              <View style={s.coordRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    placeholder="Chi phí ước tính (VNĐ)"
                    placeholderTextColor={colors.textTertiary}
                    value={poiCost}
                    onChangeText={setPoiCost}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    placeholder="Thời gian (VD: 1.5 giờ)"
                    placeholderTextColor={colors.textTertiary}
                    value={poiDuration}
                    onChangeText={setPoiDuration}
                  />
                </View>
              </View>

              {/* Open Hours */}
              <TextInput
                style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                placeholder="Giờ mở cửa"
                placeholderTextColor={colors.textTertiary}
                value={poiOpenHours}
                onChangeText={setPoiOpenHours}
              />

              {/* Description */}
              <TextInput
                style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, minHeight: 80 }]}
                placeholder="Mô tả"
                placeholderTextColor={colors.textTertiary}
                value={poiDesc}
                onChangeText={setPoiDesc}
                multiline
              />

              {/* Google Reviews preview */}
              {poiGoogleReviews.length > 0 && (
                <View>
                  <Text style={[s.categoryLabel, { color: colors.text }]}>Đánh giá từ Google ({poiGoogleReviews.length}):</Text>
                  {poiGoogleReviews.slice(0, 2).map((r, i) => (
                    <View key={i} style={[s.reviewCard, { backgroundColor: colors.inputBg }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={[s.reviewerName, { color: colors.text }]}>{r.author}</Text>
                          <Ionicons name="star" size={10} color="#F59E0B" />
                          <Text style={{ fontSize: 11, color: colors.textTertiary }}>{r.rating}</Text>
                        </View>
                        <Text style={[s.reviewText, { color: colors.textSecondary }]} numberOfLines={2}>{r.text}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                onPress={handleSavePoi}
                style={({ pressed }) => [s.modalSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={s.modalSaveBtnText}>{editingPoiId ? "Cập nhật" : "Lưu POI"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={editUserModal} transparent animationType="fade" onRequestClose={() => setEditUserModal(false)}>
        <View style={s.editModalOverlay}>
          <View style={[s.editModalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>{txt.editUser}</Text>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{txt.fullName}</Text>
            <TextInput
              style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={editUserName}
              onChangeText={setEditUserName}
            />
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{txt.email}</Text>
            <TextInput
              style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={editUserEmail}
              onChangeText={setEditUserEmail}
              keyboardType="email-address"
            />
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Vai trò</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setEditUserRole("user")}
                style={[s.filterChip, { backgroundColor: editUserRole === "user" ? colors.primary : colors.inputBg, borderColor: editUserRole === "user" ? colors.primary : colors.inputBorder }]}
              >
                <Ionicons name="person-outline" size={14} color={editUserRole === "user" ? "#fff" : colors.textSecondary} />
                <Text style={[s.filterChipText, { color: editUserRole === "user" ? "#fff" : colors.textSecondary }]}>Người dùng</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditUserRole("admin")}
                style={[s.filterChip, { backgroundColor: editUserRole === "admin" ? colors.accent : colors.inputBg, borderColor: editUserRole === "admin" ? colors.accent : colors.inputBorder }]}
              >
                <Ionicons name="shield-outline" size={14} color={editUserRole === "admin" ? "#fff" : colors.textSecondary} />
                <Text style={[s.filterChipText, { color: editUserRole === "admin" ? "#fff" : colors.textSecondary }]}>Quản trị viên</Text>
              </Pressable>
            </View>
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Đặt lại mật khẩu (để trống nếu không đổi)</Text>
            <TextInput
              style={[s.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={editUserPassword}
              onChangeText={setEditUserPassword}
              placeholder="Nhập mật khẩu mới..."
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
            />
            <View style={s.editModalActions}>
              <Pressable onPress={() => { setEditUserModal(false); setEditUserPassword(""); }} style={[s.editModalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[s.editModalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={saveEditUser} style={[s.editModalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[s.editModalBtnText, { color: "#fff" }]}>{t().common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  accessDenied: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  tabBar: { flexDirection: "row", paddingHorizontal: 12 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    gap: 4,
  },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 12, paddingTop: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47%" as any,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 16 },
  topDestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 0.5 },
  rankBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  topDestName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  topDestCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8, borderBottomWidth: 0.5 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  timelineDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  noData: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 16 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  itemTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 },
  ratingText: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  reviewText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 18 },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  detailCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailName: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  detailSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  detailInfo: { gap: 8, marginTop: 4 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  detailActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  detailBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  subTabBar: { flexDirection: "row", gap: 0 },
  subTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  descLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  reviewCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, marginTop: 6 },
  reviewerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  lockBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "70%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  modalInput: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, marginLeft: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  categoryLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  coordRow: { flexDirection: "row", gap: 10 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalSaveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  modalSaveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  editModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  editModalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  editModalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editModalBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  editModalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
