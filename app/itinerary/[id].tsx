import React, { useState, useMemo } from "react";
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
import { formatVND, generateId } from "@/lib/storage";
import { t } from "@/lib/i18n";
import type { ItineraryActivity, Expense, TripCompanion } from "@/lib/storage";

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
  const { itineraries, updateItinerary, deleteItinerary, addNotification } = useData();

  const itinerary = itineraries.find((i) => i.id === id);
  const [activeTab, setActiveTab] = useState<"itinerary" | "expenses">("itinerary");
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [noteModal, setNoteModal] = useState<{ activityId: string; dayIdx: number; note: string; editIndex?: number } | null>(null);
  const [costModal, setCostModal] = useState<{ activityId: string; dayIdx: number; cost: string; paidBy: string } | null>(null);
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
  const [expenseNoteModal, setExpenseNoteModal] = useState<{ expenseId: string; note: string; editIndex?: number } | null>(null);

  const [editBudget, setEditBudget] = useState("");
  const [editNumPeople, setEditNumPeople] = useState("");

  const [shareModal, setShareModal] = useState(false);
  const [companionModal, setCompanionModal] = useState(false);
  const [sharePermission, setSharePermission] = useState<"editor" | "viewer">("viewer");

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

  if (!itinerary) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>{t().itinerary.notFound}</Text>
      </View>
    );
  }

  const isOwner = user?.id === itinerary.userId;
  const companions = itinerary.companions || [];
  const myCompanion = companions.find((c) => c.userId === user?.id);
  const isCompanion = !!myCompanion;
  const canEdit = isOwner || (myCompanion?.role === "editor");

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
    const domain = process.env.EXPO_PUBLIC_DOMAIN || "localhost:8081";
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

  const handleRemoveCompanion = (companion: TripCompanion) => {
    const doRemove = async () => {
      const updated = companions.filter((c) => c.userId !== companion.userId);
      await updateItinerary(itinerary.id, { companions: updated });
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
      await Share.share({ message, title: itinerary.title });
      await updateItinerary(itinerary.id, { isShared: true });
    } catch (e) {
      console.log(e);
    }
  };

  const handleStatusChange = () => {
    const nextStatus = itinerary.status === "draft" ? "active" : itinerary.status === "active" ? "completed" : "draft";
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

  const toggleActivityComplete = async (dayIdx: number, activityId: string) => {
    const newDays = [...itinerary.days];
    const activity = newDays[dayIdx].activities.find((a) => a.id === activityId);
    if (activity) {
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
      const newCost = parseInt(costModal.cost.replace(/[^0-9]/g, ""), 10) || 0;
      activity.actualCost = newCost;
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

  const addOrEditExpense = async () => {
    if (!expenseModal || !expenseTitle.trim() || !expenseAmount.trim()) return;
    const amount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
    if (amount <= 0) return;

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
        };
      }
    } else {
      newExpenses.push({
        id: generateId(),
        title: expenseTitle.trim(),
        amount,
        type: expenseType,
        paidBy: expensePaidBy.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    const newSpent = recalcSpent(itinerary.days, newExpenses);
    await updateItinerary(itinerary.id, { expenses: newExpenses, spentAmount: newSpent });

    if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
      await addNotification({ userId: itinerary.userId, title: t().notifications.budgetWarning, message: t().notifications.budgetExceeded(formatVND(itinerary.totalBudget - newSpent)), type: "warning" });
    }

    setExpenseTitle("");
    setExpenseAmount("");
    setExpensePaidBy("");
    setExpenseType("transport");
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
        <Pressable onPress={() => router.back()}>
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

        {companions.length > 0 && (
          <Pressable
            style={[styles.companionBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => setCompanionModal(true)}
          >
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={[styles.companionBarText, { color: colors.text }]}>
              {txt.companions}: {companions.length}
            </Text>
            <View style={styles.companionAvatars}>
              {companions.slice(0, 4).map((c, i) => (
                <View key={c.userId} style={[styles.companionAvatar, { backgroundColor: colors.primary, marginLeft: i > 0 ? -8 : 0 }]}>
                  <Text style={styles.companionAvatarText}>{c.userName.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
              {companions.length > 4 && (
                <View style={[styles.companionAvatar, { backgroundColor: colors.textSecondary, marginLeft: -8 }]}>
                  <Text style={styles.companionAvatarText}>+{companions.length - 4}</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        )}

        {itinerary.totalBudget > 0 && (
          <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.budgetHeader}>
              <Text style={[styles.budgetTitle, { color: colors.text }]}>{txt.budgetProgress}</Text>
              {canEdit && (
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

                {expandedDay === dayIdx && (
                  <View style={styles.activitiesList}>
                    {day.activities.map((activity, actIdx) => (
                      <React.Fragment key={activity.id}>
                        {actIdx > 0 && (
                          <TravelConnector from={day.activities[actIdx - 1]} to={activity} colors={colors} />
                        )}
                        <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: activity.isCompleted ? colors.success + "50" : colors.cardBorder }]}>
                          <View style={styles.activityTop}>
                            <Pressable
                              onPress={() => { if (canEdit) toggleActivityComplete(dayIdx, activity.id); }}
                              style={[styles.checkbox, { borderColor: activity.isCompleted ? colors.success : colors.textTertiary, backgroundColor: activity.isCompleted ? colors.success : "transparent" }]}
                            >
                              {activity.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </Pressable>
                            <View style={{ flex: 1 }}>
                              <View style={styles.activityTitleRow}>
                                <Pressable onPress={() => { if (canEdit) setTimeModal({ activityId: activity.id, dayIdx, time: activity.time }); }}>
                                  <Text style={[styles.activityTime, { color: colors.primary, textDecorationLine: canEdit ? "underline" : "none" }]}>{activity.time}</Text>
                                </Pressable>
                                <View style={[styles.typeBadge, { backgroundColor: colors.tagBg }]}>
                                  <Ionicons name={getActivityTypeIcon(activity.activityType) as any} size={12} color={colors.tagText} />
                                  <Text style={[styles.typeText, { color: colors.tagText }]}>{getActivityTypeLabel(activity.activityType)}</Text>
                                </View>
                              </View>
                              <Text style={[styles.activityTitle, { color: colors.text, textDecorationLine: activity.isCompleted ? "line-through" : "none" }]}>
                                {activity.title}
                              </Text>
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
                            {canEdit && (
                              <Pressable onPress={() => setNoteModal({ activityId: activity.id, dayIdx, note: "" })} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                              </Pressable>
                            )}
                            {canEdit && (
                              <Pressable onPress={() => setCostModal({ activityId: activity.id, dayIdx, cost: (activity.actualCost || activity.estimatedCost || 0).toString(), paidBy: activity.paidBy || "" })} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="cash-outline" size={14} color={colors.accent} />
                              </Pressable>
                            )}
                            {canEdit && (
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
                            {canEdit && actIdx > 0 && (
                              <Pressable onPress={() => moveActivity(dayIdx, actIdx, "up")} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="arrow-up" size={14} color={colors.textSecondary} />
                              </Pressable>
                            )}
                            {canEdit && actIdx < day.activities.length - 1 && (
                              <Pressable onPress={() => moveActivity(dayIdx, actIdx, "down")} style={[styles.miniBtn, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="arrow-down" size={14} color={colors.textSecondary} />
                              </Pressable>
                            )}
                            {canEdit && (
                              <Pressable onPress={() => deleteActivity(dayIdx, activity.id)} style={[styles.miniBtn, { backgroundColor: colors.error + "15" }]}>
                                <Ionicons name="trash-outline" size={14} color={colors.error} />
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </React.Fragment>
                    ))}

                    {canEdit && (
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
                  </View>
                )}
              </View>
            ))}
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
                      </View>
                    </View>
                    <Text style={[styles.expenseAmount, { color: colors.text }]}>{formatVND(expense.amount)}</Text>
                  </View>

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
                      <Pressable onPress={() => deleteExpense(expense.id)} style={[styles.miniBtn, { backgroundColor: colors.error + "15" }]}>
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}

            {canEdit && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpenseTitle("");
                  setExpenseAmount("");
                  setExpensePaidBy("");
                  setExpenseType("transport");
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.actualCost}</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={costModal?.cost || ""}
              onChangeText={(v) => costModal && setCostModal({ ...costModal, cost: v })}
              placeholder="VD: 500000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
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
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.addPlace}</Text>
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
          </View>
        </View>
      </Modal>

      <Modal visible={!!expenseModal} transparent animationType="fade" onRequestClose={() => setExpenseModal(null)}>
        <View style={styles.modalOverlay}>
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
            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={expensePaidBy}
              onChangeText={setExpensePaidBy}
              placeholder={txt.paidBy}
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setExpenseModal(null)} style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable onPress={addOrEditExpense} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{expenseModal?.editId ? t().common.save : t().common.add}</Text>
              </Pressable>
            </View>
          </View>
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

      <Modal visible={shareModal} transparent animationType="fade" onRequestClose={() => setShareModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.inviteCompanion}</Text>

            <View style={styles.permToggle}>
              <Pressable
                style={[styles.permBtn, sharePermission === "editor" && { backgroundColor: colors.primary }]}
                onPress={() => setSharePermission("editor")}
              >
                <Text style={[styles.permBtnText, { color: sharePermission === "editor" ? "#fff" : colors.text }]}>
                  {txt.canEdit}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.permBtn, sharePermission === "viewer" && { backgroundColor: colors.primary }]}
                onPress={() => setSharePermission("viewer")}
              >
                <Text style={[styles.permBtnText, { color: sharePermission === "viewer" ? "#fff" : colors.text }]}>
                  {txt.viewOnly}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.shareLinkBtn, { backgroundColor: colors.primary }]}
              onPress={handleGenerateLink}
            >
              <Ionicons name="link-outline" size={20} color="#fff" />
              <Text style={styles.shareLinkBtnText}>{txt.copyLink}</Text>
            </Pressable>

            {companions.length > 0 && (
              <Pressable
                style={[styles.manageCompBtn, { borderColor: colors.cardBorder }]}
                onPress={() => { setShareModal(false); setCompanionModal(true); }}
              >
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <Text style={[styles.manageCompBtnText, { color: colors.text }]}>
                  {txt.manageCompanions} ({companions.length})
                </Text>
              </Pressable>
            )}

            <Pressable onPress={() => setShareModal(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t().common.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={companionModal} transparent animationType="fade" onRequestClose={() => setCompanionModal(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCompanionModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "70%" }]}>
            <View style={styles.compModalHeader}>
              <Pressable onPress={() => setCompanionModal(false)}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text, flex: 1, marginLeft: 12 }]}>{txt.manageCompanions}</Text>
            </View>

            <Text style={[styles.compCount, { color: colors.textSecondary }]}>
              {companions.length} {txt.companions.toLowerCase()}
            </Text>

            <ScrollView style={styles.compList} showsVerticalScrollIndicator={false}>
              {companions.map((c) => (
                <View key={c.userId} style={[styles.compRow, { borderColor: colors.cardBorder }]}>
                  <View style={[styles.compAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.compAvatarText}>{c.userName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.compInfo}>
                    <Text style={[styles.compName, { color: colors.text }]}>{c.userName}</Text>
                    <Text style={[styles.compRole, { color: colors.textSecondary }]}>
                      {c.role === "editor" ? txt.editor : txt.viewer}
                    </Text>
                  </View>
                  {isOwner && (
                    <Pressable onPress={() => handleRemoveCompanion(c)} hitSlop={8}>
                      <Ionicons name="close" size={22} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
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
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  companionBarText: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  companionAvatars: { flexDirection: "row" },
  companionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  companionAvatarText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  permToggle: {
    flexDirection: "row",
    gap: 0,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  permBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  permBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  shareLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareLinkBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  manageCompBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  manageCompBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  compModalHeader: { flexDirection: "row", alignItems: "center" },
  compCount: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  compList: { gap: 0 },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  compAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  compAvatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  compInfo: { flex: 1, gap: 2 },
  compName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  compRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
