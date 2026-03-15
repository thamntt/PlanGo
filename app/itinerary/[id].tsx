import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Share,
  TextInput,
  Linking,
  Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import * as Clipboard from "expo-clipboard";
import { formatVND, generateId, getUsers } from "@/lib/storage";
import { t } from "@/lib/i18n";
import type { ItineraryActivity, Expense, ExpenseSplit, TripCompanion, POI } from "@/lib/storage";
import RouteMap from "@/components/RouteMap";

function getStatusLabel(status: string): string {
  const labels = t().trips;
  if (status === "draft") return labels.statusDraft;
  if (status === "active") return labels.statusActive;
  if (status === "completed") return labels.statusCompleted;
  return status;
}

function getActivityTypeLabel(type: string): string {
  const labels = t().itinerary;
  const map: Record<string, string> = {
    sightseeing: labels.sightseeing,
    food: labels.food,
    transport: labels.transport,
    shopping: labels.shopping,
    other: labels.other,
  };
  return map[type] || type;
}

function getActivityTypeIcon(type: string): string {
  const map: Record<string, string> = {
    sightseeing: "eye-outline",
    food: "restaurant-outline",
    transport: "car-outline",
    shopping: "bag-outline",
    other: "ellipse-outline",
  };
  return map[type] || "ellipse-outline";
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

interface TravelInfo {
  distanceKm: number;
  drivingMinutes: number;
  motorbikeMinutes: number;
  walkingMinutes: number;
  defaultMode: "driving" | "walking";
}

function getTravelInfo(from: ItineraryActivity, to: ItineraryActivity): TravelInfo | null {
  if (from.latitude == null || from.longitude == null || to.latitude == null || to.longitude == null) return null;
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

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parseDurationToMinutes(duration: string): number {
  const hourMatch = duration.match(/([\d.]+)\s*giờ/);
  const minMatch = duration.match(/(\d+)\s*phút/);
  let total = 0;
  if (hourMatch) total += parseFloat(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total > 0 ? total : 60;
}

function TravelConnector({ from, to, colors: c }: { from: ItineraryActivity; to: ItineraryActivity; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const travel = getTravelInfo(from, to);
  const txt = t().itinerary;
  if (!travel) return null;

  const defaultTime = travel.defaultMode === "walking" ? travel.walkingMinutes : travel.drivingMinutes;
  const defaultIcon = travel.defaultMode === "walking" ? "walk-outline" : "car-outline";

  return (
    <View style={travelStyles.container}>
      <View style={travelStyles.lineWrapper}>
        <View style={[travelStyles.line, { backgroundColor: c.textTertiary + "40" }]} />
      </View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={[travelStyles.badge, { backgroundColor: c.inputBg, borderColor: c.cardBorder }]}
      >
        <Ionicons name={defaultIcon as any} size={14} color={c.textSecondary} />
        <Text style={[travelStyles.badgeText, { color: c.textSecondary }]}>
          {defaultTime} {txt.travelMinutes} {txt.toDestination} {to.title.length > 20 ? to.title.substring(0, 20) + "..." : to.title} • {travel.distanceKm} {txt.travelKm}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={12} color={c.textTertiary} />
      </Pressable>
      {expanded && (
        <View style={[travelStyles.modeList, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[travelStyles.modeTitle, { color: c.text }]}>{txt.travelMode}</Text>
          <View style={travelStyles.modeRow}>
            <Ionicons name="car-outline" size={16} color={c.textSecondary} />
            <Text style={[travelStyles.modeLabel, { color: c.text }]}>{txt.driving}</Text>
            <Text style={[travelStyles.modeValue, { color: c.textSecondary }]}>
              {travel.drivingMinutes} {txt.travelMinutes} • {travel.distanceKm} {txt.travelKm}
            </Text>
          </View>
          <View style={travelStyles.modeRow}>
            <Ionicons name="bicycle-outline" size={16} color={c.textSecondary} />
            <Text style={[travelStyles.modeLabel, { color: c.text }]}>{txt.motorbike}</Text>
            <Text style={[travelStyles.modeValue, { color: c.textSecondary }]}>
              {travel.motorbikeMinutes} {txt.travelMinutes} • {travel.distanceKm} {txt.travelKm}
            </Text>
          </View>
          <View style={travelStyles.modeRow}>
            <Ionicons name="walk-outline" size={16} color={c.textSecondary} />
            <Text style={[travelStyles.modeLabel, { color: c.text }]}>{txt.walking}</Text>
            <Text style={[travelStyles.modeValue, { color: c.textSecondary }]}>
              {travel.walkingMinutes} {txt.travelMinutes} • {travel.distanceKm} {txt.travelKm}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { itineraries, updateItinerary, deleteItinerary, addNotification, destinations, reviews, addReview, updateReview, deleteReview, pois } = useData();

  const itinerary = itineraries.find((i) => i.id === id);
  const [activeTab, setActiveTab] = useState<"itinerary" | "expenses" | "companions">("itinerary");
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [noteModal, setNoteModal] = useState<{ activityId: string; dayIdx: number; note: string; editIndex?: number } | null>(null);
  const [costModal, setCostModal] = useState<{ activityId: string; dayIdx: number; cost: string; estimatedCost: string; paidBy: string } | null>(null);
  const [timeModal, setTimeModal] = useState<{ activityId: string; dayIdx: number; time: string } | null>(null);
  const [addPlaceModal, setAddPlaceModal] = useState<{ dayIdx: number } | null>(null);
  const [editInfoModal, setEditInfoModal] = useState(false);

  const [placeTitle, setPlaceTitle] = useState("");
  const [placeDuration, setPlaceDuration] = useState("1 giờ");
  const [placeCost, setPlaceCost] = useState("");
  const [placeType, setPlaceType] = useState<"sightseeing" | "food" | "transport" | "shopping" | "other">("sightseeing");

  const [expenseModal, setExpenseModal] = useState<{ editId?: string } | null>(null);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseType, setExpenseType] = useState<"transport" | "shopping" | "food" | "sightseeing" | "other">("transport");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expensePaidByUserId, setExpensePaidByUserId] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState<"none" | "equal" | "custom">("none");
  const [expenseSplitChecked, setExpenseSplitChecked] = useState<Record<string, boolean>>({});
  const [expenseSplitAmounts, setExpenseSplitAmounts] = useState<Record<string, string>>({});
  const [paidByDropdown, setPaidByDropdown] = useState(false);
  const [expenseNoteModal, setExpenseNoteModal] = useState<{ expenseId: string; note: string; editIndex?: number } | null>(null);

  const [editBudget, setEditBudget] = useState("");
  const [editNumPeople, setEditNumPeople] = useState("");

  const [shareModal, setShareModal] = useState(false);
  const [companionModal, setCompanionModal] = useState(false);
  const [sharePermission, setSharePermission] = useState<"editor" | "viewer">("viewer");
  const [activityDetailModal, setActivityDetailModal] = useState<ItineraryActivity | null>(null);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());
  const [showAllUserReviews, setShowAllUserReviews] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ activityId: string; dayIdx: number; destinationId?: string; editReviewId?: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [routeMapModal, setRouteMapModal] = useState<{ dayIdx: number } | null>(null);
  const [addPlaceTab, setAddPlaceTab] = useState<"system" | "manual">("system");
  const [poiSearch, setPoiSearch] = useState("");
  const [poiDestFilter, setPoiDestFilter] = useState("");

  const totalEstimated = useMemo(() => {
    if (!itinerary) return 0;
    return itinerary.days.reduce((sum, day) => sum + day.activities.reduce((s, a) => s + (a.estimatedCost || 0), 0), 0);
  }, [itinerary?.days]);

  const totalSpent = useMemo(() => {
    if (!itinerary) return 0;
    const activitySpent = itinerary.days.reduce((sum, day) => sum + day.activities.reduce((s, a) => s + (a.actualCost || 0), 0), 0);
    const expenseSpent = (itinerary.expenses || []).reduce((sum, e) => sum + e.amount, 0);
    return activitySpent + expenseSpent;
  }, [itinerary?.days, itinerary?.expenses]);

  const isOwner = user?.id === (itinerary?.userId ?? "");
  const companions = itinerary?.companions || [];
  const myCompanion = companions.find((c) => c.userId === user?.id);
  const isCompanion = !!myCompanion;
  const canEdit = isOwner || (myCompanion?.role === "editor");

  const [ownerName, setOwnerName] = useState("");
  useEffect(() => {
    if (!itinerary) return;
    if (isOwner && user) {
      setOwnerName(user.fullName);
    } else {
      getUsers().then((users) => {
        const owner = users.find((u) => u.id === itinerary.userId);
        if (owner) setOwnerName(owner.fullName);
      });
    }
  }, [isOwner, user, itinerary?.userId]);

  // Sync companions from server for shared trips
  useEffect(() => {
    if (!itinerary?.shareCode || !itinerary?.isShared) return;
    const syncCompanions = async () => {
      try {
        const serverDomain = process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000";
        const serverProtocol = serverDomain.includes("localhost") ? "http" : "https";
        const res = await fetch(`${serverProtocol}://${serverDomain}/api/share/${itinerary.shareCode}`);
        if (!res.ok) return;
        const serverTrip = await res.json();
        const serverCompanions = serverTrip.companions || [];
        const localCompanions = itinerary.companions || [];
        // Check if server has companions that local doesn't
        const hasNew = serverCompanions.some(
          (sc: any) => !localCompanions.some((lc) => lc.userId === sc.userId)
        );
        if (hasNew) {
          await updateItinerary(itinerary.id, { companions: serverCompanions });
        }
      } catch (e) { /* silent fail */ }
    };
    syncCompanions();
  }, [itinerary?.shareCode, itinerary?.isShared]);

  const tripMembers = useMemo(() => {
    const members: { userId: string; userName: string; isOwner: boolean }[] = [];
    if (itinerary) {
      members.push({ userId: itinerary.userId, userName: ownerName || itinerary.userId, isOwner: true });
    }
    for (const c of companions) {
      if (!members.find((m) => m.userId === c.userId)) {
        members.push({ userId: c.userId, userName: c.userName, isOwner: false });
      }
    }
    return members;
  }, [ownerName, itinerary?.userId, companions]);

  if (!itinerary) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>{t().itinerary.notFound}</Text>
      </View>
    );
  }

  const initSplitChecked = () => {
    const checked: Record<string, boolean> = {};
    tripMembers.forEach((m) => { checked[m.userId] = true; });
    return checked;
  };

  const remaining = (itinerary.totalBudget || 0) - totalSpent;
  const budgetPercent = itinerary.totalBudget > 0 ? Math.min(100, (totalSpent / itinerary.totalBudget) * 100) : 0;
  const expenses = itinerary.expenses || [];

  const generateShareCode = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  };

  const handleGenerateLink = async () => {
    const code = itinerary.shareCode || generateShareCode();
    await updateItinerary(itinerary.id, {
      shareCode: code,
      sharePermission: sharePermission,
      isShared: true,
    });
    // Sync to server so other browsers can find this trip
    try {
      const serverDomain = process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000";
      const serverProtocol = serverDomain.includes("localhost") ? "http" : "https";
      const updatedItinerary = { ...itinerary, shareCode: code, sharePermission, isShared: true };
      await fetch(`${serverProtocol}://${serverDomain}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: code, itinerary: updatedItinerary }),
      });
    } catch (e) { console.log("Failed to sync share to server:", e); }
    const domain = Platform.OS === "web" ? window.location.host : (process.env.EXPO_PUBLIC_DOMAIN || "localhost:8081");
    const protocol = domain.includes("localhost") ? "http" : "https";
    const link = `${protocol}://${domain}/join/${code}`;
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === "web") {
      alert(txt.linkCopied);
    } else {
      Alert.alert(txt.linkCopied);
    }
  };

  const getServerUrl = () => {
    const serverDomain = process.env.EXPO_PUBLIC_DOMAIN || "localhost:5000";
    const serverProtocol = serverDomain.includes("localhost") ? "http" : "https";
    return `${serverProtocol}://${serverDomain}`;
  };

  const handleRemoveCompanion = (companion: TripCompanion) => {
    const doRemove = async () => {
      const updated = companions.filter((c) => c.userId !== companion.userId);
      await updateItinerary(itinerary.id, { companions: updated });
      // Sync to server
      if (itinerary.shareCode) {
        try {
          await fetch(`${getServerUrl()}/api/share/companion`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shareCode: itinerary.shareCode, userId: companion.userId }),
          });
        } catch (e) { console.log("Failed to sync companion removal:", e); }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    if (Platform.OS === "web") {
      if (window.confirm(txt.removeCompanionMsg(companion.userName))) doRemove();
    } else {
      Alert.alert(txt.removeCompanion, txt.removeCompanionMsg(companion.userName), [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doRemove },
      ]);
    }
  };

  const handleChangeCompanionRole = async (companion: TripCompanion, newRole: "editor" | "viewer") => {
    const updated = companions.map((c) =>
      c.userId === companion.userId ? { ...c, role: newRole } : c
    );
    await updateItinerary(itinerary.id, { companions: updated });
    // Sync to server
    if (itinerary.shareCode) {
      try {
        await fetch(`${getServerUrl()}/api/share/companion`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareCode: itinerary.shareCode, userId: companion.userId, role: newRole }),
        });
      } catch (e) { console.log("Failed to sync role change:", e); }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleLeaveTrip = () => {
    const doLeave = async () => {
      const updated = companions.filter((c) => c.userId !== user?.id);
      await updateItinerary(itinerary.id, { companions: updated });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    };
    if (Platform.OS === "web") {
      if (window.confirm(txt.leaveTripMsg)) doLeave();
    } else {
      Alert.alert(txt.leaveTrip, txt.leaveTripMsg, [
        { text: t().common.cancel, style: "cancel" },
        { text: txt.leaveTrip, style: "destructive", onPress: doLeave },
      ]);
    }
  };

  const openGoogleMaps = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    } else if (address) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    }
  };

  const openGrab = (lat?: number, lng?: number) => {
    if (lat && lng) {
      const url = Platform.OS === "ios"
        ? `grab://open?screenType=BOOKING&dropOffLatitude=${lat}&dropOffLongitude=${lng}`
        : `https://grab.onelink.me/2695613898?af_dp=grab%3A%2F%2Fopen%3FscreenType%3DBOOKING%26dropOffLatitude%3D${lat}%26dropOffLongitude%3D${lng}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      });
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const daysSummary = itinerary.days.map((d) =>
      `📅 ${d.title}\n${d.activities.map((a) =>
        `  ${a.time} - ${a.title}${a.estimatedCost ? ` (${formatVND(a.estimatedCost)})` : ""}`
      ).join("\n")}`
    ).join("\n\n");
    const message = `✈️ ${itinerary.title}\n📍 ${itinerary.destination}\n🗓 ${itinerary.startDate} - ${itinerary.endDate}\n👥 ${itinerary.numPeople} người\n💰 ${formatVND(itinerary.totalBudget || 0)}\n${itinerary.startingPoint ? `🚀 Xuất phát: ${itinerary.startingPoint}\n` : ""}\n${daysSummary}`;
    try {
      if (Platform.OS === "web") {
        try { await navigator.clipboard.writeText(message); } catch { /* fallback */ }
        alert("Đã copy lịch trình vào clipboard!");
        await updateItinerary(itinerary.id, { isShared: true });
        return;
      }
      await Share.share({ message, title: itinerary.title });
      await updateItinerary(itinerary.id, { isShared: true });
    } catch (e) {
      console.log(e);
    }
  };

  const handleStatusChange = () => {
    const nextStatus = itinerary.status === "draft" ? "active" : itinerary.status === "active" ? "completed" : "draft";

    // Block start if today < startDate
    if (nextStatus === "active") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const startParts = itinerary.startDate.split("/");
      const start = startParts.length === 3 ? new Date(parseInt(startParts[2]), parseInt(startParts[1]) - 1, parseInt(startParts[0])) : new Date(itinerary.startDate);
      if (today < start) {
        const msg = `Chỉ có thể bắt đầu chuyến đi từ ngày ${itinerary.startDate}`;
        if (Platform.OS === "web") { window.alert(msg); } else { Alert.alert("", msg); }
        return;
      }
    }

    if (nextStatus === "draft") {
      const msg = txt.resetConfirm;
      const doReset = async () => {
        const currentResetCount = itinerary.resetCount || 0;
        const newResetCount = currentResetCount + 1;
        // Tag existing reviews so they are hidden after restart
        const allActivityIds = itinerary.days.flatMap((d) => d.activities.map((a) => a.id));
        for (const actId of allActivityIds) {
          const review = getActivityReview(actId);
          if (review) {
            const taggedComment = review.comment.includes("[resetBefore:") ? review.comment : `${review.comment} [resetBefore:${newResetCount}]`;
            await updateReview(review.id, { comment: taggedComment });
          }
        }
        const newDays = itinerary.days.map((day) => ({
          ...day,
          activities: day.activities.map((a) => ({
            ...a,
            isCompleted: false,
            actualCost: 0,
          })),
        }));
        await updateItinerary(itinerary.id, {
          status: "draft",
          days: newDays,
          expenses: [],
          spentAmount: 0,
          resetCount: newResetCount,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      };
      if (Platform.OS === "web") {
        if (window.confirm(msg)) doReset();
      } else {
        Alert.alert(t().itinerary.changeStatus, msg, [
          { text: t().common.cancel, style: "cancel" },
          { text: t().common.confirm, onPress: doReset },
        ]);
      }
      return;
    }

    const msg = t().itinerary.confirmStatus(getStatusLabel(nextStatus));
    const doChange = async () => {
      await updateItinerary(itinerary.id, { status: nextStatus });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (nextStatus === "active") {
        await addNotification({ userId: itinerary.userId, title: t().notifications.tripStarted, message: `${itinerary.title} đã bắt đầu!`, type: "info" });
      } else if (nextStatus === "completed") {
        await addNotification({ userId: itinerary.userId, title: t().notifications.tripCompleted, message: `${itinerary.title} đã hoàn thành!`, type: "success" });
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doChange();
    } else {
      Alert.alert(t().itinerary.changeStatus, msg, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.confirm, onPress: doChange },
      ]);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t().itinerary.deleteConfirm)) {
        deleteItinerary(itinerary.id);
        router.back();
      }
    } else {
      Alert.alert(t().itinerary.deleteTrip, t().itinerary.deleteConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: () => { deleteItinerary(itinerary.id); router.back(); } },
      ]);
    }
  };

  const handleEdit = () => {
    router.push({ pathname: "/create-trip", params: { editId: itinerary.id } });
  };

  const recalcSpent = (days: typeof itinerary.days, exps: Expense[]) => {
    const activitySpent = days.reduce((sum, day) => sum + day.activities.reduce((s, a) => s + (a.actualCost || 0), 0), 0);
    const expenseSpent = exps.reduce((sum, e) => sum + e.amount, 0);
    return activitySpent + expenseSpent;
  };

  const getActivityReview = (activityId: string) => {
    const activity = itinerary.days.flatMap((d) => d.activities).find((a) => a.id === activityId);
    if (!activity) return null;
    const linkedDest = activity.destinationId
      ? destinations.find((d) => d.id === activity.destinationId)
      : destinations.find((d) => d.name === activity.title);
    if (!linkedDest) return null;
    const currentResetCount = itinerary.resetCount || 0;
    return reviews.find((r) => {
      if (r.destinationId !== linkedDest.id || r.userId !== user?.id) return false;
      if (!r.comment.includes(`[activity:${activityId}]`)) return false;
      // Hide reviews tagged from previous resets
      const resetMatch = r.comment.match(/\[resetBefore:(\d+)\]/);
      if (resetMatch && parseInt(resetMatch[1], 10) <= currentResetCount) return false;
      return true;
    }) || null;
  };

  const getActivityDestinationId = (activity: ItineraryActivity): string | undefined => {
    const linkedDest = activity.destinationId
      ? destinations.find((d) => d.id === activity.destinationId)
      : destinations.find((d) => d.name === activity.title);
    return linkedDest?.id;
  };

  const toggleActivityComplete = async (dayIdx: number, activityId: string) => {
    const newDays = [...itinerary.days];
    const activity = newDays[dayIdx].activities.find((a) => a.id === activityId);
    if (!activity) return;

    if (activity.isCompleted) {
      const existingReview = getActivityReview(activityId);
      if (existingReview) {
        if (Platform.OS === "web") {
          window.alert(txt.cannotUncheckHasReview);
        } else {
          Alert.alert("", txt.cannotUncheckHasReview);
        }
        return;
      }
    }

    activity.isCompleted = !activity.isCompleted;
    if (activity.isCompleted && !activity.actualCost && activity.estimatedCost) {
      activity.actualCost = activity.estimatedCost;
    } else if (!activity.isCompleted && activity.actualCost === activity.estimatedCost) {
      activity.actualCost = 0;
    }
    const newSpent = recalcSpent(newDays, expenses);
    await updateItinerary(itinerary.id, { days: newDays, spentAmount: newSpent });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activity.isCompleted) {
      await addNotification({ userId: itinerary.userId, title: t().notifications.activityCompleted, message: `"${activity.title}" đã hoàn thành`, type: "info" });
    }
    if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
      await addNotification({ userId: itinerary.userId, title: t().notifications.budgetWarning, message: t().notifications.budgetExceeded(formatVND(itinerary.totalBudget - newSpent)), type: "warning" });
    }
  };

  const openReviewModal = (activityId: string, dayIdx: number, editReviewId?: string) => {
    const activity = itinerary.days[dayIdx].activities.find((a) => a.id === activityId);
    if (!activity) return;
    const destId = getActivityDestinationId(activity);
    if (editReviewId) {
      const existingReview = reviews.find((r) => r.id === editReviewId);
      if (existingReview) {
        setReviewRating(existingReview.rating);
        setReviewComment(existingReview.comment.replace(/\s*\[activity:[^\]]+\]/, ""));
      }
    } else {
      setReviewRating(5);
      setReviewComment("");
    }
    setReviewModal({ activityId, dayIdx, destinationId: destId, editReviewId });
  };

  const submitActivityReview = async () => {
    if (!reviewModal || !reviewComment.trim()) return;
    const taggedComment = reviewModal.activityId ? `${reviewComment.trim()} [activity:${reviewModal.activityId}]` : reviewComment.trim();
    if (reviewModal.editReviewId) {
      await updateReview(reviewModal.editReviewId, { rating: reviewRating, comment: taggedComment });
    } else if (reviewModal.destinationId) {
      await addReview({
        userId: user!.id,
        userName: user!.fullName,
        destinationId: reviewModal.destinationId,
        rating: reviewRating,
        comment: taggedComment,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReviewModal(null);
  };

  const handleDeleteActivityReview = (reviewId: string) => {
    const doDelete = async () => {
      await deleteReview(reviewId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    if (Platform.OS === "web") {
      if (window.confirm(txt.deleteReviewConfirm)) doDelete();
    } else {
      Alert.alert(txt.deleteReview, txt.deleteReviewConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const getActivityNotes = (activity: ItineraryActivity): string[] => {
    const notes: string[] = [];
    if (activity.notes && activity.notes.length > 0) {
      notes.push(...activity.notes);
    } else if (activity.note) {
      notes.push(activity.note);
    }
    return notes;
  };

  const saveNote = async () => {
    if (!noteModal || !noteModal.note.trim()) return;
    const newDays = [...itinerary.days];
    const activity = newDays[noteModal.dayIdx].activities.find((a) => a.id === noteModal.activityId);
    if (activity) {
      const currentNotes = getActivityNotes(activity);
      if (noteModal.editIndex !== undefined) {
        currentNotes[noteModal.editIndex] = noteModal.note.trim();
      } else {
        currentNotes.push(noteModal.note.trim());
      }
      activity.notes = currentNotes;
      activity.note = undefined;
      await updateItinerary(itinerary.id, { days: newDays });
    }
    setNoteModal(null);
  };

  const deleteNote = async (dayIdx: number, activityId: string, noteIndex: number) => {
    const doDelete = async () => {
      const newDays = [...itinerary.days];
      const activity = newDays[dayIdx].activities.find((a) => a.id === activityId);
      if (activity) {
        const currentNotes = getActivityNotes(activity);
        currentNotes.splice(noteIndex, 1);
        activity.notes = currentNotes;
        activity.note = undefined;
        await updateItinerary(itinerary.id, { days: newDays });
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(t().itinerary.deleteNoteConfirm)) doDelete();
    } else {
      Alert.alert(t().itinerary.deleteNote, t().itinerary.deleteNoteConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const saveCost = async () => {
    if (!costModal) return;
    const newDays = [...itinerary.days];
    const activity = newDays[costModal.dayIdx].activities.find((a) => a.id === costModal.activityId);
    if (activity) {
      const newActualCost = parseInt(costModal.cost.replace(/[^0-9]/g, ""), 10) || 0;
      const newEstimatedCost = parseInt(costModal.estimatedCost.replace(/[^0-9]/g, ""), 10) || 0;
      // Apply estimated cost only if allowed
      const canEditEstimated = itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted);
      if (canEditEstimated) {
        activity.estimatedCost = newEstimatedCost;
      }
      // Apply actual cost only if not draft
      if (itinerary.status !== "draft") {
        activity.actualCost = newActualCost;
      }
      activity.paidBy = costModal.paidBy.trim() || undefined;
      const newSpent = recalcSpent(newDays, expenses);
      await updateItinerary(itinerary.id, { days: newDays, spentAmount: newSpent });
      if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
        if (Platform.OS === "web") {
          window.alert(t().itinerary.budgetWarning);
        } else {
          Alert.alert(t().notifications.budgetWarning, t().itinerary.budgetWarning);
        }
      }
    }
    setCostModal(null);
  };

  const saveTime = async () => {
    if (!timeModal) return;
    const newTime = timeModal.time.trim();
    const newMins = parseTimeToMinutes(newTime);
    if (newMins < 0) {
      if (Platform.OS === "web") {
        window.alert("Giờ không hợp lệ. Vui lòng nhập theo dạng HH:MM (VD: 08:30)");
      } else {
        Alert.alert("Lỗi", "Giờ không hợp lệ. Vui lòng nhập theo dạng HH:MM (VD: 08:30)");
      }
      return;
    }
    const newDays = [...itinerary.days];
    const activities = newDays[timeModal.dayIdx].activities;
    const actIdx = activities.findIndex((a) => a.id === timeModal.activityId);
    if (actIdx === -1) return;

    activities[actIdx].time = minutesToTime(newMins);

    let currentEnd = newMins + parseDurationToMinutes(activities[actIdx].duration || "1 giờ");
    for (let i = actIdx + 1; i < activities.length; i++) {
      const travelInfo = getTravelInfo(activities[i - 1], activities[i]);
      const travelMins = travelInfo ? (travelInfo.defaultMode === "walking" ? travelInfo.walkingMinutes : travelInfo.drivingMinutes) : 0;
      const nextStart = currentEnd + travelMins;
      activities[i].time = minutesToTime(nextStart);
      currentEnd = nextStart + parseDurationToMinutes(activities[i].duration || "1 giờ");
    }

    await updateItinerary(itinerary.id, { days: newDays });
    setTimeModal(null);
  };

  const addPlaceToDay = async () => {
    if (!addPlaceModal || !placeTitle.trim()) return;
    const newDays = [...itinerary.days];
    const activities = newDays[addPlaceModal.dayIdx].activities;
    const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;
    let nextTime = "09:00";
    if (lastActivity) {
      const lastMins = parseTimeToMinutes(lastActivity.time);
      if (lastMins >= 0) {
        nextTime = minutesToTime(lastMins + parseDurationToMinutes(lastActivity.duration || "1 giờ"));
      }
    }
    const cost = parseInt(placeCost.replace(/[^0-9]/g, ""), 10) || 0;
    const newActivity: ItineraryActivity = {
      id: generateId(),
      time: nextTime,
      title: placeTitle.trim(),
      description: "",
      duration: placeDuration || "1 giờ",
      estimatedCost: cost,
      isCompleted: false,
      activityType: placeType,
    };
    activities.push(newActivity);
    await updateItinerary(itinerary.id, { days: newDays });
    setPlaceTitle("");
    setPlaceDuration("1 giờ");
    setPlaceCost("");
    setPlaceType("sightseeing");
    setAddPlaceModal(null);
  };

  const deleteActivity = async (dayIdx: number, activityId: string) => {
    const doDelete = async () => {
      const newDays = [...itinerary.days];
      newDays[dayIdx].activities = newDays[dayIdx].activities.filter((a) => a.id !== activityId);
      const newSpent = recalcSpent(newDays, expenses);
      await updateItinerary(itinerary.id, { days: newDays, spentAmount: newSpent });
    };
    if (Platform.OS === "web") {
      if (window.confirm(t().itinerary.deleteActivityConfirm)) doDelete();
    } else {
      Alert.alert(t().itinerary.deleteActivity, t().itinerary.deleteActivityConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const moveActivity = async (dayIdx: number, activityIdx: number, direction: "up" | "down") => {
    const newDays = [...itinerary.days];
    const activities = [...newDays[dayIdx].activities];
    const newIdx = direction === "up" ? activityIdx - 1 : activityIdx + 1;
    if (newIdx < 0 || newIdx >= activities.length) return;
    [activities[activityIdx], activities[newIdx]] = [activities[newIdx], activities[activityIdx]];
    newDays[dayIdx].activities = activities;
    await updateItinerary(itinerary.id, { days: newDays });
    Haptics.selectionAsync();
  };

  const autoSortDay = async (dayIdx: number) => {
    const newDays = [...itinerary.days];
    const acts = [...newDays[dayIdx].activities];
    if (acts.length <= 1) return;
    const timeSlots = ["07:00", "08:30", "10:30", "12:00", "14:00", "16:00", "18:00", "20:00"];
    // Nearest-neighbor sort
    const remaining = [...acts];
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
          if (d < nearestDist) { nearestDist = d; nearestIdx = j; }
        }
      }
      sorted.push(remaining.splice(nearestIdx, 1)[0]);
    }
    newDays[dayIdx].activities = sorted.map((act, idx) => ({
      ...act,
      time: timeSlots[idx] || act.time,
    }));
    await updateItinerary(itinerary.id, { days: newDays });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === "web") { window.alert(txt.autoSortDone); }
    else { Alert.alert("", txt.autoSortDone); }
  };

  const addPlaceFromPOI = async (poi: POI, dayIdx: number) => {
    const newDays = [...itinerary.days];
    const activities = newDays[dayIdx].activities;
    const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;
    let nextTime = "09:00";
    if (lastActivity) {
      const lastMins = parseTimeToMinutes(lastActivity.time);
      if (lastMins >= 0) {
        nextTime = minutesToTime(lastMins + parseDurationToMinutes(lastActivity.duration || "1 giờ"));
      }
    }
    const typeMap: Record<string, "sightseeing" | "food" | "transport" | "shopping" | "other"> = {
      attraction: "sightseeing",
      restaurant: "food",
      cafe: "food",
      hotel: "other",
      shopping: "shopping",
      other: "other",
    };
    const newActivity: ItineraryActivity = {
      id: generateId(),
      time: nextTime,
      title: poi.name,
      description: poi.description || "",
      duration: poi.estimatedDuration || "1 giờ",
      estimatedCost: poi.estimatedCost || 0,
      isCompleted: false,
      activityType: typeMap[poi.type] || "sightseeing",
      address: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      poiId: poi.id,
      destinationId: poi.destinationId,
    };
    activities.push(newActivity);
    await updateItinerary(itinerary.id, { days: newDays });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddPlaceModal(null);
    setPoiSearch("");
    setPoiDestFilter("");
  };

  const filteredPOIs = useMemo(() => {
    let filtered = pois.filter((p) => p.isActive);
    if (poiDestFilter) {
      filtered = filtered.filter((p) => p.destinationId === poiDestFilter);
    }
    if (poiSearch.trim()) {
      const q = poiSearch.toLowerCase().trim();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
      );
    }
    return filtered.slice(0, 20);
  }, [pois, poiSearch, poiDestFilter]);

  const saveEditInfo = async () => {
    const newBudget = parseInt(editBudget.replace(/[^0-9]/g, ""), 10) || itinerary.totalBudget;
    const newPeople = parseInt(editNumPeople, 10) || itinerary.numPeople;
    await updateItinerary(itinerary.id, {
      totalBudget: newBudget,
      budget: formatVND(newBudget),
      numPeople: newPeople,
    });
    setEditInfoModal(false);
  };

  const buildSplits = (amount: number): ExpenseSplit[] | undefined => {
    if (expenseSplitType === "none") return undefined;
    if (expenseSplitType === "equal") {
      const checked = Object.entries(expenseSplitChecked).filter(([, v]) => v);
      if (checked.length === 0) return undefined;
      const base = Math.floor(amount / checked.length);
      let remainder = amount - base * checked.length;
      return checked.map(([uid]) => {
        const m = tripMembers.find((t) => t.userId === uid);
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        return { userId: uid, userName: m?.userName || "", amount: base + extra };
      });
    }
    if (expenseSplitType === "custom") {
      return tripMembers
        .filter((m) => expenseSplitChecked[m.userId])
        .map((m) => ({
          userId: m.userId,
          userName: m.userName,
          amount: parseInt((expenseSplitAmounts[m.userId] || "0").replace(/[^0-9]/g, ""), 10) || 0,
        }));
    }
    return undefined;
  };

  const addOrEditExpense = async () => {
    if (!expenseModal || !expenseTitle.trim() || !expenseAmount.trim()) return;
    const amount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
    if (amount <= 0) return;

    if (expenseSplitType !== "none" && !expensePaidByUserId) return;

    if (expenseSplitType !== "none") {
      const checkedCount = Object.values(expenseSplitChecked).filter(Boolean).length;
      if (checkedCount === 0) return;
    }

    if (expenseSplitType === "custom") {
      const splits = buildSplits(amount);
      const splitTotal = (splits || []).reduce((s, sp) => s + sp.amount, 0);
      if (splitTotal !== amount) {
        if (Platform.OS === "web") {
          window.alert(txt.splitTotalMismatch);
        } else {
          Alert.alert("", txt.splitTotalMismatch);
        }
        return;
      }
    }

    const splits = buildSplits(amount);

    let newExpenses = [...expenses];
    if (expenseModal.editId) {
      const idx = newExpenses.findIndex((e) => e.id === expenseModal.editId);
      if (idx !== -1) {
        newExpenses[idx] = {
          ...newExpenses[idx],
          title: expenseTitle.trim(),
          amount,
          type: expenseType,
          paidBy: expensePaidBy.trim() || undefined,
          paidByUserId: expensePaidByUserId || undefined,
          splitType: expenseSplitType,
          splits,
        };
      }
    } else {
      newExpenses.push({
        id: generateId(),
        title: expenseTitle.trim(),
        amount,
        type: expenseType,
        paidBy: expensePaidBy.trim() || undefined,
        paidByUserId: expensePaidByUserId || undefined,
        splitType: expenseSplitType,
        splits,
        createdAt: new Date().toISOString(),
      });
    }

    const newSpent = recalcSpent(itinerary.days, newExpenses);
    await updateItinerary(itinerary.id, { expenses: newExpenses, spentAmount: newSpent });

    if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
      await addNotification({ userId: itinerary.userId, title: t().notifications.budgetWarning, message: t().notifications.budgetExceeded(formatVND(itinerary.totalBudget - newSpent)), type: "warning" });
    }

    resetExpenseModal();
  };

  const resetExpenseModal = () => {
    setExpenseTitle("");
    setExpenseAmount("");
    setExpensePaidBy("");
    setExpensePaidByUserId("");
    setExpenseType("transport");
    setExpenseSplitType("none");
    setExpenseSplitChecked({});
    setExpenseSplitAmounts({});
    setPaidByDropdown(false);
    setExpenseModal(null);
  };

  const deleteExpense = async (expenseId: string) => {
    const doDelete = async () => {
      const newExpenses = expenses.filter((e) => e.id !== expenseId);
      const newSpent = recalcSpent(itinerary.days, newExpenses);
      await updateItinerary(itinerary.id, { expenses: newExpenses, spentAmount: newSpent });
    };
    if (Platform.OS === "web") {
      if (window.confirm(t().itinerary.deleteExpenseConfirm)) doDelete();
    } else {
      Alert.alert(t().itinerary.deleteExpense, t().itinerary.deleteExpenseConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const openEditExpense = (expense: Expense) => {
    setExpenseTitle(expense.title);
    setExpenseAmount(expense.amount.toString());
    setExpenseType(expense.type);
    setExpensePaidBy(expense.paidBy || "");
    setExpensePaidByUserId(expense.paidByUserId || "");
    setExpenseSplitType(expense.splitType || "none");
    if (expense.splits) {
      const checked: Record<string, boolean> = {};
      const amounts: Record<string, string> = {};
      expense.splits.forEach((sp) => {
        checked[sp.userId] = true;
        amounts[sp.userId] = sp.amount.toString();
      });
      setExpenseSplitChecked(checked);
      setExpenseSplitAmounts(amounts);
    } else {
      setExpenseSplitChecked(initSplitChecked());
      setExpenseSplitAmounts({});
    }
    setExpenseModal({ editId: expense.id });
  };

  const saveExpenseNote = async () => {
    if (!expenseNoteModal || !expenseNoteModal.note.trim()) return;
    const newExpenses = [...expenses];
    const expense = newExpenses.find((e) => e.id === expenseNoteModal.expenseId);
    if (expense) {
      const notes = expense.notes ? [...expense.notes] : [];
      if (expenseNoteModal.editIndex !== undefined) {
        notes[expenseNoteModal.editIndex] = expenseNoteModal.note.trim();
      } else {
        notes.push(expenseNoteModal.note.trim());
      }
      expense.notes = notes;
      await updateItinerary(itinerary.id, { expenses: newExpenses });
    }
    setExpenseNoteModal(null);
  };

  const deleteExpenseNote = async (expenseId: string, noteIndex: number) => {
    const doDelete = async () => {
      const newExpenses = [...expenses];
      const expense = newExpenses.find((e) => e.id === expenseId);
      if (expense && expense.notes) {
        expense.notes.splice(noteIndex, 1);
        await updateItinerary(itinerary.id, { expenses: newExpenses });
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(t().itinerary.deleteNoteConfirm)) doDelete();
    } else {
      Alert.alert(t().itinerary.deleteNote, t().itinerary.deleteNoteConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const txt = t().itinerary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/trips")}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {itinerary.title}
        </Text>
        <View style={styles.headerActions}>
          {isOwner && (
            <Pressable onPress={() => { setSharePermission(itinerary.sharePermission || "viewer"); setShareModal(true); }} hitSlop={8}>
              <Ionicons name="person-add-outline" size={22} color={colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={handleShare} hitSlop={8}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </Pressable>
          {isOwner ? (
            <Pressable onPress={handleDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </Pressable>
          ) : isCompanion ? (
            <Pressable onPress={handleLeaveTrip} hitSlop={8}>
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{txt.destination}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{itinerary.destination}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{txt.dates}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {itinerary.startDate} - {itinerary.endDate}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{txt.travelers}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{itinerary.numPeople}</Text>
            </View>
            {itinerary.startingPoint ? (
              <View style={styles.summaryItem}>
                <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{txt.startingPoint}</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{itinerary.startingPoint}</Text>
              </View>
            ) : null}
          </View>
        </View>



        {itinerary.totalBudget > 0 && (
          <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.budgetHeader}>
              <Text style={[styles.budgetTitle, { color: colors.text }]}>{txt.budgetProgress}</Text>
              {canEdit && itinerary.status === "draft" && (
                <Pressable
                  onPress={() => {
                    setEditBudget(itinerary.totalBudget.toString());
                    setEditNumPeople(itinerary.numPeople.toString());
                    setEditInfoModal(true);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </Pressable>
              )}
            </View>
            <View style={styles.budgetRow}>
              <View style={styles.budgetItem}>
                <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>{txt.totalBudget}</Text>
                <Text style={[styles.budgetAmount, { color: colors.text }]}>{formatVND(itinerary.totalBudget)}</Text>
              </View>
              <View style={styles.budgetItem}>
                <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>{txt.spent}</Text>
                <Text style={[styles.budgetAmount, { color: colors.accent }]}>{formatVND(totalSpent)}</Text>
              </View>
              <View style={styles.budgetItem}>
                <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>{txt.remaining}</Text>
                <Text style={[styles.budgetAmount, { color: remaining >= 0 ? colors.success : colors.error }]}>
                  {formatVND(Math.abs(remaining))}
                  {remaining < 0 ? " ⚠️" : ""}
                </Text>
              </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.inputBg }]}>
              <View style={[styles.progressFill, {
                width: `${Math.min(budgetPercent, 100)}%` as any,
                backgroundColor: budgetPercent > 90 ? colors.error : budgetPercent > 70 ? colors.warning : colors.success,
              }]} />
            </View>
            <Text style={[styles.budgetEstimate, { color: colors.textTertiary }]}>
              {txt.estimatedCost}: {formatVND(totalEstimated)}
            </Text>
          </View>
        )}

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: itinerary.status === "active" ? "#10B981" : itinerary.status === "completed" ? "#6B7280" : colors.accent }]}>
            <Text style={styles.statusBadgeText}>{getStatusLabel(itinerary.status)}</Text>
          </View>
        </View>

        {canEdit && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleStatusChange}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons
                name={itinerary.status === "draft" ? "play" : itinerary.status === "active" ? "checkmark-circle" : "refresh"}
                size={18}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>
                {itinerary.status === "draft" ? txt.startTrip : itinerary.status === "active" ? txt.complete : txt.reset}
              </Text>
            </Pressable>
            {itinerary.status === "draft" && (
              <Pressable
                onPress={handleEdit}
                style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>{txt.editTrip}</Text>
              </Pressable>
            )}
          </View>
        )}

        {itinerary.preferences.length > 0 && (
          <View style={styles.prefRow}>
            {itinerary.preferences.map((p) => (
              <View key={p} style={[styles.prefChip, { backgroundColor: colors.tagBg }]}>
                <Text style={[styles.prefChipText, { color: colors.tagText }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab("itinerary")}
            style={[styles.tabBtn, activeTab === "itinerary" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Ionicons name="map-outline" size={16} color={activeTab === "itinerary" ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabBtnText, { color: activeTab === "itinerary" ? colors.primary : colors.textTertiary }]}>{txt.tabItinerary}</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("expenses")}
            style={[styles.tabBtn, activeTab === "expenses" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Ionicons name="wallet-outline" size={16} color={activeTab === "expenses" ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabBtnText, { color: activeTab === "expenses" ? colors.primary : colors.textTertiary }]}>{txt.tabExpenses}</Text>
            {expenses.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.tabBadgeText}>{expenses.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("companions")}
            style={[styles.tabBtn, activeTab === "companions" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Ionicons name="people-outline" size={16} color={activeTab === "companions" ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabBtnText, { color: activeTab === "companions" ? colors.primary : colors.textTertiary }]}>{txt.companions}</Text>
            {companions.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.tabBadgeText}>{companions.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {activeTab === "itinerary" && (
          <>
            {itinerary.days.map((day, dayIdx) => (
              <View key={day.day}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setExpandedDay(expandedDay === dayIdx ? null : dayIdx);
                  }}
                >
                  <View style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.dayHeader}>
                      <View style={[styles.dayBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.dayBadgeText}>{day.day}</Text>
                      </View>
                      <Text style={[styles.dayTitle, { color: colors.text }]}>{day.title}</Text>
                      <Ionicons
                        name={expandedDay === dayIdx ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.textTertiary}
                      />
                    </View>
                  </View>
                </Pressable>

                {expandedDay === dayIdx && canEdit && (itinerary.status === "draft" || itinerary.status === "active") && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <Pressable
                      onPress={() => autoSortDay(dayIdx)}
                      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary + "12", opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Ionicons name="swap-vertical" size={14} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.primary }}>{txt.autoSort}</Text>
                    </Pressable>
                    {day.activities.some((a) => a.latitude != null && a.longitude != null) && (
                      <Pressable
                        onPress={() => setRouteMapModal({ dayIdx })}
                        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accent + "12", opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Ionicons name="map-outline" size={14} color={colors.accent} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.accent }}>{txt.viewRouteMap}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {expandedDay === dayIdx && (
                  <View style={styles.activitiesList}>
                    {day.activities.map((activity, actIdx) => (
                      <React.Fragment key={activity.id}>
                        {actIdx > 0 && (
                          <TravelConnector from={day.activities[actIdx - 1]} to={activity} colors={colors} />
                        )}
                        <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: activity.isCompleted ? colors.success + "50" : colors.cardBorder }]}>
                          <View style={styles.activityTop}>
                            {itinerary.status === "active" && canEdit && (
                              <Pressable
                                onPress={() => toggleActivityComplete(dayIdx, activity.id)}
                                style={[styles.checkbox, { borderColor: activity.isCompleted ? colors.success : colors.textTertiary, backgroundColor: activity.isCompleted ? colors.success : "transparent" }]}
                              >
                                {activity.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
                              </Pressable>
                            )}
                            {itinerary.status === "completed" && activity.isCompleted && (
                              <View style={[styles.checkbox, { borderColor: colors.success, backgroundColor: colors.success }]}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <View style={styles.activityTitleRow}>
                                <Pressable onPress={() => { const canEditTime = canEdit && (itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted)); if (canEditTime) setTimeModal({ activityId: activity.id, dayIdx, time: activity.time }); }}>
                                  <Text style={[styles.activityTime, { color: colors.primary, textDecorationLine: (canEdit && (itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted))) ? "underline" : "none" }]}>{activity.time}</Text>
                                </Pressable>
                                <View style={[styles.typeBadge, { backgroundColor: colors.tagBg }]}>
                                  <Ionicons name={getActivityTypeIcon(activity.activityType) as any} size={12} color={colors.tagText} />
                                  <Text style={[styles.typeText, { color: colors.tagText }]}>{getActivityTypeLabel(activity.activityType)}</Text>
                                </View>
                              </View>
                              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpandedReviewIds(new Set()); setShowAllUserReviews(false); setActivityDetailModal(activity); }}>
                                <Text style={[styles.activityTitle, { color: activity.isCompleted ? colors.textSecondary : colors.primary, textDecorationLine: activity.isCompleted ? "line-through" : "none" }]}>
                                  {activity.title}
                                  <Text style={{ fontSize: 12, color: activity.isCompleted ? colors.textTertiary : colors.primary }}> ›</Text>
                                </Text>
                              </Pressable>
                              <Text style={[styles.activityDesc, { color: colors.textSecondary }]}>{activity.description}</Text>
                              {activity.duration ? <Text style={[styles.activityDuration, { color: colors.textTertiary }]}>{activity.duration}</Text> : null}
                            </View>
                          </View>

                          <View style={styles.costRow}>
                            {activity.estimatedCost > 0 && (
                              <Text style={[styles.costText, { color: colors.textSecondary }]}>
                                {txt.estimatedCost}: {formatVND(activity.estimatedCost)}
                              </Text>
                            )}
                            {activity.actualCost !== undefined && activity.actualCost > 0 && (
                              <Text style={[styles.costText, { color: colors.accent }]}>
                                {txt.actualCost}: {formatVND(activity.actualCost)}
                              </Text>
                            )}
                            {activity.paidBy && (
                              <Text style={[styles.paidByText, { color: colors.textTertiary }]}>
                                {txt.paidBy}: {activity.paidBy}
                              </Text>
                            )}
                          </View>

                          {(() => {
                            const actReview = getActivityReview(activity.id);
                            if (actReview && itinerary.status !== "draft") {
                              return (
                                <View style={[styles.reviewBox, { backgroundColor: colors.inputBg }]}>
                                  <View style={styles.reviewBoxHeader}>
                                    <Ionicons name="star" size={14} color="#F59E0B" />
                                    <Text style={[styles.reviewBoxRating, { color: colors.text }]}>{actReview.rating}/5</Text>
                                    <Text style={[styles.reviewBoxComment, { color: colors.textSecondary }]} numberOfLines={2}>
                                      {actReview.comment.replace(/\s*\[activity:[^\]]+\]/, "")}
                                    </Text>
                                  </View>
                                  <View style={styles.reviewBoxActions}>
                                    <Pressable onPress={() => openReviewModal(activity.id, dayIdx, actReview.id)} hitSlop={6}>
                                      <Ionicons name="create-outline" size={14} color={colors.primary} />
                                    </Pressable>
                                    <Pressable onPress={() => handleDeleteActivityReview(actReview.id)} hitSlop={6}>
                                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                                    </Pressable>
                                  </View>
                                </View>
                              );
                            }
                            return null;
                          })()}

                          {getActivityNotes(activity).length > 0 && (
                            <View style={styles.notesContainer}>
                              {getActivityNotes(activity).map((noteItem, noteIdx) => (
                                <View key={noteIdx} style={[styles.noteBox, { backgroundColor: colors.inputBg }]}>
                                  <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                                  <Text style={[styles.noteText, { color: colors.textSecondary }]}>{noteItem}</Text>
                                  {canEdit && (
                                    <>
                                      <Pressable onPress={() => setNoteModal({ activityId: activity.id, dayIdx, note: noteItem, editIndex: noteIdx })} hitSlop={6}>
                                        <Ionicons name="create-outline" size={14} color={colors.primary} />
                                      </Pressable>
                                      <Pressable onPress={() => deleteNote(dayIdx, activity.id, noteIdx)} hitSlop={6}>
                                        <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                                      </Pressable>
                                    </>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}

                          <View style={styles.activityActions}>
                            {/* Notes: all statuses */}
                            {canEdit && (
                              <Pressable onPress={() => setNoteModal({ activityId: activity.id, dayIdx, note: "" })} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                              </Pressable>
                            )}
                            {/* Cost: draft=estimated only, active/completed=both/actual */}
                            {canEdit && (() => {
                              if (itinerary.status === "draft") return true;
                              if (itinerary.status === "active") return true;
                              if (itinerary.status === "completed") return true;
                              return false;
                            })() && (
                              <Pressable onPress={() => setCostModal({ activityId: activity.id, dayIdx, cost: (activity.actualCost || 0).toString(), estimatedCost: (activity.estimatedCost || 0).toString(), paidBy: activity.paidBy || "" })} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="cash-outline" size={14} color={colors.accent} />
                              </Pressable>
                            )}
                            {/* Time: draft or active unchecked */}
                            {canEdit && (itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted)) && (
                              <Pressable onPress={() => setTimeModal({ activityId: activity.id, dayIdx, time: activity.time })} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="time-outline" size={14} color={colors.primary} />
                              </Pressable>
                            )}
                            {activity.latitude != null && activity.longitude != null && (
                              <>
                                <Pressable onPress={() => openGoogleMaps(activity.latitude, activity.longitude, activity.address)} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                  <Ionicons name="map-outline" size={14} color={colors.success} />
                                </Pressable>
                                <Pressable onPress={() => openGrab(activity.latitude, activity.longitude)} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                  <Ionicons name="car-outline" size={14} color="#00B14F" />
                                </Pressable>
                              </>
                            )}
                            {/* Reorder: draft or active unchecked */}
                            {canEdit && (itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted)) && actIdx > 0 && (
                              <Pressable onPress={() => moveActivity(dayIdx, actIdx, "up")} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="arrow-up" size={14} color={colors.textSecondary} />
                              </Pressable>
                            )}
                            {canEdit && (itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted)) && actIdx < day.activities.length - 1 && (
                              <Pressable onPress={() => moveActivity(dayIdx, actIdx, "down")} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
                              </Pressable>
                            )}
                            {/* Delete: draft or active unchecked */}
                            {canEdit && (itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted)) && (
                              <Pressable onPress={() => deleteActivity(dayIdx, activity.id)} style={[styles.miniBtn, { backgroundColor: colors.error + "15" }]}>
                                <Ionicons name="trash-outline" size={14} color={colors.error} />
                              </Pressable>
                            )}
                            {/* Review: active(completed) or completed status */}
                            {itinerary.status !== "draft" && activity.isCompleted && getActivityDestinationId(activity) && !getActivityReview(activity.id) && (
                              <Pressable onPress={() => openReviewModal(activity.id, dayIdx)} style={[styles.miniBtn, { backgroundColor: colors.primary + "15" }]}>
                                <Ionicons name="star-outline" size={14} color={colors.primary} />
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </React.Fragment>
                    ))}

                    {/* Add place: draft or active */}
                    {canEdit && (itinerary.status === "draft" || itinerary.status === "active") && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setAddPlaceModal({ dayIdx });
                        }}
                        style={[styles.addExpenseBtn, { borderColor: colors.primary + "50" }]}
                      >
                        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                        <Text style={[styles.addExpenseText, { color: colors.primary }]}>{txt.addPlace}</Text>
                      </Pressable>
                    )}
                    {/* Delete day: active, only if no completed activities */}
                    {canEdit && itinerary.status === "active" && itinerary.days.length > 1 && !day.activities.some(a => a.isCompleted) && (
                      <Pressable
                        onPress={() => {
                          const doDelete = async () => {
                            const newDays = itinerary.days.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, day: i + 1, title: `Ngày ${i + 1}` }));
                            // Recalculate endDate
                            const startParts = itinerary.startDate.split("/");
                            const startDate = startParts.length === 3 ? new Date(parseInt(startParts[2]), parseInt(startParts[1]) - 1, parseInt(startParts[0])) : new Date(itinerary.startDate);
                            const newEnd = new Date(startDate);
                            newEnd.setDate(newEnd.getDate() + newDays.length - 1);
                            const endStr = `${newEnd.getDate().toString().padStart(2, "0")}/${(newEnd.getMonth() + 1).toString().padStart(2, "0")}/${newEnd.getFullYear()}`;
                            const newSpent = recalcSpent(newDays, expenses);
                            await updateItinerary(itinerary.id, { days: newDays, endDate: endStr, spentAmount: newSpent });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          };
                          if (Platform.OS === "web") { if (window.confirm(`Xóa ${day.title}?`)) doDelete(); }
                          else { Alert.alert("Xóa ngày", `Xóa ${day.title}?`, [{ text: t().common.cancel, style: "cancel" }, { text: t().common.delete, style: "destructive", onPress: doDelete }]); }
                        }}
                        style={[styles.addExpenseBtn, { borderColor: colors.error + "50" }]}
                      >
                        <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
                        <Text style={[styles.addExpenseText, { color: colors.error }]}>Xóa {day.title}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            ))}
            {/* Add Day button: active trips */}
            {canEdit && itinerary.status === "active" && (
              <Pressable
                onPress={async () => {
                  const newDayNum = itinerary.days.length + 1;
                  const newDays = [...itinerary.days, { day: newDayNum, title: `Ngày ${newDayNum}`, activities: [] }];
                  // Recalculate endDate
                  const startParts = itinerary.startDate.split("/");
                  const startDate = startParts.length === 3 ? new Date(parseInt(startParts[2]), parseInt(startParts[1]) - 1, parseInt(startParts[0])) : new Date(itinerary.startDate);
                  const newEnd = new Date(startDate);
                  newEnd.setDate(newEnd.getDate() + newDays.length - 1);
                  const endStr = `${newEnd.getDate().toString().padStart(2, "0")}/${(newEnd.getMonth() + 1).toString().padStart(2, "0")}/${newEnd.getFullYear()}`;
                  await updateItinerary(itinerary.id, { days: newDays, endDate: endStr });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                style={[styles.addExpenseBtn, { borderColor: colors.primary + "50", marginTop: 8 }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.addExpenseText, { color: colors.primary }]}>Thêm ngày</Text>
              </Pressable>
            )}
          </>
        )}

        {activeTab === "expenses" && (
          <View style={styles.expensesTab}>
            {expenses.length === 0 ? (
              <View style={styles.emptyExpenses}>
                <Ionicons name="wallet-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{txt.noExpenses}</Text>
                <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>{txt.noExpensesHint}</Text>
              </View>
            ) : (
              expenses.map((expense) => (
                <View key={expense.id} style={[styles.expenseCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.expenseTop}>
                    <Ionicons name={getActivityTypeIcon(expense.type) as any} size={20} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.expenseTitle, { color: colors.text }]}>{expense.title}</Text>
                      <View style={styles.expenseMeta}>
                        <Text style={[styles.expenseMetaText, { color: colors.textTertiary }]}>
                          {new Date(expense.createdAt).toLocaleDateString("vi-VN")} • {getActivityTypeLabel(expense.type)}
                        </Text>
                        {expense.paidBy && (
                          <Text style={[styles.expenseMetaText, { color: colors.textTertiary }]}> • {txt.paidBy}: {expense.paidBy}</Text>
                        )}
                        {expense.splitType && expense.splitType !== "none" && (
                          <Text style={[styles.expenseMetaText, { color: colors.primary }]}>
                            {" "} • {expense.splitType === "equal" ? txt.splitEqual : txt.splitCustom}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.expenseAmount, { color: colors.text }]}>{formatVND(expense.amount)}</Text>
                  </View>

                  {expense.splits && expense.splits.length > 0 && (
                    <View style={styles.splitDetails}>
                      {expense.splits.map((sp) => (
                        <View key={sp.userId} style={styles.splitDetailRow}>
                          <Text style={[styles.splitDetailName, { color: colors.textSecondary }]}>{sp.userName}</Text>
                          <Text style={[styles.splitDetailAmount, { color: colors.accent }]}>{formatVND(sp.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {expense.notes && expense.notes.length > 0 && (
                    <View style={styles.notesContainer}>
                      {expense.notes.map((noteItem, noteIdx) => (
                        <View key={noteIdx} style={[styles.noteBox, { backgroundColor: colors.inputBg }]}>
                          <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.noteText, { color: colors.textSecondary }]}>{noteItem}</Text>
                          {canEdit && (
                            <>
                              <Pressable onPress={() => setExpenseNoteModal({ expenseId: expense.id, note: noteItem, editIndex: noteIdx })} hitSlop={6}>
                                <Ionicons name="create-outline" size={14} color={colors.primary} />
                              </Pressable>
                              <Pressable onPress={() => deleteExpenseNote(expense.id, noteIdx)} hitSlop={6}>
                                <Ionicons name="close-circle-outline" size={14} color={colors.error} />
                              </Pressable>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {canEdit && (
                    <View style={styles.expenseActions}>
                      <Pressable onPress={() => setExpenseNoteModal({ expenseId: expense.id, note: "" })} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                      </Pressable>
                      <Pressable onPress={() => openEditExpense(expense)} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="create-outline" size={14} color={colors.accent} />
                      </Pressable>
                      {itinerary.status !== "completed" && (
                        <Pressable onPress={() => deleteExpense(expense.id)} style={[styles.miniBtn, { backgroundColor: colors.error + "15" }]}>
                          <Ionicons name="trash-outline" size={14} color={colors.error} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}

            {(() => {
              const expensesWithSplits = expenses.filter((e) => e.splits && e.splits.length > 0 && e.paidByUserId);
              if (expensesWithSplits.length === 0) return null;

              const balances: Record<string, Record<string, number>> = {};
              for (const exp of expensesWithSplits) {
                const payerId = exp.paidByUserId!;
                for (const sp of exp.splits!) {
                  if (sp.userId === payerId) continue;
                  if (!balances[sp.userId]) balances[sp.userId] = {};
                  balances[sp.userId][payerId] = (balances[sp.userId][payerId] || 0) + sp.amount;
                }
              }

              const settlements: { from: string; fromName: string; to: string; toName: string; amount: number }[] = [];
              const netOwes: Record<string, Record<string, number>> = {};

              for (const [debtor, creditors] of Object.entries(balances)) {
                for (const [creditor, amount] of Object.entries(creditors)) {
                  const reverse = balances[creditor]?.[debtor] || 0;
                  const net = amount - reverse;
                  if (net > 0) {
                    if (!netOwes[debtor]) netOwes[debtor] = {};
                    netOwes[debtor][creditor] = net;
                  }
                }
              }

              const allMemberMap = new Map(tripMembers.map((m) => [m.userId, m.userName]));
              for (const [debtor, creditors] of Object.entries(netOwes)) {
                for (const [creditor, amount] of Object.entries(creditors)) {
                  settlements.push({
                    from: debtor,
                    fromName: allMemberMap.get(debtor) || debtor,
                    to: creditor,
                    toName: allMemberMap.get(creditor) || creditor,
                    amount,
                  });
                }
              }

              if (settlements.length === 0) return null;

              return (
                <View style={[styles.settlementCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.settlementHeader}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
                    <Text style={[styles.settlementTitle, { color: colors.text }]}>{txt.settlement}</Text>
                  </View>
                  {settlements.map((s, idx) => (
                    <View key={idx} style={styles.settlementRow}>
                      <Text style={[styles.settlementName, { color: colors.text }]}>{s.fromName}</Text>
                      <Text style={[styles.settlementOwes, { color: colors.textSecondary }]}>{txt.owes}</Text>
                      <Text style={[styles.settlementName, { color: colors.text }]}>{s.toName}</Text>
                      <Text style={[styles.settlementAmount, { color: colors.error }]}>{formatVND(s.amount)}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {canEdit && itinerary.status !== "completed" && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpenseTitle("");
                  setExpenseAmount("");
                  setExpensePaidBy(user?.fullName || "");
                  setExpensePaidByUserId(user?.id || "");
                  setExpenseType("transport");
                  setExpenseSplitType("none");
                  setExpenseSplitChecked(initSplitChecked());
                  setExpenseSplitAmounts({});
                  setExpenseModal({});
                }}
                style={[styles.addExpenseBtn, { borderColor: colors.primary + "50" }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.addExpenseText, { color: colors.primary }]}>{txt.addExpense}</Text>
              </Pressable>
            )}
          </View>
        )}

        {activeTab === "companions" && (
          <View style={{ gap: 14 }}>
            {/* Share link section for owner */}
            {isOwner && (
              <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="link-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.text }}>{txt.shareTrip}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 1 }}>{txt.copyLinkHint}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={[invStyles.permToggle, { backgroundColor: colors.inputBg, flex: 1 }]}>
                    <Pressable
                      onPress={() => setSharePermission("viewer")}
                      style={[invStyles.permBtn, sharePermission === "viewer" && { backgroundColor: colors.card, ...invStyles.permBtnActive }]}
                    >
                      <Ionicons name="eye-outline" size={14} color={sharePermission === "viewer" ? colors.primary : colors.textSecondary} />
                      <Text style={[invStyles.permBtnText, { color: sharePermission === "viewer" ? colors.primary : colors.textSecondary, fontSize: 12 }]}>{txt.viewOnly}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setSharePermission("editor")}
                      style={[invStyles.permBtn, sharePermission === "editor" && { backgroundColor: colors.card, ...invStyles.permBtnActive }]}
                    >
                      <Ionicons name="create-outline" size={14} color={sharePermission === "editor" ? colors.primary : colors.textSecondary} />
                      <Text style={[invStyles.permBtnText, { color: sharePermission === "editor" ? colors.primary : colors.textSecondary, fontSize: 12 }]}>{txt.canEdit}</Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={handleGenerateLink}
                  style={({ pressed }) => [{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, marginTop: 4,
                    opacity: pressed ? 0.9 : 1,
                  }]}
                >
                  <Ionicons name="copy-outline" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{txt.copyLink}</Text>
                </Pressable>
              </View>
            )}

            {/* Companion list */}
            <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="people" size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.text }}>{txt.companions}</Text>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, marginTop: 1 }}>
                      {companions.length > 0 ? txt.companionsJoined(companions.length) : "Chưa có bạn đồng hành"}
                    </Text>
                  </View>
                </View>
              </View>

              {companions.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                  <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
                  <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.textSecondary }}>Chưa có ai tham gia</Text>
                  {isOwner && (
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textTertiary, textAlign: "center" }}>
                      Tạo link chia sẻ ở trên để mời bạn bè tham gia
                    </Text>
                  )}
                </View>
              ) : (
                companions.map((c, i) => {
                  const avatarColors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
                  const bg = avatarColors[i % avatarColors.length];
                  return (
                    <View key={c.userId} style={[invStyles.compRow, i < companions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder }]}>
                      <View style={[invStyles.compAvatar, { backgroundColor: bg }]}>
                        <Text style={invStyles.compAvatarText}>{c.userName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[invStyles.compName, { color: colors.text }]}>{c.userName}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name={c.role === "editor" ? "create-outline" : "eye-outline"} size={12} color={colors.textSecondary} />
                          <Text style={[invStyles.compRole, { color: colors.textSecondary }]}>
                            {c.role === "editor" ? txt.editor : txt.viewer}
                          </Text>
                        </View>
                      </View>
                      {isOwner && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => handleChangeCompanionRole(c, c.role === "editor" ? "viewer" : "editor")}
                            hitSlop={6}
                            style={[invStyles.roleToggleBtn, { backgroundColor: c.role === "editor" ? colors.primary + "18" : colors.accent + "18" }]}
                          >
                            <Ionicons
                              name={c.role === "editor" ? "eye-outline" : "create-outline"}
                              size={14}
                              color={c.role === "editor" ? colors.primary : colors.accent}
                            />
                            <Text style={[invStyles.roleToggleText, { color: c.role === "editor" ? colors.primary : colors.accent }]}>
                              {c.role === "editor" ? txt.viewOnly : txt.canEdit}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveCompanion(c)}
                            hitSlop={6}
                            style={[invStyles.removeBtn, { backgroundColor: colors.error + "12" }]}
                          >
                            <Ionicons name="person-remove-outline" size={16} color={colors.error} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Leave trip button for companions */}
            {isCompanion && (
              <Pressable
                onPress={handleLeaveTrip}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  paddingVertical: 14, borderRadius: 14, borderWidth: 1,
                  borderColor: colors.error + "40", backgroundColor: colors.error + "08",
                  opacity: pressed ? 0.9 : 1,
                }]}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.error }}>{txt.leaveTrip}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!noteModal} transparent animationType="fade" onRequestClose={() => setNoteModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{noteModal?.editIndex !== undefined ? txt.editNote : txt.addNote}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={noteModal?.note || ""}
              onChangeText={(v) => noteModal && setNoteModal({ ...noteModal, note: v })}
              placeholder={txt.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setNoteModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={saveNote} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!costModal} transparent animationType="fade" onRequestClose={() => setCostModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Chi phí</Text>
            {/* Estimated cost: editable in draft, active unchecked */}
            {(() => {
              if (!costModal) return null;
              const act = itinerary.days[costModal.dayIdx]?.activities.find(a => a.id === costModal.activityId);
              const canEditEst = itinerary.status === "draft" || (itinerary.status === "active" && act && !act.isCompleted);
              if (!canEditEst) return null;
              return (
                <>
                  <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>{txt.estimatedCost} (VNĐ)</Text>
                  <TextInput
                    style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    value={costModal?.estimatedCost || ""}
                    onChangeText={(v) => costModal && setCostModal({ ...costModal, estimatedCost: v })}
                    placeholder="VD: 500000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </>
              );
            })()}
            {/* Actual cost: editable in active, completed */}
            {itinerary.status !== "draft" && (
              <>
                <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>{txt.actualCost} (VNĐ)</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  value={costModal?.cost || ""}
                  onChangeText={(v) => costModal && setCostModal({ ...costModal, cost: v })}
                  placeholder="VD: 500000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </>
            )}
            <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>{txt.paidBy}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={costModal?.paidBy || ""}
              onChangeText={(v) => costModal && setCostModal({ ...costModal, paidBy: v })}
              placeholder="VD: Minh"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCostModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={saveCost} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!timeModal} transparent animationType="fade" onRequestClose={() => setTimeModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.editTime}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={timeModal?.time || ""}
              onChangeText={(v) => timeModal && setTimeModal({ ...timeModal, time: v })}
              placeholder={txt.timePlaceholder}
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setTimeModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={saveTime} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!addPlaceModal} transparent animationType="fade" onRequestClose={() => setAddPlaceModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "80%" }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.addPlace}</Text>
            <View style={{ flexDirection: "row", gap: 0, marginBottom: 12 }}>
              <Pressable
                onPress={() => setAddPlaceTab("system")}
                style={[styles.tabBtn, { flex: 1, paddingVertical: 8 }, addPlaceTab === "system" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              >
                <Ionicons name="business-outline" size={14} color={addPlaceTab === "system" ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabBtnText, { fontSize: 12, color: addPlaceTab === "system" ? colors.primary : colors.textTertiary }]}>{txt.fromSystem}</Text>
              </Pressable>
              <Pressable
                onPress={() => setAddPlaceTab("manual")}
                style={[styles.tabBtn, { flex: 1, paddingVertical: 8 }, addPlaceTab === "manual" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              >
                <Ionicons name="create-outline" size={14} color={addPlaceTab === "manual" ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabBtnText, { fontSize: 12, color: addPlaceTab === "manual" ? colors.primary : colors.textTertiary }]}>{txt.manual}</Text>
              </Pressable>
            </View>

            {addPlaceTab === "system" ? (
              <>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  value={poiSearch}
                  onChangeText={setPoiSearch}
                  placeholder={txt.searchPOI}
                  placeholderTextColor={colors.textTertiary}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, maxHeight: 36 }}>
                  <Pressable
                    onPress={() => setPoiDestFilter("")}
                    style={[styles.typeChip, { backgroundColor: !poiDestFilter ? colors.primary : colors.inputBg, borderColor: !poiDestFilter ? colors.primary : colors.inputBorder }]}
                  >
                    <Text style={[styles.typeChipText, { color: !poiDestFilter ? "#fff" : colors.textSecondary }]}>{txt.allDestinations}</Text>
                  </Pressable>
                  {destinations.filter((d) => d.isActive).map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => setPoiDestFilter(poiDestFilter === d.id ? "" : d.id)}
                      style={[styles.typeChip, { backgroundColor: poiDestFilter === d.id ? colors.primary : colors.inputBg, borderColor: poiDestFilter === d.id ? colors.primary : colors.inputBorder }]}
                    >
                      <Text style={[styles.typeChipText, { color: poiDestFilter === d.id ? "#fff" : colors.textSecondary }]} numberOfLines={1}>{d.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                  {filteredPOIs.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 20 }}>
                      <Ionicons name="search-outline" size={28} color={colors.textTertiary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 }}>{txt.noPOIsFound}</Text>
                    </View>
                  ) : (
                    filteredPOIs.map((poi) => {
                      const parentDest = destinations.find((d) => d.id === poi.destinationId);
                      return (
                        <Pressable
                          key={poi.id}
                          onPress={() => addPlaceModal && addPlaceFromPOI(poi, addPlaceModal.dayIdx)}
                          style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, backgroundColor: pressed ? colors.primary + "08" : "transparent", borderBottomWidth: 1, borderBottomColor: colors.inputBorder }]}
                        >
                          <View style={[styles.typeBadge, { backgroundColor: colors.primary + "12" }]}>
                            <Ionicons name={getActivityTypeIcon(poi.type === "attraction" ? "sightseeing" : poi.type === "restaurant" ? "food" : poi.type === "cafe" ? "food" : poi.type) as any} size={16} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.text }} numberOfLines={1}>{poi.name}</Text>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textSecondary }} numberOfLines={1}>{poi.address}</Text>
                            {parentDest && (
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.textTertiary }}>{parentDest.name}</Text>
                            )}
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 2 }}>
                            {poi.rating > 0 && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                <Ionicons name="star" size={10} color="#F59E0B" />
                                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.textSecondary }}>{poi.rating.toFixed(1)}</Text>
                              </View>
                            )}
                            {poi.estimatedCost ? (
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.accent }}>{formatVND(poi.estimatedCost)}</Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
                <View style={[styles.modalActions, { marginTop: 10 }]}>
                  <Pressable onPress={() => setAddPlaceModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  value={placeTitle}
                  onChangeText={setPlaceTitle}
                  placeholder={txt.addPlacePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                />
                <View style={styles.typeRow}>
                  {(["sightseeing", "food", "transport", "shopping", "other"] as const).map((tp) => (
                    <Pressable
                      key={tp}
                      onPress={() => setPlaceType(tp)}
                      style={[styles.typeChip, { backgroundColor: placeType === tp ? colors.primary : colors.inputBg, borderColor: placeType === tp ? colors.primary : colors.inputBorder }]}
                    >
                      <Ionicons name={getActivityTypeIcon(tp) as any} size={14} color={placeType === tp ? "#fff" : colors.textSecondary} />
                      <Text style={[styles.typeChipText, { color: placeType === tp ? "#fff" : colors.textSecondary }]}>{getActivityTypeLabel(tp)}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  value={placeCost}
                  onChangeText={setPlaceCost}
                  placeholder={txt.expenseAmount + " (VNĐ)"}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setAddPlaceModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
                  </Pressable>
                  <Pressable onPress={addPlaceToDay} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.add}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!expenseModal} transparent animationType="fade" onRequestClose={() => resetExpenseModal()}>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ maxHeight: "90%" }} contentContainerStyle={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{expenseModal?.editId ? txt.editExpense : txt.addExpense}</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                value={expenseTitle}
                onChangeText={setExpenseTitle}
                placeholder="VD: Taxi sân bay"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={styles.typeRow}>
                {(["transport", "shopping", "food", "sightseeing", "other"] as const).map((tp) => (
                  <Pressable
                    key={tp}
                    onPress={() => setExpenseType(tp)}
                    style={[styles.typeChip, { backgroundColor: expenseType === tp ? colors.primary : colors.inputBg, borderColor: expenseType === tp ? colors.primary : colors.inputBorder }]}
                  >
                    <Ionicons name={getActivityTypeIcon(tp) as any} size={14} color={expenseType === tp ? "#fff" : colors.textSecondary} />
                    <Text style={[styles.typeChipText, { color: expenseType === tp ? "#fff" : colors.textSecondary }]}>{getActivityTypeLabel(tp)}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                placeholder={txt.expenseAmount + " (VNĐ)"}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />

              <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>{txt.paidBy}</Text>
              <Pressable
                onPress={() => setPaidByDropdown(!paidByDropdown)}
                style={[styles.dropdownBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              >
                <Text style={[styles.dropdownBtnText, { color: expensePaidBy ? colors.text : colors.textTertiary }]}>
                  {expensePaidBy || txt.selectPaidBy}
                </Text>
                <Ionicons name={paidByDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
              </Pressable>
              {paidByDropdown && (
                <View style={[styles.dropdownList, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  {tripMembers.map((m) => (
                    <Pressable
                      key={m.userId}
                      onPress={() => {
                        setExpensePaidBy(m.userName);
                        setExpensePaidByUserId(m.userId);
                        setPaidByDropdown(false);
                      }}
                      style={[styles.dropdownItem, expensePaidByUserId === m.userId && { backgroundColor: colors.primary + "15" }]}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                        {m.userName}{m.isOwner ? ` (${txt.tripOwnerLabel})` : ""}
                      </Text>
                      {expensePaidByUserId === m.userId && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.splitLabel, { color: colors.textSecondary, marginTop: 12 }]}>{txt.splitType}</Text>
              <View style={styles.typeRow}>
                {(["none", "equal", "custom"] as const).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => {
                      setExpenseSplitType(st);
                      if (st !== "none" && Object.keys(expenseSplitChecked).length === 0) {
                        setExpenseSplitChecked(initSplitChecked());
                      }
                    }}
                    style={[styles.typeChip, { backgroundColor: expenseSplitType === st ? colors.primary : colors.inputBg, borderColor: expenseSplitType === st ? colors.primary : colors.inputBorder }]}
                  >
                    <Text style={[styles.typeChipText, { color: expenseSplitType === st ? "#fff" : colors.textSecondary }]}>
                      {st === "none" ? txt.splitNone : st === "equal" ? txt.splitEqual : txt.splitCustom}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {expenseSplitType !== "none" && (
                <View style={[styles.splitMemberList, { borderColor: colors.inputBorder }]}>
                  <Text style={[styles.splitMembersTitle, { color: colors.textSecondary }]}>{txt.splitMembers}</Text>
                  {tripMembers.map((m) => {
                    const isChecked = expenseSplitChecked[m.userId] ?? false;
                    const totalAmount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
                    const checkedCount = Object.values(expenseSplitChecked).filter(Boolean).length;
                    const equalShare = checkedCount > 0 ? Math.floor(totalAmount / checkedCount) : 0;

                    return (
                      <View key={m.userId} style={styles.splitMemberRow}>
                        <Pressable
                          onPress={() => setExpenseSplitChecked({ ...expenseSplitChecked, [m.userId]: !isChecked })}
                          style={[styles.checkbox, { borderColor: isChecked ? colors.success : colors.textTertiary, backgroundColor: isChecked ? colors.success : "transparent", width: 20, height: 20 }]}
                        >
                          {isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </Pressable>
                        <Text style={[styles.splitMemberName, { color: colors.text }]} numberOfLines={1}>
                          {m.userName}{m.isOwner ? ` (${txt.tripOwnerLabel})` : ""}
                        </Text>
                        {expenseSplitType === "equal" && isChecked && (
                          <Text style={[styles.splitMemberAmount, { color: colors.accent }]}>{formatVND(equalShare)}</Text>
                        )}
                        {expenseSplitType === "custom" && isChecked && (
                          <TextInput
                            style={[styles.splitAmountInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                            value={expenseSplitAmounts[m.userId] || ""}
                            onChangeText={(v) => setExpenseSplitAmounts({ ...expenseSplitAmounts, [m.userId]: v })}
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                          />
                        )}
                      </View>
                    );
                  })}
                  {expenseSplitType === "custom" && (() => {
                    const totalAmount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
                    const splitSum = Object.entries(expenseSplitAmounts)
                      .filter(([uid]) => expenseSplitChecked[uid])
                      .reduce((s, [, v]) => s + (parseInt(v.replace(/[^0-9]/g, ""), 10) || 0), 0);
                    const diff = totalAmount - splitSum;
                    return diff !== 0 ? (
                      <Text style={[styles.splitWarning, { color: colors.error }]}>
                        {txt.splitTotalMismatch} ({diff > 0 ? "+" : ""}{formatVND(diff)})
                      </Text>
                    ) : null;
                  })()}
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable onPress={resetExpenseModal} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
                </Pressable>
                <Pressable onPress={addOrEditExpense} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>{expenseModal?.editId ? t().common.save : t().common.add}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!expenseNoteModal} transparent animationType="fade" onRequestClose={() => setExpenseNoteModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{expenseNoteModal?.editIndex !== undefined ? txt.editNote : txt.addNote}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={expenseNoteModal?.note || ""}
              onChangeText={(v) => expenseNoteModal && setExpenseNoteModal({ ...expenseNoteModal, note: v })}
              placeholder={txt.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setExpenseNoteModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={saveExpenseNote} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editInfoModal} transparent animationType="fade" onRequestClose={() => setEditInfoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.editTripInfo}</Text>
            <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>{txt.totalBudget} (VNĐ)</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={editBudget}
              onChangeText={setEditBudget}
              keyboardType="numeric"
            />
            <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>{txt.travelers}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={editNumPeople}
              onChangeText={setEditNumPeople}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditInfoModal(false)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={saveEditInfo} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{txt.saveTripInfo}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={shareModal} transparent animationType="slide" onRequestClose={() => setShareModal(false)}>
        <View style={invStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModal(false)} />
          <View style={[invStyles.sheet, { backgroundColor: colors.card }]}>
            <View style={invStyles.handle} />

            <View style={invStyles.headerRow}>
              <View style={[invStyles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="person-add" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[invStyles.headerTitle, { color: colors.text }]}>{txt.inviteCompanion}</Text>
                <Text style={[invStyles.headerSub, { color: colors.textSecondary }]}>
                  {txt.inviteSubtitle}
                </Text>
              </View>
              <Pressable onPress={() => setShareModal(false)} hitSlop={10} style={[invStyles.closeBtn, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={invStyles.section}>
              <Text style={[invStyles.sectionLabel, { color: colors.textSecondary }]}>{txt.permission}</Text>
              <View style={[invStyles.permToggle, { backgroundColor: colors.inputBg }]}>
                <Pressable
                  style={[invStyles.permBtn, sharePermission === "editor" && [invStyles.permBtnActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setSharePermission("editor")}
                >
                  <Ionicons name="create-outline" size={16} color={sharePermission === "editor" ? "#fff" : colors.textSecondary} />
                  <Text style={[invStyles.permBtnText, { color: sharePermission === "editor" ? "#fff" : colors.text }]}>
                    {txt.canEdit}
                  </Text>
                </Pressable>
                <Pressable
                  style={[invStyles.permBtn, sharePermission === "viewer" && [invStyles.permBtnActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setSharePermission("viewer")}
                >
                  <Ionicons name="eye-outline" size={16} color={sharePermission === "viewer" ? "#fff" : colors.textSecondary} />
                  <Text style={[invStyles.permBtnText, { color: sharePermission === "viewer" ? "#fff" : colors.text }]}>
                    {txt.viewOnly}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[invStyles.copyLinkBtn, { backgroundColor: colors.primary }]}
              onPress={handleGenerateLink}
            >
              <View style={invStyles.copyLinkInner}>
                <View style={invStyles.copyLinkIconWrap}>
                  <Ionicons name="link" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={invStyles.copyLinkTitle}>{txt.copyLink}</Text>
                  <Text style={invStyles.copyLinkSub}>{txt.copyLinkHint}</Text>
                </View>
                <Ionicons name="copy-outline" size={20} color="rgba(255,255,255,0.7)" />
              </View>
            </Pressable>

            {companions.length > 0 && (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={[invStyles.sectionLabel, { color: colors.textSecondary }]}>{txt.memberList}</Text>
                  {companions.slice(0, 3).map((c, i) => {
                    const avatarColors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
                    const bg = avatarColors[i % avatarColors.length];
                    return (
                      <View key={c.userId} style={[invStyles.memberRow, { backgroundColor: colors.inputBg }]}>
                        <View style={[invStyles.memberAvatar, { backgroundColor: bg }]}>
                          <Text style={invStyles.manageBtnAvatarText}>{c.userName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[invStyles.manageBtnText, { color: colors.text }]}>{c.userName}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name={c.role === "editor" ? "create-outline" : "eye-outline"} size={12} color={colors.textSecondary} />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary }}>
                              {c.role === "editor" ? txt.canEdit : txt.viewOnly}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {companions.length > 3 && (
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center" }}>
                      +{companions.length - 3} {txt.companions.toLowerCase()}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={[invStyles.manageBtn, { backgroundColor: colors.inputBg }]}
                  onPress={() => { setShareModal(false); setCompanionModal(true); }}
                >
                  <View style={invStyles.manageBtnLeft}>
                    <Ionicons name="settings-outline" size={18} color={colors.primary} />
                    <Text style={[invStyles.manageBtnText, { color: colors.primary }]}>
                      {txt.manageCompanions}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={companionModal} transparent animationType="slide" onRequestClose={() => setCompanionModal(false)}>
        <View style={invStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCompanionModal(false)} />
          <View style={[invStyles.sheet, { backgroundColor: colors.card, maxHeight: "75%" }]}>
            <View style={invStyles.handle} />

            <View style={invStyles.headerRow}>
              <Pressable onPress={() => { setCompanionModal(false); if (isOwner) setShareModal(true); }} hitSlop={10}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={[invStyles.headerTitle, { color: colors.text, flex: 1, marginLeft: 12 }]}>{txt.manageCompanions}</Text>
              <Pressable onPress={() => setCompanionModal(false)} hitSlop={10} style={[invStyles.closeBtn, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[invStyles.compSummary, { backgroundColor: colors.inputBg }]}>
              <View style={[invStyles.compSummaryIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="people" size={18} color={colors.primary} />
              </View>
              <Text style={[invStyles.compSummaryText, { color: colors.text }]}>
                {txt.companionsJoined(companions.length)}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {companions.map((c, i) => {
                const avatarColors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
                const bg = avatarColors[i % avatarColors.length];
                return (
                  <View key={c.userId} style={[invStyles.compRow, i < companions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder }]}>
                    <View style={[invStyles.compAvatar, { backgroundColor: bg }]}>
                      <Text style={invStyles.compAvatarText}>{c.userName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[invStyles.compName, { color: colors.text }]}>{c.userName}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name={c.role === "editor" ? "create-outline" : "eye-outline"} size={12} color={colors.textSecondary} />
                        <Text style={[invStyles.compRole, { color: colors.textSecondary }]}>
                          {c.role === "editor" ? txt.editor : txt.viewer}
                        </Text>
                      </View>
                    </View>
                    {isOwner && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pressable
                          onPress={() => handleChangeCompanionRole(c, c.role === "editor" ? "viewer" : "editor")}
                          hitSlop={6}
                          style={[invStyles.roleToggleBtn, { backgroundColor: c.role === "editor" ? colors.primary + "18" : colors.accent + "18" }]}
                        >
                          <Ionicons
                            name={c.role === "editor" ? "eye-outline" : "create-outline"}
                            size={14}
                            color={c.role === "editor" ? colors.primary : colors.accent}
                          />
                          <Text style={[invStyles.roleToggleText, { color: c.role === "editor" ? colors.primary : colors.accent }]}>
                            {c.role === "editor" ? txt.viewOnly : txt.canEdit}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleRemoveCompanion(c)}
                          hitSlop={6}
                          style={[invStyles.removeBtn, { backgroundColor: colors.error + "12" }]}
                        >
                          <Ionicons name="person-remove-outline" size={16} color={colors.error} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!routeMapModal} transparent animationType="slide" onRequestClose={() => setRouteMapModal(null)}>
        <View style={actDetailStyles.overlay}>
          <View style={[actDetailStyles.content, { backgroundColor: colors.card }]}>
            <View style={actDetailStyles.header}>
              <Text style={[actDetailStyles.title, { color: colors.text }]}>{txt.routeMapTitle}</Text>
              <Pressable onPress={() => setRouteMapModal(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {routeMapModal && (() => {
              const day = itinerary.days[routeMapModal.dayIdx];
              if (!day) return null;
              const mapPoints = day.activities
                .filter((a) => a.latitude != null && a.longitude != null)
                .map((a, i) => ({
                  lat: a.latitude!,
                  lng: a.longitude!,
                  name: a.title,
                  type: a.activityType,
                  index: i,
                }));
              return (
                <View style={{ flex: 1 }}>
                  <RouteMap
                    points={mapPoints}
                    height={400}
                    colors={colors as any}
                    showRoute={true}
                  />
                  <ScrollView style={{ maxHeight: 150, marginTop: 10 }} showsVerticalScrollIndicator={false}>
                    {day.activities.filter((a) => a.latitude != null).map((a, i) => (
                      <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" }}>{i + 1}</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.text, flex: 1 }} numberOfLines={1}>{a.time} - {a.title}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal visible={!!activityDetailModal} transparent animationType="slide" onRequestClose={() => setActivityDetailModal(null)}>
        <View style={actDetailStyles.overlay}>
          <View style={[actDetailStyles.content, { backgroundColor: colors.card }]}>
            {activityDetailModal && (() => {
              const act = activityDetailModal;
              const linkedDest = act.destinationId ? destinations.find((d) => d.id === act.destinationId) : destinations.find((d) => d.name === act.title);
              const sampleReviews = linkedDest?.sampleReviews || [];

              return (
                <>
                  <View style={actDetailStyles.header}>
                    <Text style={[actDetailStyles.title, { color: colors.text }]} numberOfLines={2}>{act.title}</Text>
                    <Pressable onPress={() => setActivityDetailModal(null)} hitSlop={8}>
                      <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
                    <View style={[actDetailStyles.infoRow, { backgroundColor: colors.inputBg }]}>
                      <View style={actDetailStyles.infoItem}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={[actDetailStyles.infoText, { color: colors.text }]}>{act.time} • {act.duration}</Text>
                      </View>
                      <View style={actDetailStyles.infoItem}>
                        <Ionicons name={getActivityTypeIcon(act.activityType) as any} size={16} color={colors.primary} />
                        <Text style={[actDetailStyles.infoText, { color: colors.text }]}>{getActivityTypeLabel(act.activityType)}</Text>
                      </View>
                    </View>

                    {act.address && (
                      <View style={actDetailStyles.infoItem}>
                        <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                        <Text style={[actDetailStyles.addressText, { color: colors.textSecondary }]}>{act.address}</Text>
                      </View>
                    )}

                    <Text style={[actDetailStyles.sectionTitle, { color: colors.text }]}>{txt.activityAbout}</Text>
                    <Text style={[actDetailStyles.description, { color: colors.textSecondary }]}>
                      {linkedDest?.description || act.description}
                    </Text>

                    {linkedDest && (
                      <View style={[actDetailStyles.ratingBar, { backgroundColor: colors.inputBg }]}>
                        <Ionicons name="star" size={18} color="#F59E0B" />
                        <Text style={[actDetailStyles.ratingText, { color: colors.text }]}>
                          {linkedDest.rating.toFixed(1)}/5
                        </Text>
                        <Text style={[actDetailStyles.ratingCount, { color: colors.textSecondary }]}>
                          ({linkedDest.reviewCount} {txt.activityReviewCount})
                        </Text>
                        {linkedDest.priceRange && (
                          <>
                            <Text style={[actDetailStyles.ratingCount, { color: colors.textTertiary }]}> • </Text>
                            <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                            <Text style={[actDetailStyles.ratingCount, { color: colors.textSecondary }]}>{linkedDest.priceRange}</Text>
                          </>
                        )}
                      </View>
                    )}

                    {(() => {
                      const linkedPOI = act.poiId ? pois.find((p) => p.id === act.poiId) : null;
                      if (!linkedPOI) return null;
                      return (
                        <View style={[actDetailStyles.ratingBar, { backgroundColor: colors.inputBg, flexDirection: "column", alignItems: "flex-start", gap: 6 }]}>
                          <Text style={[actDetailStyles.sectionTitle, { color: colors.text, marginBottom: 2 }]}>{txt.poiInfo}</Text>
                          {linkedPOI.openHours && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name="time-outline" size={14} color={colors.primary} />
                              <Text style={[actDetailStyles.ratingCount, { color: colors.textSecondary }]}>{txt.openHours}: {linkedPOI.openHours}</Text>
                            </View>
                          )}
                          {linkedPOI.estimatedDuration && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name="hourglass-outline" size={14} color={colors.primary} />
                              <Text style={[actDetailStyles.ratingCount, { color: colors.textSecondary }]}>{txt.estDuration}: {linkedPOI.estimatedDuration}</Text>
                            </View>
                          )}
                          {linkedPOI.estimatedCost != null && linkedPOI.estimatedCost > 0 && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name="cash-outline" size={14} color={colors.primary} />
                              <Text style={[actDetailStyles.ratingCount, { color: colors.textSecondary }]}>{txt.estCost}: {formatVND(linkedPOI.estimatedCost)}</Text>
                            </View>
                          )}
                          {linkedPOI.rating > 0 && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name="star" size={14} color="#F59E0B" />
                              <Text style={[actDetailStyles.ratingCount, { color: colors.textSecondary }]}>{linkedPOI.rating.toFixed(1)} ({linkedPOI.reviewCount} {txt.activityReviewCount})</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {sampleReviews.length > 0 && (
                      <>
                        <Text style={[actDetailStyles.sectionTitle, { color: colors.text }]}>{txt.activityReviews}</Text>
                        {sampleReviews.map((review, idx) => (
                          <View key={idx} style={[actDetailStyles.reviewCard, { backgroundColor: colors.inputBg }]}>
                            <View style={actDetailStyles.reviewHeader}>
                              <View style={[actDetailStyles.reviewAvatar, { backgroundColor: review.source === "Google" ? "#4285F4" : "#34E0A1" }]}>
                                <Text style={actDetailStyles.reviewAvatarText}>{review.author.charAt(0).toUpperCase()}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[actDetailStyles.reviewName, { color: colors.text }]}>{review.author}</Text>
                                <View style={[actDetailStyles.sourceBadge, { backgroundColor: review.source === "Google" ? "#4285F420" : "#34E0A120" }]}>
                                  <Text style={[actDetailStyles.sourceText, { color: review.source === "Google" ? "#4285F4" : "#00AA6C" }]}>{review.source}</Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: "row", gap: 2 }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Ionicons key={star} name={star <= review.rating ? "star" : "star-outline"} size={12} color="#F59E0B" />
                                ))}
                              </View>
                            </View>
                            <Text style={[actDetailStyles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>
                          </View>
                        ))}
                      </>
                    )}

                    {(() => {
                      if (!linkedDest) return null;
                      const destUserReviews = reviews
                        .filter((r) => r.destinationId === linkedDest.id)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                      const formatReviewDate = (dateStr: string) => {
                        const d = new Date(dateStr);
                        return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
                      };

                      const cleanComment = (comment: string) => comment.replace(/\[activity:[^\]]+\]/g, "").trim();

                      return (
                        <>
                          <View style={userRevStyles.sectionHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[actDetailStyles.sectionTitle, { color: colors.text }]}>{txt.userReviewsForDest}</Text>
                            </View>
                            {destUserReviews.length > 0 && (
                              <View style={[userRevStyles.countBadge, { backgroundColor: colors.primary + "15" }]}>
                                <Text style={[userRevStyles.countText, { color: colors.primary }]}>{destUserReviews.length}</Text>
                              </View>
                            )}
                          </View>

                          {destUserReviews.length === 0 ? (
                            <View style={[userRevStyles.emptyState, { backgroundColor: colors.inputBg }]}>
                              <Ionicons name="chatbubbles-outline" size={28} color={colors.textTertiary} />
                              <Text style={[userRevStyles.emptyTitle, { color: colors.textSecondary }]}>{txt.noUserReviewsYet}</Text>
                              <Text style={[userRevStyles.emptyHint, { color: colors.textTertiary }]}>{txt.beFirstToReview}</Text>
                            </View>
                          ) : (
                            <>
                              {(showAllUserReviews ? destUserReviews : destUserReviews.slice(0, 5)).map((review) => {
                                const reviewColors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
                                let hash = 0;
                                for (let ci = 0; ci < review.userName.length; ci++) hash = ((hash << 5) - hash + review.userName.charCodeAt(ci)) | 0;
                                const avatarBg = reviewColors[Math.abs(hash) % reviewColors.length];
                                const commentText = cleanComment(review.comment);
                                const isCurrentUser = review.userId === user?.id;
                                const isExpanded = expandedReviewIds.has(review.id);
                                const COMMENT_LIMIT = 100;
                                const isLong = commentText.length > COMMENT_LIMIT;
                                const displayComment = isLong && !isExpanded ? commentText.slice(0, COMMENT_LIMIT).trimEnd() + "..." : commentText;

                                return (
                                  <View key={review.id} style={[userRevStyles.card, { backgroundColor: colors.inputBg, borderColor: isCurrentUser ? colors.primary + "30" : "transparent" }]}>
                                    <View style={userRevStyles.cardHeader}>
                                      <View style={[userRevStyles.avatar, { backgroundColor: avatarBg }]}>
                                        <Text style={userRevStyles.avatarText}>{review.userName.charAt(0).toUpperCase()}</Text>
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <View style={userRevStyles.nameRow}>
                                          <Text style={[userRevStyles.name, { color: colors.text }]}>{review.userName}</Text>
                                          {isCurrentUser && (
                                            <View style={[userRevStyles.youBadge, { backgroundColor: colors.primary + "15" }]}>
                                              <Text style={[userRevStyles.youBadgeText, { color: colors.primary }]}>{txt.you}</Text>
                                            </View>
                                          )}
                                        </View>
                                        <Text style={[userRevStyles.date, { color: colors.textTertiary }]}>{formatReviewDate(review.createdAt)}</Text>
                                      </View>
                                    </View>

                                    <View style={userRevStyles.ratingRow}>
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Ionicons key={star} name={star <= review.rating ? "star" : "star-outline"} size={14} color="#F59E0B" />
                                      ))}
                                      <Text style={[userRevStyles.ratingLabel, { color: colors.textSecondary }]}>
                                        {review.rating === 5 ? txt.ratingExcellent : review.rating === 4 ? txt.ratingVeryGood : review.rating === 3 ? txt.ratingGood : review.rating === 2 ? txt.ratingFair : txt.ratingPoor}
                                      </Text>
                                    </View>

                                    {commentText.length > 0 && (
                                      <View>
                                        <Text style={[userRevStyles.comment, { color: colors.textSecondary }]}>{displayComment}</Text>
                                        {isLong && (
                                          <Pressable
                                            onPress={() => {
                                              setExpandedReviewIds((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(review.id)) next.delete(review.id);
                                                else next.add(review.id);
                                                return next;
                                              });
                                            }}
                                            hitSlop={6}
                                          >
                                            <Text style={[userRevStyles.seeMoreText, { color: colors.primary }]}>
                                              {isExpanded ? txt.seeLess : txt.seeMore}
                                            </Text>
                                          </Pressable>
                                        )}
                                      </View>
                                    )}

                                    {isCurrentUser && (
                                      <View style={userRevStyles.actionRow}>
                                        <Pressable
                                          onPress={() => {
                                            setActivityDetailModal(null);
                                            setReviewRating(review.rating);
                                            setReviewComment(cleanComment(review.comment));
                                            const activityTag = review.comment.match(/\[activity:([^\]]+)\]/);
                                            setReviewModal({ activityId: activityTag ? activityTag[1] : "", dayIdx: 0, destinationId: review.destinationId, editReviewId: review.id });
                                          }}
                                          style={[userRevStyles.actionBtn, { backgroundColor: colors.primary + "10" }]}
                                        >
                                          <Ionicons name="create-outline" size={14} color={colors.primary} />
                                          <Text style={[userRevStyles.actionBtnText, { color: colors.primary }]}>{txt.editReview}</Text>
                                        </Pressable>
                                        <Pressable
                                          onPress={() => {
                                            const doDelete = () => deleteReview(review.id);
                                            if (typeof window !== "undefined" && window.confirm) {
                                              if (window.confirm(txt.deleteReviewConfirm)) doDelete();
                                            } else {
                                              Alert.alert(txt.deleteReview, txt.deleteReviewConfirm, [
                                                { text: t().common.cancel, style: "cancel" },
                                                { text: txt.deleteReview, style: "destructive", onPress: doDelete },
                                              ]);
                                            }
                                          }}
                                          style={[userRevStyles.actionBtn, { backgroundColor: colors.error + "10" }]}
                                        >
                                          <Ionicons name="trash-outline" size={14} color={colors.error} />
                                          <Text style={[userRevStyles.actionBtnText, { color: colors.error }]}>{txt.deleteReview}</Text>
                                        </Pressable>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}

                              {!showAllUserReviews && destUserReviews.length > 5 && (
                                <Pressable
                                  onPress={() => setShowAllUserReviews(true)}
                                  style={[userRevStyles.showMoreBtn, { backgroundColor: colors.inputBg }]}
                                >
                                  <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
                                  <Text style={[userRevStyles.showMoreText, { color: colors.primary }]}>
                                    {txt.moreReviews(destUserReviews.length - 5)}
                                  </Text>
                                  <Ionicons name="chevron-down" size={16} color={colors.primary} />
                                </Pressable>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}

                    {(act.latitude != null && act.longitude != null) && (
                      <Pressable
                        onPress={() => {
                          const query = linkedDest ? encodeURIComponent(linkedDest.name) : `${act.latitude},${act.longitude}`;
                          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
                        }}
                        style={({ pressed }) => [actDetailStyles.moreReviewsBtn, { backgroundColor: "#4285F4", opacity: pressed ? 0.9 : 1 }]}
                      >
                        <Ionicons name="logo-google" size={18} color="#fff" />
                        <Text style={actDetailStyles.moreReviewsBtnText}>{txt.activitySeeMoreReviews}</Text>
                      </Pressable>
                    )}

                    {(act.latitude != null && act.longitude != null) && (
                      <View style={actDetailStyles.deepLinkRow}>
                        <Pressable
                          onPress={() => openGoogleMaps(act.latitude, act.longitude, act.address)}
                          style={({ pressed }) => [actDetailStyles.deepLinkBtn, { backgroundColor: "#4285F4", opacity: pressed ? 0.9 : 1 }]}
                        >
                          <Ionicons name="map" size={16} color="#fff" />
                          <Text style={actDetailStyles.deepLinkText}>{txt.openMaps}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openGrab(act.latitude, act.longitude)}
                          style={({ pressed }) => [actDetailStyles.deepLinkBtn, { backgroundColor: "#00B14F", opacity: pressed ? 0.9 : 1 }]}
                        >
                          <Ionicons name="car" size={16} color="#fff" />
                          <Text style={actDetailStyles.deepLinkText}>{txt.bookGrab}</Text>
                        </Pressable>
                      </View>
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal visible={!!reviewModal} transparent animationType="fade" onRequestClose={() => setReviewModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {reviewModal?.editReviewId ? txt.editReview : txt.reviewActivity}
            </Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setReviewRating(star)} hitSlop={8}>
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={28}
                    color={star <= reviewRating ? "#F59E0B" : colors.textTertiary}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, minHeight: 80, textAlignVertical: "top" }]}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder={txt.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setReviewModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={submitActivityReview} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold" },
  headerActions: { flexDirection: "row", gap: 16 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 14 },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryItem: { flex: 1, gap: 4 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  budgetCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  budgetRow: { flexDirection: "row", gap: 8 },
  budgetItem: { flex: 1, gap: 2 },
  budgetLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  budgetAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  budgetEstimate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  statusRow: { flexDirection: "row" },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  prefRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  prefChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  prefChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tabBar: {
    flexDirection: "row",
    gap: 0,
    marginTop: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  dayCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayBadgeText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  dayTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  activitiesList: { gap: 8, marginTop: 8, marginBottom: 8 },
  activityCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  activityTop: { flexDirection: "row", gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  activityTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  activityTime: { fontSize: 13, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" as const },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  activityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activityDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  activityDuration: { fontSize: 11, fontFamily: "Inter_400Regular" },
  costRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 32 },
  costText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  paidByText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  notesContainer: { gap: 6, marginLeft: 32 },
  noteBox: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8 },
  noteText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  activityActions: { flexDirection: "row", gap: 6, paddingLeft: 32, flexWrap: "wrap" },
  reviewBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, padding: 10, marginTop: 6, marginLeft: 32 },
  reviewBoxHeader: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  reviewBoxRating: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reviewBoxComment: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, marginLeft: 4 },
  reviewBoxActions: { flexDirection: "row", gap: 10, marginLeft: 8 },
  ratingRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 },
  miniBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  addExpenseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addExpenseText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  expensesTab: { gap: 10 },
  emptyExpenses: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  expenseCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  expenseTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  expenseTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  expenseMeta: { flexDirection: "row", flexWrap: "wrap" },
  expenseMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  expenseAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  expenseActions: { flexDirection: "row", gap: 6, paddingLeft: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  modalSubLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  modalInput: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 44,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  typeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  splitLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  dropdownBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  dropdownList: { borderWidth: 1, borderRadius: 10, marginBottom: 8, overflow: "hidden" },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  dropdownItemText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  splitMemberList: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  splitMembersTitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  splitMemberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  splitMemberName: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  splitMemberAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  splitAmountInput: { width: 90, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "right" },
  splitWarning: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  splitDetails: { paddingLeft: 28, paddingTop: 4, gap: 2 },
  splitDetailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  splitDetailName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  splitDetailAmount: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  settlementCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 8 },
  settlementHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  settlementTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  settlementRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  settlementName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  settlementOwes: { fontSize: 12, fontFamily: "Inter_400Regular" },
  settlementAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginLeft: "auto" },
});

const travelStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 2,
  },
  lineWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 20,
    width: 2,
    alignItems: "center",
  },
  line: {
    width: 2,
    height: "100%",
    borderRadius: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginLeft: 12,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  modeList: {
    marginTop: 6,
    marginLeft: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    alignSelf: "stretch",
  },
  modeTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  modeValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  companionBar: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  companionBarAccent: {
    width: 4,
  },
  companionBarContent: {
    flex: 1,
    padding: 14,
    gap: 12,
  },
  companionBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  companionBarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  companionBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  companionBarBody: {
    gap: 10,
  },
  companionAvatars: { flexDirection: "row", alignItems: "center" },
  companionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
  },
  companionAvatarText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  companionNameChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  companionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  companionChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  companionChipText: { fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: 100 },
  companionChipRole: { fontSize: 11 },
  companionBarTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  companionBarCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  companionBarAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  companionBarActionText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

const actDetailStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  content: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  infoRow: { flexDirection: "row", gap: 16, padding: 12, borderRadius: 12 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  addressText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  ratingBar: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 12 },
  ratingText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ratingCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewCard: { borderRadius: 12, padding: 12, gap: 8 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reviewName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sourceBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  sourceText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  reviewComment: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  moreReviewsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  moreReviewsBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  deepLinkRow: { flexDirection: "row", gap: 10 },
  deepLinkBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  deepLinkText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const invStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  permToggle: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  permBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  permBtnActive: {
    elevation: 3,
  },
  permBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  copyLinkBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  copyLinkInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  copyLinkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  copyLinkTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  copyLinkSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  manageBtnLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  manageBtnAvatars: { flexDirection: "row" },
  manageBtnAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  manageBtnAvatarText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  manageBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  compSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  compSummaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  compSummaryText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  compAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  compAvatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  compName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  compRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  roleToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  roleToggleText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

const userRevStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyState: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
    borderRadius: 14,
  },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  youBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginLeft: 4 },
  comment: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  seeMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  showMoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
