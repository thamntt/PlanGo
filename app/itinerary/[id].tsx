import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTrips,
  useUpdateTrip,
  useDeleteTrip,
  useDestinations,
  useReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
  usePois,
  usePoiTypes,
  useExpenseTypes,
  useCreateNotification,
  useSendInvitation,
  useSentInvitations,
  useCancelInvitation,
  useTripTasks,
  useCreateTripTask,
  useUpdateTripTask,
  useDeleteTripTask,
  useClearCompletedTasks,
  queryKeys,
} from "@/hooks/queries";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Skeleton } from "@/components/Skeleton";
import { TasksTab } from "@/features/itinerary/components/TasksTab";
import { TaskDueDatePicker } from "@/features/itinerary/components/TaskDueDatePicker";

/**
 * Parse a startDate from either ISO (yyyy-mm-dd) or VN (dd-mm-yyyy) format.
 * The BE returns ISO; some legacy code paths use the VN display form. Doing
 * `s.split("-")` and assuming dd-mm-yyyy silently produced garbage end dates
 * when the input was actually yyyy-mm-dd — fixed here.
 */
function parseTripStartDate(raw: string | undefined | null): Date {
  if (!raw) return new Date(NaN);
  // ISO yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS — extract first 10 chars.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  // VN dd-mm-yyyy or dd/mm/yyyy
  const vn = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (vn) return new Date(parseInt(vn[3]), parseInt(vn[2]) - 1, parseInt(vn[1]));
  return new Date(raw);
}

function formatDateVN(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getFullYear()}`;
}

/**
 * Stable per-user color used wherever we don't have a real avatar. Matches
 * the palette used by other surfaces (notifications, companions) so the
 * "person color" stays consistent across screens.
 */
const TASK_AVATAR_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];
function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return TASK_AVATAR_COLORS[Math.abs(hash) % TASK_AVATAR_COLORS.length];
}
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import type {
  ItineraryActivity,
  Review,
  Notification,
  POI,
  DestinationType,
  ExpenseType,
  Expense,
  ExpenseSplit,
  TripCompanion,
} from "@/types";
import { generateId, formatVND, formatVNDCompact } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useConfirm } from "@/contexts/ConfirmContext";
import { getApiUrl, getApiHeaders, apiRequest } from "@/lib/api/query-client";
import RouteMap from "@/components/RouteMap";
import { Swipeable } from "react-native-gesture-handler";
import {
  getStatusLabel,
  getActivityTypeLabel,
  getActivityTypeIcon,
  getTravelInfo,
  haversineDistance,
  parseTimeToMinutes,
  formatTimeInput,
  sortActivitiesByTime,
  minutesToTime,
  parseDurationToMinutes,
  formatDuration,
} from "@/features/itinerary/lib/utils";
import { TravelConnector } from "@/features/itinerary/components/TravelConnector";

export default function ItineraryDetailScreen() {
  const { id, initialTab, action, autoStatus } = useLocalSearchParams<{
    id: string;
    initialTab?: string;
    action?: string;
    autoStatus?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const { confirm } = useConfirm();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const qc = useQueryClient();
  const tripsQuery = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const { data: itineraries = [] } = tripsQuery;
  const { data: destinations = [] } = useDestinations();
  const { data: reviews = [] } = useReviews();
  const { data: pois = [] } = usePois();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: poiTypes = [] } = usePoiTypes();
  const updateTripMut = useUpdateTrip();
  const deleteTripMut = useDeleteTrip();
  const createReviewMut = useCreateReview();
  const updateReviewMut = useUpdateReview();
  const deleteReviewMut = useDeleteReview();
  const createNotifMut = useCreateNotification();

  const updateItinerary = useCallback(
    (tripId: string, data: any) => updateTripMut.mutateAsync({ id: tripId, data }),
    [updateTripMut],
  );
  const deleteItinerary = useCallback(
    (tripId: string) => deleteTripMut.mutateAsync(tripId),
    [deleteTripMut],
  );
  const addNotification = useCallback(
    (input: any) => createNotifMut.mutateAsync(input),
    [createNotifMut],
  );
  const addReview = useCallback(
    (input: any) => createReviewMut.mutateAsync(input),
    [createReviewMut],
  );
  const updateReview = useCallback(
    (reviewId: string, data: any) =>
      updateReviewMut.mutateAsync({
        id: reviewId,
        data: { type: data.poiId || data.activityId ? "item" : "trip", ...data },
      }),
    [updateReviewMut],
  );
  const deleteReview = useCallback(
    (reviewId: string, params?: { userId: string | number; type?: string }) =>
      deleteReviewMut.mutateAsync({
        id: reviewId,
        userId: params?.userId ?? user?.id ?? "",
        type: (params?.type as "trip" | "item") ?? "trip",
      }),
    [deleteReviewMut, user?.id],
  );
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.trips() }),
      qc.invalidateQueries({ queryKey: queryKeys.destinations() }),
      qc.invalidateQueries({ queryKey: queryKeys.reviews() }),
      qc.invalidateQueries({ queryKey: queryKeys.pois() }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const itinerary = itineraries.find((i) => i.id === id);
  // Trip-level checklist (Wanderlog-style). Only fetches once the trip id is
  // resolved so we don't fire `/api/trips/undefined/tasks` on first render.
  const tasksQuery = useTripTasks(itinerary?.id);
  const tasks = tasksQuery.data ?? [];
  const createTaskMut = useCreateTripTask(itinerary?.id || "");
  const updateTaskMut = useUpdateTripTask(itinerary?.id || "");
  const deleteTaskMut = useDeleteTripTask(itinerary?.id || "");
  const clearCompletedTasksMut = useClearCompletedTasks(itinerary?.id || "");
  // Invitations sent for this trip — used by the invite popup to surface
  // "Đã mời" with accept/decline status of each invitee.
  const sentInvitesQuery = useSentInvitations(itinerary?.id);
  const sentInvitations = sentInvitesQuery.data ?? [];
  const sendInvitationMut = useSendInvitation(itinerary?.id || "");
  const cancelInvitationMut = useCancelInvitation(itinerary?.id);
  const [activeTab, setActiveTab] = useState<
    "itinerary" | "expenses" | "companions" | "tasks"
  >(
    initialTab === "expenses" ||
      initialTab === "companions" ||
      initialTab === "tasks"
      ? (initialTab as any)
      : "itinerary",
  );
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const activitySwipeRefs = React.useRef<Record<string, Swipeable | null>>({});
  const toggleDayCollapsed = useCallback((idx: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // When the inviter is sitting on the Companions tab, poll every 8s so a
  // joiner appears within a few seconds without the inviter having to F5.
  // We only poll on that tab (not always) to keep battery + bandwidth bounded.
  useEffect(() => {
    if (activeTab !== "companions") return;
    const interval = setInterval(() => {
      tripsQuery.refetch();
    }, 8000);
    return () => clearInterval(interval);
  }, [activeTab, tripsQuery]);

  const [noteModal, setNoteModal] = useState<{
    activityId: string;
    dayIdx: number;
    note: string;
    editIndex?: number;
  } | null>(null);
  const [costModal, setCostModal] = useState<{
    activityId: string;
    dayIdx: number;
    cost: string;
    estimatedCost: string;
    paidBy: string;
    activityTitle: string;
    type: string;
    expenseTypeId?: string | number;
  } | null>(null);
  const [costPaidByDropdown, setCostPaidByDropdown] = useState(false);
  const [costSplitType, setCostSplitType] = useState<"none" | "equal" | "custom">("none");
  const [costSplitChecked, setCostSplitChecked] = useState<Record<string, boolean>>({});
  const [costSplitAmounts, setCostSplitAmounts] = useState<Record<string, string>>({});
  const [timeModal, setTimeModal] = useState<{
    activityId: string;
    dayIdx: number;
    time: string;
  } | null>(null);
  const [addPlaceModal, setAddPlaceModal] = useState<{ dayIdx: number } | null>(null);
  const [editInfoModal, setEditInfoModal] = useState(false);

  const [placeTitle, setPlaceTitle] = useState("");
  const [placeDuration, setPlaceDuration] = useState("1 giờ");
  const [placeCost, setPlaceCost] = useState("");
  const [placeType, setPlaceType] = useState<
    "sightseeing" | "food" | "transport" | "shopping" | "other"
  >("sightseeing");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeDestinationId, setPlaceDestinationId] = useState("");
  const [placeExpenseTypeId, setPlaceExpenseTypeId] = useState<string | number | undefined>(
    undefined,
  );
  const [placePoiTypeId, setPlacePoiTypeId] = useState<string>("");

  const [expenseModal, setExpenseModal] = useState<{ editId?: string } | null>(null);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseType, setExpenseType] = useState<
    "transport" | "shopping" | "food" | "sightseeing" | "other"
  >("transport");
  const [expenseTypeId, setExpenseTypeId] = useState<string | number | undefined>(undefined);
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expensePaidByUserId, setExpensePaidByUserId] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState<"none" | "equal" | "custom">("none");
  const [expenseSplitChecked, setExpenseSplitChecked] = useState<Record<string, boolean>>({});
  const [expenseSplitAmounts, setExpenseSplitAmounts] = useState<Record<string, string>>({});
  const [paidByDropdown, setPaidByDropdown] = useState(false);
  const [expenseNoteModal, setExpenseNoteModal] = useState<{
    expenseId: string;
    note: string;
    editIndex?: number;
  } | null>(null);

  const [editBudget, setEditBudget] = useState("");
  const [editNumPeople, setEditNumPeople] = useState("");

  // Open the invite modal on the FIRST render when the URL param requests
  // it. Doing this in initial state (not in a useEffect) means the modal
  // shows up while the navigation animation is still playing — feels
  // ~150ms faster than waiting for mount + effect tick.
  const [shareModal, setShareModal] = useState(action === "invite");
  // When the trips long-press menu sends us here with `autoStatus`, fire the
  // status-change flow once the trip data is loaded. Used by "Bắt đầu" /
  // "Đánh dấu hoàn thành" / "Khởi tạo lại" from the trip card menu so the
  // user doesn't have to scroll down to the status pill.
  const autoStatusFiredRef = React.useRef(false);
  const handleStatusChangeRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    if (!autoStatus || autoStatusFiredRef.current) return;
    if (!itinerary) return;
    if (itinerary.status === autoStatus) {
      autoStatusFiredRef.current = true;
      return;
    }
    autoStatusFiredRef.current = true;
    const t = setTimeout(() => {
      handleStatusChangeRef.current?.();
    }, 250);
    return () => clearTimeout(t);
  }, [autoStatus, itinerary?.status]);
  // ── Tasks state ──
  const [taskFilter, setTaskFilter] = useState<"all" | "open" | "done">("open");
  const [taskModal, setTaskModal] = useState<{
    editId?: string;
    title: string;
    description: string;
    category: "prep" | "during" | "after" | "";
    assigneeUserId: string;
    dueDate: string; // yyyy-mm-dd
  } | null>(null);
  const [taskAssigneeDropdown, setTaskAssigneeDropdown] = useState(false);
  // Invite by username — calls /api/users/search + /api/trips/:id/invite-member
  // (BE endpoints added in #135). Owner-only, direct add as viewer/editor.
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<
    { userId: string; userName: string; fullName: string; avatarUrl?: string | null }[]
  >([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteBusyUserId, setInviteBusyUserId] = useState<string | null>(null);
  // Inline toast inside the share modal — Alert.alert can be hidden behind
  // the bottom-sheet on some platforms so the user sees no feedback.
  const [inviteToast, setInviteToast] = useState<{
    kind: "success" | "info" | "error";
    text: string;
  } | null>(null);
  // Local session list of people we've already invited from this device, so
  // the user can see "Đã mời" until the proper invitation backend ships.
  const [sessionInvitedIds, setSessionInvitedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [companionModal, setCompanionModal] = useState(false);
  const [sharePermission, setSharePermission] = useState<"editor" | "viewer">("viewer");
  const [activityDetailModal, setActivityDetailModal] = useState<ItineraryActivity | null>(null);
  const [activityHeroIdx, setActivityHeroIdx] = useState(0);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(new Set());
  const [showAllUserReviews, setShowAllUserReviews] = useState(false);
  const [reviewModal, setReviewModal] = useState<{
    activityId: string;
    dayIdx: number;
    destinationId?: string;
    activityTitle?: string;
    editReviewId?: string;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [routeMapModal, setRouteMapModal] = useState<{ dayIdx: number } | null>(null);
  const [activityMenu, setActivityMenu] = useState<{
    activity: ItineraryActivity;
    dayIdx: number;
    actIdx: number;
    total: number;
  } | null>(null);
  const [expenseSubtab, setExpenseSubtab] = useState<"overview" | "balance">(
    "overview",
  );
  const [memberMenu, setMemberMenu] = useState<{
    companion: TripCompanion;
    member: { userId: string; userName: string; isOwner: boolean };
  } | null>(null);
  const [expenseMenu, setExpenseMenu] = useState<Expense | null>(null);
  const [addPlaceTab, setAddPlaceTab] = useState<"system" | "manual">("system");
  const [poiSearch, setPoiSearch] = useState("");
  const [externalSearchResults, setExternalSearchResults] = useState<
    {
      placeId?: string;
      name: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      rating?: number;
      reviewCount?: number;
      source?: string;
    }[]
  >([]);
  const [externalSearchLoading, setExternalSearchLoading] = useState(false);
  const [poiDestFilter, setPoiDestFilter] = useState("");

  // Inline editing state for expense summary table
  const [editingSummaryRow, setEditingSummaryRow] = useState<{
    dayIdx: number;
    actId: string;
    cost: string;
    paidBy: string;
  } | null>(null);
  const [summaryPaidByDropdown, setSummaryPaidByDropdown] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState<Record<string, boolean>>({
    budget: false,
    activities: true,
    expenses: true,
    category: false,
    payer: false,
  });

  // SerpAPI reviews state
  const [serpReviews, setSerpReviews] = useState<any[]>([]);
  const [serpNextToken, setSerpNextToken] = useState<string | null>(null);
  const [serpLoading, setSerpLoading] = useState(false);
  const [serpError, setSerpError] = useState(false);
  const [serpPlaceId, setSerpPlaceId] = useState<string | null>(null);
  const [serpPlaceInfo, setSerpPlaceInfo] = useState<any>(null);

  const totalEstimated = useMemo(() => {
    if (!itinerary) return 0;
    return itinerary.days.reduce(
      (sum, day) => sum + day.activities.reduce((s, a) => s + (a.estimatedCost || 0), 0),
      0,
    );
  }, [itinerary?.days]);

  const totalSpent = useMemo(() => {
    if (!itinerary) return 0;
    const activitySpent = itinerary.days.reduce(
      (sum, day) => sum + day.activities.reduce((s, a) => s + (a.actualCost || 0), 0),
      0,
    );
    // Only count manual expenses (not activity-linked ones, which are already in actualCost)
    const manualExpenses = (itinerary.expenses || []).filter((e) => !e.activityId);
    const expenseSpent = manualExpenses.reduce((sum, e) => sum + e.amount, 0);
    return activitySpent + expenseSpent;
  }, [itinerary?.days, itinerary?.expenses]);

  const isOwner = String(user?.id) === String(itinerary?.userId ?? "");
  const companions = itinerary?.companions || [];
  const myCompanion = companions.find((c) => String(c.userId) === String(user?.id));
  // Treat the viewer as a companion when (a) they appear in the companions
  // list, OR (b) the trip showed up in their list at all and they aren't
  // the owner. Catches the case where the BE companions array briefly
  // misses the viewer (race during refetch / mapper drop) — without (b)
  // the "Rời chuyến đi" button would disappear and the user would be
  // stranded in a trip with no way to leave.
  const isCompanion = !!myCompanion || (!isOwner && !!itinerary);
  const canShare = isOwner || isCompanion;
  const canShareAsEditor = isOwner || myCompanion?.role === "editor";
  const canEdit = isOwner || myCompanion?.role === "editor";

  const [ownerName, setOwnerName] = useState("");
  useEffect(() => {
    if (!itinerary) return;
    if (isOwner && user) {
      setOwnerName(user.fullName);
    } else {
      apiRequest("GET", "/api/users")
        .then((res) => res.json())
        .then((payload: any) => {
          // BE wraps responses in `{status, message, data: [...] }` — read
          // .data if present, otherwise treat payload as the array.
          const users: any[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
          const owner = users.find(
            (u: any) =>
              String(u.userId ?? u.id) === String(itinerary.userId),
          );
          if (owner) setOwnerName(owner.fullName || owner.full_name || "");
        })
        .catch(() => {});
    }
  }, [isOwner, user, itinerary?.userId]);

  // Sync companions from server for shared trips
  useEffect(() => {
    if (!itinerary?.shareCode || !itinerary?.isShared) return;
    const syncCompanions = async () => {
      try {
        const baseUrl = getApiUrl().replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/api/share/${itinerary.shareCode}`, {
          headers: getApiHeaders(),
        });
        if (!res.ok) {
          // Server lost data (e.g. restart) — re-push if we are the owner
          if (res.status === 404 && isOwner) {
            await fetch(`${baseUrl}/api/share`, {
              method: "POST",
              headers: { ...getApiHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ shareCode: itinerary.shareCode, itinerary }),
            });
          }
          return;
        }
        const serverTrip = await res.json();
        const serverCompanions = serverTrip.companions || [];
        const localCompanions = itinerary.companions || [];
        // Check if server has different companions (new, removed, or role changed)
        const hasChanges =
          serverCompanions.length !== localCompanions.length ||
          serverCompanions.some((sc: any) => {
            const lc = localCompanions.find((l) => l.userId === sc.userId);
            return !lc || lc.role !== sc.role;
          }) ||
          localCompanions.some(
            (lc) => !serverCompanions.some((sc: any) => sc.userId === lc.userId),
          );
        if (hasChanges) {
          await updateItinerary(itinerary.id, { companions: serverCompanions });
        }
      } catch (e) {
        /* silent fail */
      }
    };
    syncCompanions();
  }, [itinerary?.shareCode, itinerary?.isShared]);

  const tripMembers = useMemo(() => {
    const members: {
      userId: string;
      userName: string;
      isOwner: boolean;
      avatarUrl?: string | null;
    }[] = [];
    if (itinerary) {
      const name = itinerary.ownerName || ownerName || itinerary.userId;
      const ownerCompanion = (companions || []).find(
        (c) => String(c.userId) === String(itinerary.userId),
      );
      members.push({
        userId: itinerary.userId,
        userName: name,
        isOwner: true,
        avatarUrl: (ownerCompanion as any)?.avatarUrl || null,
      });
    }
    for (const c of companions) {
      if (!members.find((m) => m.userId === c.userId)) {
        members.push({
          userId: c.userId,
          userName: c.userName,
          isOwner: false,
          avatarUrl: (c as any).avatarUrl || null,
        });
      }
    }
    return members;
  }, [ownerName, itinerary?.userId, itinerary?.ownerName, companions]);

  // SerpAPI reviews fetch function
  const fetchSerpReviews = async (placeId?: string, query?: string, nextToken?: string) => {
    if (!placeId && !query) return;
    setSerpLoading(true);
    setSerpError(false);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const params = new URLSearchParams();
      if (placeId) params.set("place_id", placeId);
      if (query) params.set(placeId ? "fallback_q" : "q", query);
      if (nextToken) params.set("next_page_token", nextToken);

      const res = await fetch(`${baseUrl}/api/places/reviews?${params.toString()}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (nextToken) {
        setSerpReviews((prev) => [...prev, ...(data.reviews || [])]);
      } else {
        setSerpReviews(data.reviews || []);
        setSerpPlaceInfo(data.placeInfo || null);
      }
      setSerpNextToken(data.nextPageToken || null);
    } catch (err) {
      console.warn("SerpAPI reviews error:", err);
      setSerpError(true);
    } finally {
      setSerpLoading(false);
    }
  };

  // Auto-fetch SerpAPI reviews when activity detail modal opens
  useEffect(() => {
    if (!activityDetailModal) {
      setSerpReviews([]);
      setSerpNextToken(null);
      setSerpPlaceId(null);
      setSerpPlaceInfo(null);
      setSerpError(false);
      return;
    }
    const act = activityDetailModal;
    // Find googlePlaceId: activity (from SerpAPI enrichment) → POI → destination
    let gPlaceId: string | undefined;
    // Priority 1: Activity's own googlePlaceId (from SerpAPI enrichment)
    if (act.googlePlaceId) {
      gPlaceId = act.googlePlaceId;
    }
    // Priority 2: Linked POI
    if (!gPlaceId && act.poiId) {
      const linkedPOI = pois.find((p) => p.id === act.poiId);
      gPlaceId = linkedPOI?.googlePlaceId;
    }
    // Priority 3: Linked destination
    if (!gPlaceId && act.destinationId) {
      const linkedDest = destinations.find((d) => d.id === act.destinationId);
      gPlaceId = linkedDest?.googlePlaceId;
    }
    // Priority 4: Fallback — find destination by name
    const fallbackQuery = [act.title, act.address].filter(Boolean).join(", ");
    if (gPlaceId && gPlaceId !== serpPlaceId) {
      setSerpPlaceId(gPlaceId);
      fetchSerpReviews(gPlaceId, fallbackQuery);
    } else if (!gPlaceId && fallbackQuery) {
      setSerpPlaceId(null);
      fetchSerpReviews(undefined, fallbackQuery);
    } else if (!gPlaceId) {
      setSerpPlaceId(null);
    }
  }, [activityDetailModal]);

  const activityHeroImages = useMemo<string[]>(() => {
    const act = activityDetailModal;
    if (!act) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    const push = (url?: string | null) => {
      if (!url || seen.has(url) || result.length >= 3) return;
      seen.add(url);
      result.push(url);
    };
    const linkedPOI = act.poiId ? pois.find((p) => p.id === act.poiId) : null;
    const linkedDest = act.destinationId
      ? destinations.find((d) => d.id === act.destinationId)
      : destinations.find((d) => d.name === act.title);
    push(act.thumbnail);
    linkedPOI?.images?.slice(0, 3).forEach(push);
    linkedDest?.images?.slice(0, 3).forEach(push);
    return result;
  }, [activityDetailModal, pois, destinations]);

  useEffect(() => {
    setActivityHeroIdx(0);
    if (activityHeroImages.length < 2) return;
    const id = setInterval(() => {
      setActivityHeroIdx((i) => (i + 1) % activityHeroImages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [activityHeroImages.length, activityDetailModal?.id]);

  const filteredPOIs = useMemo(() => {
    let filtered = pois.filter((p) => p.isActive);
    if (poiDestFilter) {
      filtered = filtered.filter((p) => p.destinationId === poiDestFilter);
    }
    if (poiSearch.trim()) {
      const q = poiSearch.toLowerCase().trim();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
      );
    }
    return filtered.slice(0, 20);
  }, [pois, poiSearch, poiDestFilter]);

  // Debounced username search for the invite picker. Runs only when the share
  // modal is open AND the user is the owner — non-owners can't direct-invite.
  useEffect(() => {
    if (!shareModal || !isOwner) {
      setInviteResults([]);
      return;
    }
    const q = inviteQuery.trim();
    if (q.length < 2) {
      setInviteResults([]);
      setInviteSearching(false);
      return;
    }
    let cancelled = false;
    setInviteSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/users/search?q=${encodeURIComponent(q)}`,
        );
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        if (!cancelled) {
          // Exclude the owner + existing members from the result list.
          const excludeIds = new Set<string>([
            String(itinerary?.userId || ""),
            ...companions.map((c) => String(c.userId)),
          ]);
          setInviteResults(
            (data as any[])
              .map((u) => ({
                userId: String(u.userId ?? u.id ?? ""),
                userName: u.userName ?? u.username ?? "",
                fullName: u.fullName ?? u.full_name ?? "",
                avatarUrl: u.avatarUrl ?? u.avatar_url ?? u.avatar ?? null,
              }))
              .filter((u) => u.userId && !excludeIds.has(u.userId))
              .slice(0, 10),
          );
        }
      } catch {
        if (!cancelled) setInviteResults([]);
      } finally {
        if (!cancelled) setInviteSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [inviteQuery, shareModal, isOwner, itinerary?.userId, companions]);

  const showInviteToast = useCallback(
    (kind: "success" | "info" | "error", text: string) => {
      setInviteToast({ kind, text });
      // Auto-dismiss after 3s so the modal doesn't stay cluttered.
      setTimeout(() => {
        setInviteToast((cur) =>
          cur && cur.text === text && cur.kind === kind ? null : cur,
        );
      }, 3000);
    },
    [],
  );

  const handleInviteByUserId = useCallback(
    async (target: { userId: string; userName: string; fullName: string }) => {
      if (!itinerary?.id) return;
      setInviteBusyUserId(target.userId);
      const label = target.fullName || target.userName;
      try {
        // Use the new invitation flow — the invitee receives a notification
        // and must accept before being added as a member. The previous
        // direct-add endpoint is still available but bypasses consent.
        const result = await sendInvitationMut.mutateAsync({
          inviteeUserId: target.userId,
          role: sharePermission,
        });
        if (result.alreadyMember) {
          showInviteToast("info", `${label} đã có trong nhóm.`);
        } else if (result.alreadySent) {
          showInviteToast("info", `Đã gửi lời mời cho ${label}, chờ phản hồi.`);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showInviteToast(
            "success",
            `Đã gửi lời mời tới ${label} với vai trò ${
              sharePermission === "editor" ? "chỉnh sửa" : "xem"
            }.`,
          );
          setSessionInvitedIds((prev) => new Set(prev).add(target.userId));
        }
        setInviteQuery("");
        setInviteResults([]);
      } catch (err: any) {
        showInviteToast("error", err?.message || "Không mời được. Thử lại sau.");
      } finally {
        setInviteBusyUserId(null);
      }
    },
    [itinerary, sharePermission, qc],
  );

  // Unified search — when the user types in the "Thêm địa điểm" search box,
  // debounce-fire /api/places/unified-search to surface external (Google /
  // SerpAPI / Goong) results below the DB matches. The endpoint dedupes by
  // googlePlaceId server-side so we don't show duplicates here.
  useEffect(() => {
    if (!addPlaceModal || addPlaceTab !== "system") return;
    const q = poiSearch.trim();
    if (q.length < 2) {
      setExternalSearchResults([]);
      setExternalSearchLoading(false);
      return;
    }
    let cancelled = false;
    setExternalSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/places/unified-search?q=${encodeURIComponent(q)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        const external = Array.isArray(data?.external) ? data.external : [];
        setExternalSearchResults(external);
      } catch (err) {
        if (!cancelled) setExternalSearchResults([]);
      } finally {
        if (!cancelled) setExternalSearchLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [poiSearch, addPlaceModal, addPlaceTab]);

  const addPlaceFromExternal = useCallback(
    async (place: (typeof externalSearchResults)[number]) => {
      if (!addPlaceModal || !itinerary) return;
      const newDays = [...itinerary.days];
      const activities = newDays[addPlaceModal.dayIdx].activities;
      const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;
      let nextTime = "09:00";
      if (lastActivity) {
        const lastMins = parseTimeToMinutes(lastActivity.time);
        if (lastMins >= 0) {
          nextTime = minutesToTime(
            lastMins + parseDurationToMinutes(lastActivity.duration || "1 giờ"),
          );
        }
      }
      const newActivity: ItineraryActivity = {
        id: generateId(),
        time: nextTime,
        title: place.name,
        description: "",
        duration: "1 giờ",
        estimatedCost: 0,
        isCompleted: false,
        activityType: "sightseeing",
        address: place.address || undefined,
        latitude: typeof place.latitude === "number" ? place.latitude : undefined,
        longitude: typeof place.longitude === "number" ? place.longitude : undefined,
        rating: typeof place.rating === "number" ? place.rating : undefined,
        reviewCount: typeof place.reviewCount === "number" ? place.reviewCount : undefined,
        googlePlaceId: place.placeId || undefined,
      } as ItineraryActivity;
      activities.push(newActivity);
      newDays[addPlaceModal.dayIdx].activities = sortActivitiesByTime(activities);
      try {
        await updateItinerary(itinerary.id, { days: newDays });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAddPlaceModal(null);
        setPoiSearch("");
        setExternalSearchResults([]);
      } catch (err) {
        Alert.alert("Lỗi", "Không thể thêm địa điểm. Thử lại sau.");
      }
    },
    [addPlaceModal, itinerary, updateItinerary],
  );

  if (!itinerary) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingHorizontal: 20 },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton width={36} height={36} radius={18} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={18} width="60%" />
            <Skeleton height={12} width="40%" />
          </View>
        </View>
        <View style={{ marginTop: 24, gap: 12 }}>
          <Skeleton height={170} radius={14} />
          <Skeleton height={64} radius={12} />
          <Skeleton height={42} radius={10} />
          <Skeleton height={42} radius={10} />
          <Skeleton height={42} radius={10} />
        </View>
      </View>
    );
  }

  const initSplitChecked = () => {
    const checked: Record<string, boolean> = {};
    tripMembers.forEach((m) => {
      checked[m.userId] = true;
    });
    return checked;
  };

  const remaining = (itinerary.totalBudget || 0) - totalSpent;
  const budgetPercent =
    itinerary.totalBudget > 0 ? Math.min(100, (totalSpent / itinerary.totalBudget) * 100) : 0;
  const expenses = itinerary.expenses || [];
  const manualExpenses = expenses.filter((e) => !e.activityId);

  const generateShareCode = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  };

  const handleGenerateLink = async () => {
    try {
      const code = itinerary.shareCode || generateShareCode();
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const shareBaseUrl =
        Platform.OS === "web" ? `${window.location.protocol}//${window.location.host}` : baseUrl;
      const link = `${shareBaseUrl}/join/${code}`;

      // ── Open native share sheet IMMEDIATELY (zero perceived wait) ──
      // The previous flow awaited two server roundtrips before showing the
      // toast — user saw nothing for 1-3s, then a toast much later. Now we
      // do clipboard + native share first, then sync server in the background.
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(link);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        alert(txt.linkCopied);
      } else {
        try {
          await Share.share({
            title: itinerary.title,
            message: `Cùng tham gia chuyến đi "${itinerary.title}" trên PlanGo!\n${link}`,
            url: link,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // User cancelled — also stash in clipboard as fallback
          await Clipboard.setStringAsync(link);
        }
      }

      // ── Fire-and-forget server sync ──
      // Always sync so the joiner side can resolve this code. If shareCode is
      // brand new the joiner couldn't load before this finishes, but the
      // server roundtrip typically completes in 200-500ms — long before any
      // recipient opens the link.
      const updatedItinerary = {
        ...itinerary,
        shareCode: code,
        sharePermission,
        isShared: true,
      };
      updateItinerary(itinerary.id, {
        shareCode: code,
        sharePermission: sharePermission,
        isShared: true,
      }).catch((err) => console.warn("Share local update failed:", err));
      fetch(`${baseUrl}/api/share`, {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: code, itinerary: updatedItinerary }),
      })
        .then((r) => {
          if (!r.ok) console.warn("Share sync failed:", r.status);
        })
        .catch((err) => console.warn("Share sync error:", err));
    } catch (e: any) {
      console.error("handleGenerateLink error:", e);
      if (Platform.OS === "web") {
        alert("Không thể tạo liên kết chia sẻ. Vui lòng thử lại.");
      } else {
        Alert.alert("Lỗi", "Không thể tạo liên kết chia sẻ. Vui lòng thử lại.");
      }
    }
  };

  const getServerUrl = () => getApiUrl().replace(/\/$/, "");

  const handleRemoveCompanion = async (companion: TripCompanion) => {
    const doRemove = async () => {
      // Hit the dedicated share/companion endpoint FIRST (it's the only one
      // that actually persists membership changes). The legacy
      // `updateItinerary({companions})` call was a no-op on the server but
      // triggered an optimistic write + refetch race that made the
      // Companions tab flicker between the new and old lists.
      if (itinerary.shareCode) {
        try {
          await fetch(`${getServerUrl()}/api/share/companion`, {
            method: "DELETE",
            headers: { ...getApiHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              shareCode: itinerary.shareCode,
              userId: companion.userId,
            }),
          });
        } catch (e) {
          console.log("Failed to sync companion removal:", e);
        }
      }
      // Refresh detail + lists so the new membership state shows everywhere.
      qc.invalidateQueries({ queryKey: queryKeys.tripDetail(itinerary.id) });
      qc.invalidateQueries({ queryKey: ["trips", "list"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    const ok = await confirm({
      title: txt.removeCompanion,
      message: txt.removeCompanionMsg(companion.userName),
      destructive: true,
      confirmText: t().common.delete,
    });
    if (ok) await doRemove();
  };

  const handleChangeCompanionRole = async (
    companion: TripCompanion,
    newRole: "editor" | "viewer",
  ) => {
    // Same fix as removal — call the persistence endpoint first, then let
    // a single invalidate refresh the cache. The previous optimistic
    // updateItinerary path raced with the refetch and made the role chip
    // flicker between old and new values.
    if (itinerary.shareCode) {
      try {
        await fetch(`${getServerUrl()}/api/share/companion`, {
          method: "PATCH",
          headers: { ...getApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            shareCode: itinerary.shareCode,
            userId: companion.userId,
            role: newRole,
          }),
        });
      } catch (e) {
        console.log("Failed to sync role change:", e);
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.tripDetail(itinerary.id) });
    qc.invalidateQueries({ queryKey: ["trips", "list"] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleLeaveTrip = async () => {
    const doLeave = async () => {
      // Persistence first, then a single invalidate. Same race-fix as
      // handleRemoveCompanion / handleChangeCompanionRole.
      if (itinerary.shareCode && user) {
        try {
          await fetch(`${getServerUrl()}/api/share/companion`, {
            method: "DELETE",
            headers: { ...getApiHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({
              shareCode: itinerary.shareCode,
              userId: user.id,
            }),
          });
        } catch (e) {
          console.log("Failed to sync leave to server:", e);
        }
      }
      qc.invalidateQueries({ queryKey: ["trips", "list"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.canGoBack() ? router.back() : router.replace("/(tabs)/trips");
    };
    const ok = await confirm({
      title: txt.leaveTrip,
      message: txt.leaveTripMsg,
      destructive: true,
      confirmText: txt.leaveTrip,
      icon: "exit-outline",
    });
    if (ok) await doLeave();
  };

  const openGoogleMaps = (opts: {
    lat?: number;
    lng?: number;
    address?: string;
    name?: string;
    googlePlaceId?: string;
  }) => {
    const { lat, lng, address, name, googlePlaceId } = opts;
    // Build a human-readable destination query for Google Maps
    const destinationQuery = [name, address].filter(Boolean).join(", ");
    if (googlePlaceId && destinationQuery) {
      // Best case: use place_id for exact place + readable name as fallback
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&destination_place_id=${googlePlaceId}`,
      );
    } else if (destinationQuery) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`,
      );
    } else if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  };

  const openGrab = (lat?: number, lng?: number, name?: string) => {
    if (lat && lng) {
      const url =
        Platform.OS === "ios"
          ? `grab://open?screenType=BOOKING&dropOffLatitude=${lat}&dropOffLongitude=${lng}`
          : `https://grab.onelink.me/2695613898?af_dp=grab%3A%2F%2Fopen%3FscreenType%3DBOOKING%26dropOffLatitude%3D${lat}%26dropOffLongitude%3D${lng}`;
      Linking.openURL(url).catch(() => {
        const fallbackDest = name ? encodeURIComponent(name) : `${lat},${lng}`;
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${fallbackDest}`);
      });
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const daysSummary = itinerary.days
      .map(
        (d) =>
          `📅 ${d.title}\n${d.activities
            .map(
              (a) =>
                `  ${a.time} - ${a.title}${a.estimatedCost ? ` (${formatVND(a.estimatedCost)})` : ""}`,
            )
            .join("\n")}`,
      )
      .join("\n\n");
    const message = `✈️ ${itinerary.title}\n📍 ${itinerary.destination}\n🗓 ${itinerary.startDate} - ${itinerary.endDate}\n👥 ${itinerary.numPeople} người\n💰 ${formatVND(itinerary.totalBudget || 0)}\n${itinerary.startingPoint ? `🚀 Xuất phát: ${itinerary.startingPoint}\n` : ""}\n${daysSummary}`;
    try {
      if (Platform.OS === "web") {
        try {
          await navigator.clipboard.writeText(message);
        } catch {
          /* fallback */
        }
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

  const handleStatusChange: () => Promise<void> = async () => {
    const nextStatus =
      itinerary.status === "draft"
        ? "active"
        : itinerary.status === "active"
          ? "completed"
          : "draft";

    // Warn (not block) if user is starting before the trip's scheduled startDate.
    // Vietnamese travelers sometimes leave early — we don't block, but we ask
    // confirmation so a stray tap doesn't silently flip status weeks early.
    // Parse handles both dd-mm-yyyy (FE format) and yyyy-mm-dd (ISO fallback).
    if (nextStatus === "active") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parseTripDate = (raw: string): Date | null => {
        if (!raw) return null;
        const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})/);
        if (dmy) {
          return new Date(
            parseInt(dmy[3], 10),
            parseInt(dmy[2], 10) - 1,
            parseInt(dmy[1], 10),
          );
        }
        const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (ymd) {
          return new Date(
            parseInt(ymd[1], 10),
            parseInt(ymd[2], 10) - 1,
            parseInt(ymd[3], 10),
          );
        }
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
      };
      const start = parseTripDate(itinerary.startDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        if (today < start) {
          const daysLeft = Math.ceil(
            (start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
          );
          const ok = await confirm({
            title: "Bắt đầu chuyến đi sớm?",
            message:
              daysLeft === 1
                ? `Ngày khởi hành dự kiến là ngày mai (${itinerary.startDate}). Bạn vẫn muốn bắt đầu ngay?`
                : `Ngày khởi hành dự kiến còn ${daysLeft} ngày nữa (${itinerary.startDate}). Bạn vẫn muốn bắt đầu ngay?`,
            confirmText: "Vẫn bắt đầu",
            cancelText: "Đổi ý",
          });
          if (!ok) return;
        }
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
            const taggedComment = review.comment.includes("[resetBefore:")
              ? review.comment
              : `${review.comment} [resetBefore:${newResetCount}]`;
            await updateReview(review.id, { comment: taggedComment });
          }
        }
        const newDays = itinerary.days.map((day) => ({
          ...day,
          activities: day.activities.map((a) => ({
            ...a,
            isCompleted: false,
            actualCost: 0,
            paidBy: undefined,
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
      // Server-side notifyTripStarted/notifyTripCompleted also fans out to
      // all members on status transition; this client-side call is the safety
      // net so the owner always sees the event even if the server fails.
      if (nextStatus === "active") {
        await addNotification({
          userId: itinerary.userId,
          title: t().notifications.tripStarted,
          message: `${itinerary.title} đã bắt đầu!`,
          type: "info",
          itineraryId: itinerary.id,
        }).catch(() => {});
      } else if (nextStatus === "completed") {
        await addNotification({
          userId: itinerary.userId,
          title: t().notifications.tripCompleted,
          message: `${itinerary.title} đã hoàn thành!`,
          type: "success",
          itineraryId: itinerary.id,
        }).catch(() => {});
        // Auto-open destination review modal
        const dest = destinations.find(
          (d) => d.name.toLowerCase() === itinerary.destination.toLowerCase(),
        );
        const alreadyReviewed =
          dest &&
          reviews.some(
            (r) =>
              r.userId === user?.id &&
              r.destinationId === dest.id &&
              r.itineraryId === itinerary.id &&
              !r.activityId,
          );
        if (dest && !alreadyReviewed) {
          setReviewRating(5);
          setReviewComment("");
          setReviewPhotos([]);
          setReviewModal({
            activityId: "",
            dayIdx: 0,
            destinationId: dest.id,
            activityTitle: dest.name,
          });
        }
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
  // Keep the ref pointed at the latest handleStatusChange so the autoStatus
  // useEffect can fire it without depending on it directly (which would
  // re-trigger on every state change).
  handleStatusChangeRef.current = handleStatusChange;

  const handleDelete = async () => {
    const ok = await confirm({
      title: t().itinerary.deleteTrip,
      message: t().itinerary.deleteConfirm,
      destructive: true,
      confirmText: t().common.delete,
    });
    if (!ok) return;
    deleteItinerary(itinerary.id);
    router.back();
  };

  const handleEdit = () => {
    router.push({ pathname: "/create-trip", params: { editId: itinerary.id } });
  };

  const recalcSpent = (days: typeof itinerary.days, exps: Expense[]) => {
    const activitySpent = days.reduce(
      (sum, day) => sum + day.activities.reduce((s, a) => s + (a.actualCost || 0), 0),
      0,
    );
    // Exclude expenses linked to activities (they are already counted via actualCost)
    const expenseSpent = exps.filter((e) => !e.activityId).reduce((sum, e) => sum + e.amount, 0);
    return activitySpent + expenseSpent;
  };

  const getActivityReview = (activityId: string) => {
    const currentResetCount = itinerary.resetCount || 0;
    return (
      reviews.find((r) => {
        if (r.userId !== user?.id) return false;
        // Match by new activityId field
        if (r.activityId === activityId) {
          const resetMatch = r.comment.match(/\[resetBefore:(\d+)\]/);
          if (resetMatch && parseInt(resetMatch[1], 10) <= currentResetCount) return false;
          return true;
        }
        // Fallback: match by [activity:xxx] tag in comment (legacy)
        if (r.comment.includes(`[activity:${activityId}]`)) {
          const resetMatch = r.comment.match(/\[resetBefore:(\d+)\]/);
          if (resetMatch && parseInt(resetMatch[1], 10) <= currentResetCount) return false;
          return true;
        }
        return false;
      }) || null
    );
  };

  const getActivityDestinationId = (activity: ItineraryActivity): string | undefined => {
    const linkedDest = activity.destinationId
      ? destinations.find((d) => d.id === activity.destinationId)
      : destinations.find((d) => d.name === activity.title);
    return linkedDest?.id;
  };

  // Find the POI that matches this activity (by poiId, googlePlaceId, or name)
  const getActivityPoiInfo = (
    activity: ItineraryActivity,
  ): { poiId: string; poiName: string } | null => {
    // Priority 1: activity has a direct poiId
    if (activity.poiId) {
      const poi = pois.find((p) => p.id === String(activity.poiId));
      if (poi) return { poiId: poi.id, poiName: poi.name };
    }
    // Priority 2: match by googlePlaceId
    if (activity.googlePlaceId) {
      const poi = pois.find((p) => p.googlePlaceId === activity.googlePlaceId);
      if (poi) return { poiId: poi.id, poiName: poi.name };
    }
    // Priority 3: match by normalized name
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/^(tham quan|ăn sáng tại|ăn trưa tại|ăn tối tại|khám phá)\s+/i, "")
        .trim();
    const actName = normalize(activity.title);
    if (actName.length > 2) {
      const poi = pois.find(
        (p) => normalize(p.name) === actName || p.name.toLowerCase() === actName,
      );
      if (poi) return { poiId: poi.id, poiName: poi.name };
    }
    return null;
  };

  // Get reviews from OTHER users for the same POI
  const getOtherUsersPoiReviews = (activity: ItineraryActivity) => {
    const poiInfo = getActivityPoiInfo(activity);
    if (!poiInfo) return [];
    return reviews
      .filter((r) => {
        if (r.userId === user?.id) return false; // exclude own reviews
        if (r.poiId === poiInfo.poiId) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const toggleActivityComplete = async (dayIdx: number, activityId: string) => {
    const activity = itinerary.days[dayIdx]?.activities.find((a) => a.id === activityId);
    if (!activity) return;

    if (activity.isCompleted) {
      const existingReview = getActivityReview(activityId);
      if (existingReview) {
        if (Platform.OS === "web") {
          window.alert(t().itinerary.cannotUncheckHasReview);
        } else {
          Alert.alert("", t().itinerary.cannotUncheckHasReview);
        }
        return;
      }

      // Perform uncheck immediately without confirmation
      try {
        const newDays = JSON.parse(JSON.stringify(itinerary.days));
        const act = newDays[dayIdx].activities.find((a: any) => a.id === activityId);
        if (!act) return;

        act.isCompleted = false;
        act.actualCost = 0;
        act.paidBy = undefined;

        const newExpenses = JSON.parse(JSON.stringify(itinerary.expenses || [])).filter(
          (e: any) => e.activityId !== activityId,
        );

        const newSpent = recalcSpent(newDays, newExpenses);

        updateItinerary(itinerary.id, {
          days: newDays,
          expenses: newExpenses,
          spentAmount: newSpent,
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (err) {
        console.error("Failed to uncheck activity:", err);
      }
      return;
    }

    try {
      // Deep copy to prevent any state mutation issues
      const newDays = JSON.parse(JSON.stringify(itinerary.days));
      const act = newDays[dayIdx].activities.find((a: any) => a.id === activityId);
      if (!act) return;

      act.isCompleted = true;
      const newExpenses = JSON.parse(JSON.stringify(itinerary.expenses || []));

      if (!act.actualCost && act.estimatedCost) {
        act.actualCost = act.estimatedCost;
        const currentUserName = user?.fullName || user?.username || undefined;
        const currentUserId = user?.id || undefined;
        act.paidBy = currentUserName;

        const existingExpIdx = newExpenses.findIndex((e: any) => e.activityId === activityId);
        if (existingExpIdx >= 0) {
          newExpenses[existingExpIdx] = {
            ...newExpenses[existingExpIdx],
            title: act.title,
            amount: act.estimatedCost,
            type: act.activityType,
            paidBy: currentUserName,
            paidByUserId: currentUserId,
            dayIndex: dayIdx,
          };
        } else {
          newExpenses.push({
            id: generateId(),
            title: act.title,
            amount: act.estimatedCost,
            type: act.activityType,
            paidBy: currentUserName,
            paidByUserId: currentUserId,
            dayIndex: dayIdx,
            activityId: activityId,
            createdAt: new Date().toISOString(),
          });
        }
      }

      const newSpent = recalcSpent(newDays, newExpenses);

      await updateItinerary(itinerary.id, {
        days: newDays,
        expenses: newExpenses,
        spentAmount: newSpent,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Belt-and-braces — server-side already fires activity_completed +
      // budget_warning via syncNestedActivities + createTripExpense, but keep
      // the client-side calls as a fallback in case the server triggers fail.
      try {
        await addNotification({
          userId: itinerary.userId,
          title: t().notifications.activityCompleted,
          message: `"${act.title}" đã hoàn thành`,
          type: "info",
          itineraryId: itinerary.id,
        });
        if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
          await addNotification({
            userId: itinerary.userId,
            title: t().notifications.budgetWarning,
            message: t().notifications.budgetExceeded(formatVND(itinerary.totalBudget - newSpent)),
            type: "warning",
            itineraryId: itinerary.id,
          });
        }
      } catch (notifErr) {
        console.warn("Notification error:", notifErr);
      }
    } catch (err) {
      console.error("Failed to check activity:", err);
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
        setReviewComment(
          existingReview.comment
            .replace(/\s*\[activity:[^\]]+\]/, "")
            .replace(/\s*\[resetBefore:\d+\]/, ""),
        );
        setReviewPhotos(
          Array.isArray((existingReview as any).photos)
            ? ((existingReview as any).photos as string[])
            : [],
        );
      }
    } else {
      setReviewRating(5);
      setReviewComment("");
      setReviewPhotos([]);
    }
    setReviewModal({
      activityId,
      dayIdx,
      destinationId: destId,
      activityTitle: activity.title,
      editReviewId,
    });
  };

  const submitActivityReview = async () => {
    if (!reviewModal) return;
    // Guard: viewer companions cannot submit reviews
    if (!canEdit) {
      const msg = "Người xem không có quyền đánh giá địa điểm.";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("", msg);
      }
      return;
    }
    const commentText = reviewComment.trim();
    const taggedComment = reviewModal.activityId
      ? commentText
        ? `${commentText} [activity:${reviewModal.activityId}]`
        : `[activity:${reviewModal.activityId}]`
      : commentText;

    // Find matching POI for this activity
    let poiId = "";
    let poiName = "";
    if (reviewModal.activityId) {
      const activity = itinerary.days[reviewModal.dayIdx]?.activities.find(
        (a) => a.id === reviewModal.activityId,
      );
      if (activity) {
        // Guard: only allow new reviews for completed activities
        if (!reviewModal.editReviewId && !activity.isCompleted) {
          const msg = "Chỉ có thể đánh giá địa điểm đã hoàn thành.";
          if (Platform.OS === "web") {
            window.alert(msg);
          } else {
            Alert.alert("", msg);
          }
          return;
        }
        const poiInfo = getActivityPoiInfo(activity);
        if (poiInfo) {
          poiId = poiInfo.poiId;
          poiName = poiInfo.poiName;
        }
      }
    }

    const photosPayload = reviewPhotos.length > 0 ? reviewPhotos : null;
    if (reviewModal.editReviewId) {
      await updateReview(reviewModal.editReviewId, {
        userId: user!.id,
        rating: reviewRating,
        comment: taggedComment,
        poiId,
        poiName,
        type: "item",
        photos: photosPayload,
      } as any);
    } else {
      await addReview({
        userId: user!.id,
        userName: user!.fullName,
        destinationId: reviewModal.destinationId || "",
        poiId: poiId || undefined,
        poiName: poiName || undefined,
        activityId: reviewModal.activityId || undefined,
        activityTitle: reviewModal.activityTitle || undefined,
        itineraryId: reviewModal.activityId || poiId ? undefined : id,
        rating: reviewRating,
        comment: taggedComment,
        photos: photosPayload,
      } as any);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReviewModal(null);
    setReviewPhotos([]);
  };

  const pickReviewPhoto = useCallback(async () => {
    if (reviewPhotos.length >= 10) {
      Alert.alert("Đã đủ", "Tối đa 10 ảnh cho mỗi đánh giá.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const dataUri = a.base64
        ? `data:image/${a.uri.split(".").pop() === "png" ? "png" : "jpeg"};base64,${a.base64}`
        : a.uri;
      setReviewPhotos((prev) => [...prev, dataUri]);
      Haptics.selectionAsync();
    }
  }, [reviewPhotos]);

  const removeReviewPhoto = useCallback((index: number) => {
    setReviewPhotos((prev) => prev.filter((_, i) => i !== index));
    Haptics.selectionAsync();
  }, []);

  const handleDeleteActivityReview = async (reviewId: string) => {
    const ok = await confirm({
      title: txt.deleteReview,
      message: txt.deleteReviewConfirm,
      destructive: true,
      confirmText: t().common.delete,
    });
    if (!ok) return;
    await deleteReview(reviewId, { userId: user!.id, type: "item" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    if (!noteModal) return;
    if (!noteModal.note.trim()) {
      if (Platform.OS === "web") window.alert("Vui lòng nhập ghi chú trước khi lưu.");
      else Alert.alert("Trống", "Vui lòng nhập ghi chú trước khi lưu.");
      return;
    }
    const newDays = [...itinerary.days];
    const activity = newDays[noteModal.dayIdx].activities.find(
      (a) => a.id === noteModal.activityId,
    );
    if (activity) {
      const currentNotes = getActivityNotes(activity);
      if (noteModal.editIndex !== undefined) {
        currentNotes[noteModal.editIndex] = noteModal.note.trim();
      } else {
        currentNotes.push(noteModal.note.trim());
      }
      activity.notes = currentNotes;
      activity.note = undefined;
      try {
        await updateItinerary(itinerary.id, { days: newDays });
      } catch (err: any) {
        if (Platform.OS === "web")
          window.alert(`Không lưu được ghi chú: ${err?.message || "lỗi mạng"}`);
        else Alert.alert("Không lưu được", err?.message || "Vui lòng thử lại");
        return;
      }
    }
    setNoteModal(null);
  };

  const deleteNote = async (dayIdx: number, activityId: string, noteIndex: number) => {
    const ok = await confirm({
      title: t().itinerary.deleteNote,
      message: t().itinerary.deleteNoteConfirm,
      destructive: true,
      confirmText: t().common.delete,
    });
    if (!ok) return;
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

  // Helper: build ExpenseSplit[] from cost modal split state
  const buildCostSplits = (
    splitType: "none" | "equal" | "custom",
    splitChecked: Record<string, boolean>,
    splitAmounts: Record<string, string>,
    totalAmount: number,
  ): ExpenseSplit[] => {
    if (splitType === "none") return [];
    const checkedMembers = tripMembers.filter((m) => splitChecked[m.userId]);
    if (checkedMembers.length === 0) return [];
    if (splitType === "equal") {
      const share = Math.floor(totalAmount / checkedMembers.length);
      return checkedMembers.map((m) => ({ userId: m.userId, userName: m.userName, amount: share }));
    }
    return checkedMembers
      .map((m) => ({
        userId: m.userId,
        userName: m.userName,
        amount: parseInt((splitAmounts[m.userId] || "0").replace(/[^0-9]/g, ""), 10) || 0,
      }))
      .filter((s) => s.amount > 0);
  };

  const saveCost = async () => {
    if (!costModal) return;
    const newDays = [...itinerary.days];
    const activity = newDays[costModal.dayIdx].activities.find(
      (a) => a.id === costModal.activityId,
    );
    if (activity) {
      const newActualCost = parseInt(costModal.cost.replace(/[^0-9]/g, ""), 10) || 0;
      const newEstimatedCost = parseInt(costModal.estimatedCost.replace(/[^0-9]/g, ""), 10) || 0;
      // Apply estimated cost only if allowed
      const canEditEstimated =
        itinerary.status === "draft" || (itinerary.status === "active" && !activity.isCompleted);
      if (canEditEstimated) {
        activity.estimatedCost = newEstimatedCost;
      }
      // Apply actual cost only if not draft
      if (itinerary.status !== "draft") {
        activity.actualCost = newActualCost;
      }
      activity.paidBy = costModal.paidBy.trim() || undefined;
      activity.expenseTypeId = costModal.expenseTypeId;

      // Auto-create or update linked expense for this activity
      const newExpenses = [...expenses];
      if (itinerary.status !== "draft" && newActualCost > 0) {
        const paidByName = costModal.paidBy.trim() || undefined;
        const paidByMember = tripMembers.find((m) => m.userName === paidByName);
        const existingIdx = newExpenses.findIndex(
          (e) => e.activityId === costModal.activityId.toString(),
        );
        if (existingIdx >= 0) {
          // Update existing linked expense
          const updatedSplits = buildCostSplits(
            costSplitType,
            costSplitChecked,
            costSplitAmounts,
            newActualCost,
          );
          newExpenses[existingIdx] = {
            ...newExpenses[existingIdx],
            title: activity.title,
            amount: newActualCost,
            type: (costModal.type || activity.activityType || "other") as Expense["type"],
            paidBy: paidByName,
            paidByUserId: paidByMember?.userId,
            splitType: costSplitType,
            splits: updatedSplits,
            dayIndex: costModal.dayIdx,
          };
        } else {
          // Create new linked expense
          const newSplits = buildCostSplits(
            costSplitType,
            costSplitChecked,
            costSplitAmounts,
            newActualCost,
          );
          newExpenses.push({
            id: generateId(),
            title: activity.title,
            amount: newActualCost,
            type: (costModal.type || activity.activityType || "other") as Expense["type"],
            paidBy: paidByName,
            paidByUserId: paidByMember?.userId,
            splitType: costSplitType,
            splits: newSplits,
            dayIndex: costModal.dayIdx,
            activityId: costModal.activityId,
            expenseTypeId: costModal.expenseTypeId,
            createdAt: new Date().toISOString(),
          });
        }
      } else if (itinerary.status !== "draft") {
        // If actual cost is 0, remove linked expense if exists
        const existingIdx = newExpenses.findIndex(
          (e) => e.activityId === costModal.activityId.toString(),
        );
        if (existingIdx >= 0) newExpenses.splice(existingIdx, 1);
      }

      const newSpent = recalcSpent(newDays, newExpenses);
      try {
        await updateItinerary(itinerary.id, {
          days: newDays,
          expenses: newExpenses,
          spentAmount: newSpent,
        });
        if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
          if (Platform.OS === "web") {
            window.alert(t().itinerary.budgetWarning);
          } else {
            Alert.alert(t().notifications.budgetWarning, t().itinerary.budgetWarning);
          }
        }
      } catch (err: any) {
        // Server validation failed — keep modal open and surface the error so
        // user can fix instead of silently losing the input.
        console.error("saveCost failed:", err);
        if (Platform.OS === "web") {
          window.alert(`Không lưu được chi phí: ${err?.message || "lỗi mạng"}`);
        } else {
          Alert.alert("Không lưu được", err?.message || "Vui lòng thử lại");
        }
        return; // keep modal open
      }
    }
    setCostModal(null);
    setCostPaidByDropdown(false);
    setCostSplitType("none");
    setCostSplitChecked({});
    setCostSplitAmounts({});
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
    newDays[timeModal.dayIdx].activities = sortActivitiesByTime(activities);

    const sortedActivities = newDays[timeModal.dayIdx].activities;
    const newActIdx = sortedActivities.findIndex((a) => a.id === timeModal.activityId);

    let currentEnd =
      newMins + parseDurationToMinutes(sortedActivities[newActIdx].duration || "1 giờ");
    for (let i = newActIdx + 1; i < sortedActivities.length; i++) {
      const travelInfo = getTravelInfo(sortedActivities[i - 1], sortedActivities[i]);
      const travelMins = travelInfo
        ? travelInfo.defaultMode === "walking"
          ? travelInfo.walkingMinutes
          : travelInfo.drivingMinutes
        : 0;
      const nextStart = currentEnd + travelMins;
      sortedActivities[i].time = minutesToTime(nextStart);
      currentEnd = nextStart + parseDurationToMinutes(sortedActivities[i].duration || "1 giờ");
    }

    try {
      await updateItinerary(itinerary.id, { days: newDays });
    } catch (err: any) {
      if (Platform.OS === "web")
        window.alert(`Không lưu được giờ: ${err?.message || "lỗi mạng"}`);
      else Alert.alert("Không lưu được", err?.message || "Vui lòng thử lại");
      return;
    }
    setTimeModal(null);
  };

  const addPlaceToDay = async () => {
    if (!addPlaceModal) return;
    if (!placeTitle.trim()) {
      if (Platform.OS === "web") window.alert("Vui lòng nhập tên địa điểm.");
      else Alert.alert("Thiếu thông tin", "Vui lòng nhập tên địa điểm.");
      return;
    }
    const newDays = [...itinerary.days];
    const activities = newDays[addPlaceModal.dayIdx].activities;
    const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;
    let nextTime = "09:00";
    if (lastActivity) {
      const lastMins = parseTimeToMinutes(lastActivity.time);
      if (lastMins >= 0) {
        nextTime = minutesToTime(
          lastMins + parseDurationToMinutes(lastActivity.duration || "1 giờ"),
        );
      }
    }
    const cost = parseInt(placeCost.replace(/[^0-9]/g, ""), 10) || 0;
    const selectedPoiType = poiTypes.find((pt) => pt.id === placePoiTypeId);
    const newActivity: ItineraryActivity = {
      id: generateId(),
      time: nextTime,
      title: placeTitle.trim(),
      description: "",
      duration: placeDuration || "1 giờ",
      estimatedCost: cost,
      isCompleted: false,
      activityType: placeType,
      placeType: selectedPoiType?.typeName || undefined,
      address: placeAddress.trim() || undefined,
      destinationId: placeDestinationId || undefined,
      expenseTypeId: placeExpenseTypeId,
    };
    activities.push(newActivity);
    newDays[addPlaceModal.dayIdx].activities = sortActivitiesByTime(activities);
    try {
      await updateItinerary(itinerary.id, { days: newDays });
    } catch (err: any) {
      if (Platform.OS === "web")
        window.alert(`Không thêm được địa điểm: ${err?.message || "lỗi mạng"}`);
      else Alert.alert("Không lưu được", err?.message || "Vui lòng thử lại");
      return;
    }
    setPlaceTitle("");
    setPlaceDuration("1 giờ");
    setPlaceCost("");
    setPlaceType("sightseeing");
    setPlaceAddress("");
    setPlaceDestinationId("");
    setPlaceExpenseTypeId(undefined);
    setPlacePoiTypeId("");
    setAddPlaceModal(null);
  };

  const deleteActivity = async (dayIdx: number, activityId: string) => {
    const ok = await confirm({
      title: t().itinerary.deleteActivity,
      message: t().itinerary.deleteActivityConfirm,
      destructive: true,
      confirmText: t().common.delete,
    });
    if (!ok) return;
    const newDays = [...itinerary.days];
    newDays[dayIdx].activities = newDays[dayIdx].activities.filter((a) => a.id !== activityId);
    const newSpent = recalcSpent(newDays, expenses);
    await updateItinerary(itinerary.id, { days: newDays, spentAmount: newSpent });
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
          const d = haversineDistance(
            last.latitude,
            last.longitude,
            remaining[j].latitude!,
            remaining[j].longitude!,
          );
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = j;
          }
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
    if (Platform.OS === "web") {
      window.alert(txt.autoSortDone);
    } else {
      Alert.alert("", txt.autoSortDone);
    }
  };

  const addPlaceFromPOI = async (poi: POI, dayIdx: number) => {
    const newDays = [...itinerary.days];
    const activities = newDays[dayIdx].activities;
    const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;
    let nextTime = "09:00";
    if (lastActivity) {
      const lastMins = parseTimeToMinutes(lastActivity.time);
      if (lastMins >= 0) {
        nextTime = minutesToTime(
          lastMins + parseDurationToMinutes(lastActivity.duration || "1 giờ"),
        );
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
      activityType: getActivityTypeLabel(typeMap[poi.type] || "sightseeing"),
      address: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      poiId: poi.id,
      destinationId: poi.destinationId,
    };
    activities.push(newActivity);
    newDays[dayIdx].activities = sortActivitiesByTime(activities);
    await updateItinerary(itinerary.id, { days: newDays });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddPlaceModal(null);
    setPoiSearch("");
    setPoiDestFilter("");
  };

  const saveEditInfo = async () => {
    const newBudget = parseInt(editBudget.replace(/[^0-9]/g, ""), 10) || itinerary.totalBudget;
    const newPeople = parseInt(editNumPeople, 10) || itinerary.numPeople;
    if (newPeople <= 0) {
      if (Platform.OS === "web") window.alert("Số người phải lớn hơn 0.");
      else Alert.alert("Sai giá trị", "Số người phải lớn hơn 0.");
      return;
    }
    try {
      await updateItinerary(itinerary.id, {
        totalBudget: newBudget,
        budget: formatVND(newBudget),
        numPeople: newPeople,
      });
    } catch (err: any) {
      if (Platform.OS === "web")
        window.alert(`Không cập nhật được: ${err?.message || "lỗi mạng"}`);
      else Alert.alert("Không cập nhật được", err?.message || "Vui lòng thử lại");
      return;
    }
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
    if (!expenseModal) return;
    const showErr = (msg: string) => {
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Thiếu thông tin", msg);
    };
    // Block edits when the trip is finalised — previously you could still
    // mutate expenses after marking the trip "completed", which corrupted
    // the post-trip statistics block.
    if (itinerary.status === "completed") {
      return showErr(
        "Chuyến đi đã hoàn thành — bỏ trạng thái hoàn thành nếu muốn sửa chi phí.",
      );
    }
    if (!expenseTitle.trim()) return showErr("Vui lòng nhập tên khoản chi.");
    if (!expenseAmount.trim()) return showErr("Vui lòng nhập số tiền.");
    const amount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
    if (amount <= 0) return showErr("Số tiền phải lớn hơn 0.");

    if (expenseSplitType !== "none" && !expensePaidByUserId) {
      return showErr("Vui lòng chọn người đã trả khoản này.");
    }

    if (expenseSplitType !== "none") {
      const checkedCount = Object.values(expenseSplitChecked).filter(Boolean).length;
      if (checkedCount === 0) return showErr("Vui lòng chọn ít nhất 1 người chia.");
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
    // Track if we need to also update days (when editing a linked expense)
    let newDays = itinerary.days;
    if (expenseModal.editId) {
      const idx = newExpenses.findIndex((e) => e.id === expenseModal.editId);
      if (idx !== -1) {
        const oldExpense = newExpenses[idx];
        newExpenses[idx] = {
          ...oldExpense,
          title: expenseTitle.trim(),
          amount,
          type: expenseType,
          expenseTypeId: expenseTypeId,
          paidBy: expensePaidBy.trim() || undefined,
          paidByUserId: expensePaidByUserId || undefined,
          splitType: expenseSplitType,
          splits,
        };
        // If this expense is linked to an activity, sync actualCost + paidBy back to the activity
        const linkedActivityId = oldExpense.activityId;
        if (linkedActivityId) {
          newDays = itinerary.days.map((day) => ({
            ...day,
            activities: day.activities.map((act) => {
              if (act.id !== linkedActivityId) return act;
              return {
                ...act,
                actualCost: amount,
                paidBy: expensePaidBy.trim() || undefined,
              };
            }),
          }));
        }
      }
    } else {
      newExpenses.push({
        id: generateId(),
        title: expenseTitle.trim(),
        amount,
        type: expenseType,
        expenseTypeId: expenseTypeId,
        paidBy: expensePaidBy.trim() || undefined,
        paidByUserId: expensePaidByUserId || undefined,
        splitType: expenseSplitType,
        splits,
        createdAt: new Date().toISOString(),
      });
    }

    const newSpent = recalcSpent(newDays, newExpenses);
    try {
      await updateItinerary(itinerary.id, {
        days: newDays,
        expenses: newExpenses,
        spentAmount: newSpent,
      });
    } catch (err: any) {
      // Save failed — keep the modal open so user can fix instead of losing input.
      const msg = err?.message || "Vui lòng thử lại.";
      if (Platform.OS === "web") window.alert(`Không lưu được khoản chi: ${msg}`);
      else Alert.alert("Không lưu được", msg);
      return;
    }

    if (newSpent > (itinerary.totalBudget || 0) && itinerary.totalBudget > 0) {
      await addNotification({
        userId: itinerary.userId,
        title: t().notifications.budgetWarning,
        message: t().notifications.budgetExceeded(formatVND(itinerary.totalBudget - newSpent)),
        type: "warning",
        itineraryId: itinerary.id,
      }).catch(() => {});
    }

    resetExpenseModal();
  };

  const resetExpenseModal = () => {
    setExpenseTitle("");
    setExpenseAmount("");
    setExpensePaidBy("");
    setExpensePaidByUserId("");
    setExpenseType("transport");
    setExpenseTypeId(undefined);
    setExpenseSplitType("none");
    setExpenseSplitChecked({});
    setExpenseSplitAmounts({});
    setPaidByDropdown(false);
    setExpenseModal(null);
  };

  const deleteExpense = async (expenseId: string) => {
    const ok = await confirm({
      title: t().itinerary.deleteExpense,
      message: t().itinerary.deleteExpenseConfirm,
      destructive: true,
      confirmText: t().common.delete,
    });
    if (!ok) return;
    const deletedExpense = expenses.find((e) => e.id === expenseId);
    const newExpenses = expenses.filter((e) => e.id !== expenseId);
    const newDays = [...itinerary.days];
    if (deletedExpense?.activityId) {
      for (const day of newDays) {
        const act = day.activities.find((a) => a.id === deletedExpense.activityId);
        if (act) {
          act.actualCost = 0;
          act.paidBy = undefined;
          break;
        }
      }
    }
    const newSpent = recalcSpent(newDays, newExpenses);
    await updateItinerary(itinerary.id, {
      days: newDays,
      expenses: newExpenses,
      spentAmount: newSpent,
    });
  };

  const openEditExpense = (expense: Expense) => {
    setExpenseTitle(expense.title);
    setExpenseAmount(expense.amount.toString());
    setExpenseType(expense.type);
    setExpenseTypeId(expense.expenseTypeId);
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
    if (!expenseNoteModal) return;
    if (!expenseNoteModal.note.trim()) {
      if (Platform.OS === "web") window.alert("Vui lòng nhập ghi chú trước khi lưu.");
      else Alert.alert("Trống", "Vui lòng nhập ghi chú trước khi lưu.");
      return;
    }
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
      try {
        await updateItinerary(itinerary.id, { expenses: newExpenses });
      } catch (err: any) {
        if (Platform.OS === "web")
          window.alert(`Không lưu được ghi chú: ${err?.message || "lỗi mạng"}`);
        else Alert.alert("Không lưu được", err?.message || "Vui lòng thử lại");
        return;
      }
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
    const ok = await confirm({
      title: t().itinerary.deleteNote,
      message: t().itinerary.deleteNoteConfirm,
      destructive: true,
      confirmText: t().common.delete,
    });
    if (ok) await doDelete();
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const txt = t().itinerary;

  const tripHeroImages = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const pushUnique = (url?: string | null) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      result.push(url);
    };

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "")
        .trim();
    const findDestByName = (name: string) => {
      const target = normalize(name);
      if (!target) return undefined;
      return destinations.find((d) => normalize(d.name) === target);
    };

    const matchedDests = new Map<string, (typeof destinations)[number]>();
    for (const day of itinerary.days) {
      for (const act of day.activities) {
        if (act.destinationId) {
          const dest = destinations.find((d) => d.id === act.destinationId);
          if (dest) matchedDests.set(dest.id, dest);
        }
      }
    }
    const tripDestNames = (itinerary.destination || "")
      .split(/[,→\->|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of tripDestNames) {
      const dest = findDestByName(name);
      if (dest) matchedDests.set(dest.id, dest);
    }
    for (const day of itinerary.days) {
      const dest = findDestByName(day.title || "");
      if (dest) matchedDests.set(dest.id, dest);
      for (const act of day.activities) {
        const d = findDestByName(act.title || "");
        if (d) matchedDests.set(d.id, d);
      }
    }
    for (const dest of matchedDests.values()) {
      if (dest?.images?.length) {
        dest.images.slice(0, 3).forEach(pushUnique);
      }
    }

    if (result.length === 0) {
      for (const day of itinerary.days) {
        for (const act of day.activities) {
          if (act.poiId) {
            const poi = pois.find((p) => p.id === act.poiId);
            poi?.images?.slice(0, 3).forEach(pushUnique);
          }
          pushUnique(act.thumbnail);
          if (result.length >= 6) return result;
        }
      }
    }
    return result;
  }, [itinerary.days, itinerary.destination, pois, destinations]);

  const [tripHeroIdx, setTripHeroIdx] = useState(0);
  useEffect(() => {
    if (tripHeroImages.length < 2) {
      setTripHeroIdx(0);
      return;
    }
    setTripHeroIdx(0);
    const id = setInterval(() => {
      setTripHeroIdx((i) => (i + 1) % tripHeroImages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [tripHeroImages.length]);

  const tripHeroGradient: [string, string] = useMemo(() => {
    const palette: Array<[string, string]> = [
      ["#3B82F6", "#8B5CF6"],
      ["#F59E0B", "#EF4444"],
      ["#10B981", "#06B6D4"],
      ["#EC4899", "#8B5CF6"],
      ["#6366F1", "#A855F7"],
    ];
    let hash = 0;
    for (let i = 0; i < itinerary.title.length; i++) {
      hash = ((hash << 5) - hash + itinerary.title.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(hash) % palette.length];
  }, [itinerary.title]);

  const tripDateRange = useMemo(() => {
    const fmt = (s: string) => {
      if (!s) return "—";
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}/${iso[2]}`;
      const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (dmy) return `${dmy[1]}/${dmy[2]}`;
      return s.slice(0, 10);
    };
    return `${fmt(itinerary.startDate)} → ${fmt(itinerary.endDate)}`;
  }, [itinerary.startDate, itinerary.endDate]);

  const tripStatusMeta = useMemo(() => {
    switch (itinerary.status) {
      case "active":
        return { color: "#10B981", icon: "play-circle" as const, label: getStatusLabel("active") };
      case "completed":
        return {
          color: "#6B7280",
          icon: "checkmark-circle" as const,
          label: getStatusLabel("completed"),
        };
      default:
        return { color: colors.accent, icon: "create" as const, label: getStatusLabel("draft") };
    }
  }, [itinerary.status, colors.accent]);

  // Use a pure-white surface inside the trip detail screen — user reported
  // the default slate-50 background looks "đục" (slightly off-white) and
  // wanted a cleaner page. Cards still pop because they have a 1px border.
  const detailBg = isDark ? colors.background : "#FFFFFF";
  return (
    <View style={[styles.container, { backgroundColor: detailBg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.tripHero}>
          {tripHeroImages.length > 0 ? (
            <Image
              source={{ uri: tripHeroImages[tripHeroIdx] }}
              style={styles.tripHeroImage}
              contentFit="cover"
              transition={350}
            />
          ) : (
            <LinearGradient
              colors={tripHeroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tripHeroImage}
            >
              <Ionicons name="map" size={72} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.75)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          {tripHeroImages.length > 1 && (
            <View style={styles.tripHeroDots}>
              {tripHeroImages.map((_, i) => (
                <Pressable key={i} onPress={() => setTripHeroIdx(i)} hitSlop={6}>
                  <View
                    style={[
                      styles.tripHeroDot,
                      i === tripHeroIdx && styles.tripHeroDotActive,
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.tripHeroTopRow, { paddingTop: insets.top + webTopInset + 8 }]}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)/trips")
              }
              hitSlop={6}
              style={({ pressed }) => [styles.tripHeroBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </Pressable>
            <View style={styles.tripHeroActions}>
              {canEdit && itinerary.status === "draft" && (
                <Pressable
                  onPress={handleEdit}
                  hitSlop={6}
                  style={({ pressed }) => [styles.tripHeroBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="create-outline" size={19} color="#111827" />
                </Pressable>
              )}
              {canShare && itinerary.status !== "completed" && (
                <Pressable
                  onPress={() => {
                    setSharePermission(
                      canShareAsEditor ? itinerary.sharePermission || "viewer" : "viewer",
                    );
                    setShareModal(true);
                  }}
                  hitSlop={6}
                  style={({ pressed }) => [styles.tripHeroBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="person-add-outline" size={19} color="#111827" />
                </Pressable>
              )}
              {isOwner ? (
                <Pressable
                  onPress={handleDelete}
                  hitSlop={6}
                  style={({ pressed }) => [styles.tripHeroBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="trash-outline" size={19} color="#EF4444" />
                </Pressable>
              ) : isCompanion ? (
                <Pressable
                  onPress={handleLeaveTrip}
                  hitSlop={6}
                  style={({ pressed }) => [styles.tripHeroBtn, { opacity: pressed ? 0.8 : 1 }]}
                >
                  <Ionicons name="log-out-outline" size={19} color="#EF4444" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.tripHeroFooter}>
            <View style={styles.tripHeroChipRow}>
              <View
                style={[styles.tripHeroStatusChip, { backgroundColor: tripStatusMeta.color }]}
              >
                <Ionicons name={tripStatusMeta.icon} size={11} color="#fff" />
                <Text style={styles.tripHeroStatusText}>{tripStatusMeta.label}</Text>
              </View>
              {itinerary.generatedByAi && (
                <View style={styles.tripHeroAiChip}>
                  <Ionicons name="sparkles" size={11} color="#fff" />
                  <Text style={styles.tripHeroStatusText}>AI</Text>
                </View>
              )}
            </View>
            <Text style={styles.tripHeroTitle} numberOfLines={2}>
              {itinerary.title}
            </Text>
            <View style={styles.tripHeroMetaRow}>
              <View style={styles.tripHeroMetaItem}>
                <Ionicons name="location" size={13} color="rgba(255,255,255,0.92)" />
                <Text style={styles.tripHeroMetaText} numberOfLines={1}>
                  {itinerary.destination}
                </Text>
              </View>
              <View style={styles.tripHeroMetaDot} />
              <View style={styles.tripHeroMetaItem}>
                <Ionicons name="calendar" size={13} color="rgba(255,255,255,0.92)" />
                <Text style={styles.tripHeroMetaText}>{tripDateRange}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.flatBlock}>
          <View style={styles.flatStatsRow}>
            <View style={styles.flatStatItem}>
              <Text
                style={[styles.flatStatValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {itinerary.days.length}
              </Text>
              <Text
                style={[styles.flatStatLabel, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                NGÀY
              </Text>
            </View>
            <View style={[styles.flatStatDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.flatStatItem}>
              <Text
                style={[styles.flatStatValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {itinerary.numPeople}
              </Text>
              <Text
                style={[styles.flatStatLabel, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                NGƯỜI
              </Text>
            </View>
            <View style={[styles.flatStatDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.flatStatItem}>
              <Text
                style={[styles.flatStatValue, { color: colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {totalEstimated > 0 ? formatVNDCompact(totalEstimated) : "—"}
              </Text>
              <Text
                style={[styles.flatStatLabel, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                DỰ KIẾN
              </Text>
            </View>
            <View style={[styles.flatStatDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.flatStatItem}>
              <Text
                style={[styles.flatStatValue, { color: colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {itinerary.totalBudget > 0
                  ? formatVNDCompact(itinerary.totalBudget)
                  : "—"}
              </Text>
              <Text
                style={[styles.flatStatLabel, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                NGÂN SÁCH
              </Text>
            </View>
          </View>
        </View>

        {itinerary.startingPoint ? (
          <View style={[styles.flatRow, { borderTopColor: colors.cardBorder }]}>
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={[styles.flatRowLabel, { color: colors.textTertiary }]}>
              Xuất phát
            </Text>
            <Text
              style={[styles.flatRowValue, { color: colors.text }]}
              numberOfLines={1}
            >
              {itinerary.startingPoint}
            </Text>
          </View>
        ) : null}

        {itinerary.totalBudget > 0 && (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab("expenses");
            }}
            style={({ pressed }) => [
              styles.budgetCompactV2,
              { borderTopColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.budgetCompactTopRow}>
              <Text style={[styles.budgetCompactLabel, { color: colors.textTertiary }]}>
                NGÂN SÁCH
              </Text>
              <View style={styles.budgetCompactPctWrap}>
                <Text
                  style={[
                    styles.budgetCompactPercentV2,
                    {
                      color:
                        budgetPercent > 90
                          ? colors.error
                          : budgetPercent > 70
                            ? colors.warning
                            : colors.success,
                    },
                  ]}
                >
                  {budgetPercent.toFixed(0)}%
                </Text>
              </View>
            </View>
            <Text
              style={[styles.budgetCompactValueV2, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {formatVND(totalSpent)}
              <Text
                style={[styles.budgetCompactValueSlash, { color: colors.textTertiary }]}
              >
                {" / "}
                {formatVND(itinerary.totalBudget)}
              </Text>
            </Text>
            <Text
              style={[
                styles.budgetCompactRemaining,
                {
                  color: remaining >= 0 ? colors.success : colors.error,
                  marginTop: -2,
                },
              ]}
              numberOfLines={1}
            >
              {remaining >= 0 ? "Còn " : "Vượt "}
              {formatVND(Math.abs(remaining))}
            </Text>
            <View
              style={[
                styles.budgetCompactTrackV2,
                { backgroundColor: colors.inputBg },
              ]}
            >
              <View
                style={[
                  styles.budgetCompactFill,
                  {
                    width: `${Math.min(budgetPercent, 100)}%` as any,
                    backgroundColor:
                      budgetPercent > 90
                        ? colors.error
                        : budgetPercent > 70
                          ? colors.warning
                          : colors.success,
                  },
                ]}
              />
            </View>
          </Pressable>
        )}

        {canEdit && (() => {
          const accent =
            itinerary.status === "draft"
              ? colors.primary
              : itinerary.status === "active"
                ? colors.success
                : "#6366F1";
          return (
          <Pressable
            onPress={handleStatusChange}
            style={({ pressed }) => [
              styles.flatStatusRow,
              {
                // Solid accent so the button reads as actionable instead of
                // looking "trong suốt"/passive. White text on top.
                backgroundColor: accent,
                borderColor: accent,
                opacity: pressed ? 0.85 : 1,
                shadowColor: accent,
                shadowOpacity: 0.25,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              },
            ]}
          >
            <Ionicons
              name={
                itinerary.status === "draft"
                  ? "play-circle"
                  : itinerary.status === "active"
                    ? "checkmark-circle"
                    : "refresh-circle"
              }
              size={22}
              color="#fff"
            />
            <Text style={[styles.flatStatusText, { color: "#fff" }]}>
              {itinerary.status === "draft"
                ? txt.startTrip
                : itinerary.status === "active"
                  ? txt.complete
                  : txt.reset}
            </Text>
          </Pressable>
          );
        })()}

        {itinerary.preferences.length > 0 && (
          <View style={styles.prefRow}>
            {itinerary.preferences.map((p) => (
              <View key={p} style={[styles.prefChip, { backgroundColor: colors.tagBg }]}>
                <Text style={[styles.prefChipText, { color: colors.tagText }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { borderBottomColor: colors.cardBorder }]}
          contentContainerStyle={styles.tabBarInner}
        >
          {(
            [
              {
                key: "itinerary" as const,
                icon: "calendar" as const,
                label: txt.tabItinerary,
                count: itinerary.days.length,
              },
              {
                key: "expenses" as const,
                icon: "wallet" as const,
                label: txt.tabExpenses,
                count: expenses.length,
              },
              {
                key: "companions" as const,
                icon: "people" as const,
                label: txt.companions,
                count: companions.length,
              },
              {
                key: "tasks" as const,
                icon: "checkbox" as const,
                label: "Việc cần làm",
                count: tasks.filter((t) => !t.isCompleted).length,
              },
            ]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.key);
                }}
                style={({ pressed }) => [
                  styles.tabBtn,
                  { opacity: !isActive && pressed ? 0.6 : 1 },
                ]}
              >
                <View style={styles.tabBtnRow}>
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: isActive ? colors.text : colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <Text
                      style={[
                        styles.tabBtnCount,
                        {
                          color: isActive ? "#fff" : colors.textSecondary,
                          backgroundColor: isActive
                            ? colors.primary
                            : colors.inputBg,
                        },
                      ]}
                    >
                      {tab.count}
                    </Text>
                  )}
                </View>
                {isActive && (
                  <View
                    style={[
                      styles.tabBtnUnderline,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {activeTab === "itinerary" && (
          <>
            {itinerary.days.map((day, dayIdx) => {
              const displayTitle =
                (day.title || "")
                  .replace(/^Ngày\s*\d+\s*[-–]?\s*/i, "")
                  .trim() || `Lịch trình ngày ${day.day}`;
              const hasMap = day.activities.some(
                (a) => a.latitude != null && a.longitude != null,
              );
              const dayEstCost = day.activities.reduce(
                (s, a) => s + (a.estimatedCost || 0),
                0,
              );
              const tripDateOffset = (() => {
                const m = (itinerary.startDate || "").match(/(\d{4})-(\d{2})-(\d{2})/);
                if (!m) return "";
                const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
                d.setDate(d.getDate() + (day.day - 1));
                return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
                  .toString()
                  .padStart(2, "0")}`;
              })();
              const isCollapsed = collapsedDays.has(dayIdx);
              return (
                <View key={day.day} style={styles.flatDayBlock}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      toggleDayCollapsed(dayIdx);
                    }}
                    style={({ pressed }) => [
                      styles.flatDayHead,
                      {
                        borderBottomColor: colors.cardBorder,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isCollapsed ? "chevron-forward" : "chevron-down"}
                      size={18}
                      color={colors.textTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      {/* Make the day label pop with a warm orange accent —
                          user wanted "tươi sáng hơn", not the teal primary. */}
                      <Text style={[styles.flatDayLabel, { color: colors.accent }]}>
                        NGÀY {day.day}
                        {tripDateOffset ? ` • ${tripDateOffset}` : ""}
                      </Text>
                      <Text
                        style={[styles.flatDayTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {displayTitle}
                      </Text>
                      <Text
                        style={[styles.flatDayMeta, { color: colors.textTertiary }]}
                        numberOfLines={1}
                      >
                        {day.activities.length} hoạt động
                        {dayEstCost > 0 ? ` • ${formatVND(dayEstCost)}` : ""}
                      </Text>
                    </View>
                  </Pressable>

                  {!isCollapsed && (hasMap || canEdit) &&
                    (itinerary.status === "draft" || itinerary.status === "active" || hasMap) && (
                      <View style={styles.dayQuickActions}>
                        {hasMap && (
                          <Pressable
                            onPress={() => setRouteMapModal({ dayIdx })}
                            hitSlop={4}
                            style={({ pressed }) => [
                              styles.dayQuickAction,
                              {
                                backgroundColor: colors.primary + "10",
                                opacity: pressed ? 0.7 : 1,
                              },
                            ]}
                          >
                            <Ionicons name="map" size={14} color={colors.primary} />
                            <Text
                              style={[
                                styles.dayQuickActionText,
                                { color: colors.primary },
                              ]}
                            >
                              Xem bản đồ
                            </Text>
                          </Pressable>
                        )}
                        {canEdit &&
                          (itinerary.status === "draft" ||
                            itinerary.status === "active") &&
                          day.activities.length > 1 && (
                            <Pressable
                              onPress={() => autoSortDay(dayIdx)}
                              hitSlop={4}
                              style={({ pressed }) => [
                                styles.dayQuickAction,
                                {
                                  // Bright accent-tinted background so the
                                  // button reads as actionable (was washed-
                                  // out gray and looked disabled).
                                  backgroundColor: colors.accent + "18",
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}
                            >
                              <Ionicons
                                name="sparkles"
                                size={14}
                                color={colors.accent}
                              />
                              <Text
                                style={[
                                  styles.dayQuickActionText,
                                  { color: colors.accent },
                                ]}
                              >
                                Tự sắp xếp
                              </Text>
                            </Pressable>
                          )}
                      </View>
                    )}

                  {!isCollapsed && (
                <View style={styles.activitiesList}>
                    {day.activities.map((activity, actIdx) => (
                      <React.Fragment key={activity.id}>
                        {actIdx > 0 && (
                          <TravelConnector
                            from={day.activities[actIdx - 1]}
                            to={activity}
                            colors={colors}
                          />
                        )}
                        <Swipeable
                          enabled={
                            canEdit &&
                            (itinerary.status === "draft" ||
                              itinerary.status === "active")
                          }
                          renderLeftActions={() => {
                            if (itinerary.status !== "active") return null;
                            return (
                              <View
                                style={[
                                  styles.swipeLeftAction,
                                  {
                                    backgroundColor: activity.isCompleted
                                      ? colors.textTertiary
                                      : colors.success,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name={
                                    activity.isCompleted
                                      ? "ellipse-outline"
                                      : "checkmark-circle"
                                  }
                                  size={24}
                                  color="#fff"
                                />
                                <Text style={styles.swipeActionText}>
                                  {activity.isCompleted ? "Bỏ đánh dấu" : "Hoàn thành"}
                                </Text>
                              </View>
                            );
                          }}
                          renderRightActions={() => {
                            const canDel =
                              canEdit &&
                              (itinerary.status === "draft" ||
                                (itinerary.status === "active" && !activity.isCompleted));
                            if (!canDel) return null;
                            return (
                              <View
                                style={[
                                  styles.swipeRightAction,
                                  { backgroundColor: colors.error },
                                ]}
                              >
                                <Ionicons name="trash" size={24} color="#fff" />
                                <Text style={styles.swipeActionText}>Xoá</Text>
                              </View>
                            );
                          }}
                          onSwipeableWillOpen={(direction) => {
                            if (direction === "left" && itinerary.status === "active") {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              toggleActivityComplete(dayIdx, activity.id);
                              setTimeout(() => activitySwipeRefs.current[activity.id]?.close(), 250);
                            } else if (direction === "right") {
                              const canDel =
                                canEdit &&
                                (itinerary.status === "draft" ||
                                  (itinerary.status === "active" && !activity.isCompleted));
                              if (canDel) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                deleteActivity(dayIdx, activity.id);
                              } else {
                                setTimeout(() => activitySwipeRefs.current[activity.id]?.close(), 250);
                              }
                            }
                          }}
                          ref={(r) => {
                            if (r) activitySwipeRefs.current[activity.id] = r;
                          }}
                          friction={1.6}
                          overshootLeft={false}
                          overshootRight={false}
                          leftThreshold={60}
                          rightThreshold={60}
                          // Match the page background so the swipe action
                          // panel (green / red) stays hidden behind the row
                          // until the user actually drags. Transparent here
                          // let the action color leak through and looked
                          // washed-out.
                          containerStyle={{ backgroundColor: detailBg }}
                        >
                        <View
                          style={[
                            styles.activityCard,
                            {
                              backgroundColor: detailBg,
                              borderBottomColor: colors.cardBorder,
                            },
                          ]}
                        >
                          <View style={styles.activityTop}>
                            {(() => {
                              const t = activity.activityType || "";
                              const catTone: Record<string, { bg: string; icon: any }> = {
                                food: { bg: "#F59E0B", icon: "restaurant" },
                                restaurant: { bg: "#F59E0B", icon: "restaurant" },
                                cafe: { bg: "#F97316", icon: "cafe" },
                                attraction: { bg: "#3B82F6", icon: "camera" },
                                sightseeing: { bg: "#3B82F6", icon: "camera" },
                                hotel: { bg: "#EC4899", icon: "bed" },
                                accommodation: { bg: "#EC4899", icon: "bed" },
                                transport: { bg: "#10B981", icon: "car" },
                                transit: { bg: "#10B981", icon: "car" },
                                shopping: { bg: "#A855F7", icon: "bag" },
                              };
                              const tone = catTone[t] || {
                                bg: colors.textTertiary,
                                icon: "ellipse",
                              };
                              const canToggle =
                                itinerary.status === "active" && canEdit;
                              const showCheck =
                                (itinerary.status === "active" ||
                                  itinerary.status === "completed") &&
                                activity.isCompleted;
                              return (
                                <View style={styles.activityRail}>
                                  <Text
                                    style={[
                                      styles.activityRailNum,
                                      { color: colors.textTertiary },
                                    ]}
                                  >
                                    {actIdx + 1}
                                  </Text>
                                  {canToggle ? (
                                    <Pressable
                                      onPress={() => {
                                        Haptics.impactAsync(
                                          Haptics.ImpactFeedbackStyle.Light,
                                        );
                                        toggleActivityComplete(dayIdx, activity.id);
                                      }}
                                      hitSlop={10}
                                      style={({ pressed }) => [
                                        styles.activityCatDot,
                                        {
                                          backgroundColor: activity.isCompleted
                                            ? colors.success
                                            : tone.bg,
                                          opacity: pressed ? 0.7 : 1,
                                        },
                                      ]}
                                    >
                                      <Ionicons
                                        name={
                                          activity.isCompleted
                                            ? "checkmark"
                                            : (tone.icon as any)
                                        }
                                        size={14}
                                        color="#fff"
                                      />
                                    </Pressable>
                                  ) : (
                                    <View
                                      style={[
                                        styles.activityCatDot,
                                        {
                                          backgroundColor: showCheck
                                            ? colors.success
                                            : tone.bg,
                                        },
                                      ]}
                                    >
                                      <Ionicons
                                        name={
                                          showCheck ? "checkmark" : (tone.icon as any)
                                        }
                                        size={14}
                                        color="#fff"
                                      />
                                    </View>
                                  )}
                                </View>
                              );
                            })()}
                            <View style={{ flex: 1 }}>
                              <Pressable
                                onPress={() => {
                                  const canEditTime =
                                    canEdit &&
                                    (itinerary.status === "draft" ||
                                      (itinerary.status === "active" && !activity.isCompleted));
                                  if (canEditTime)
                                    setTimeModal({
                                      activityId: activity.id,
                                      dayIdx,
                                      time: activity.time,
                                    });
                                }}
                                hitSlop={4}
                              >
                                <Text
                                  style={[
                                    styles.activityTimeFlat,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  {activity.time}
                                  {activity.duration
                                    ? ` · ${formatDuration(activity.duration)}`
                                    : ""}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setExpandedReviewIds(new Set());
                                  setShowAllUserReviews(false);
                                  setActivityDetailModal(activity);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.activityTitleFlat,
                                    {
                                      color: activity.isCompleted
                                        ? colors.textTertiary
                                        : colors.text,
                                      textDecorationLine: activity.isCompleted
                                        ? "line-through"
                                        : "none",
                                    },
                                  ]}
                                  numberOfLines={2}
                                >
                                  {activity.title}
                                </Text>
                              </Pressable>
                              {!!activity.address && (
                                <Text
                                  style={[
                                    styles.activityAddrFlat,
                                    { color: colors.textTertiary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {activity.address}
                                </Text>
                              )}
                              {(() => {
                                const linkedPOI = activity.poiId
                                  ? pois.find((p) => p.id === activity.poiId)
                                  : null;
                                const openHrs =
                                  activity.openHours || linkedPOI?.openHours || "";
                                const chips: Array<{
                                  key: string;
                                  icon: any;
                                  color: string;
                                  bg: string;
                                  text: string;
                                }> = [];
                                if (activity.rating && activity.rating > 0) {
                                  chips.push({
                                    key: "rating",
                                    icon: "star",
                                    color: "#B45309",
                                    bg: "#FEF3C7",
                                    text: `${activity.rating.toFixed(1)}${
                                      activity.reviewCount
                                        ? ` (${activity.reviewCount})`
                                        : ""
                                    }`,
                                  });
                                }
                                if (openHrs) {
                                  chips.push({
                                    key: "hours",
                                    icon: "time",
                                    color: "#BE185D",
                                    bg: "#FCE7F3",
                                    text: openHrs,
                                  });
                                }
                                if (activity.estimatedCost > 0) {
                                  chips.push({
                                    key: "cost",
                                    icon: "cash",
                                    color: "#047857",
                                    bg: "#D1FAE5",
                                    text: formatVND(activity.estimatedCost),
                                  });
                                }
                                if (chips.length === 0) return null;
                                return (
                                  <View style={styles.activityChipsRow}>
                                    {chips.map((c) => (
                                      <View
                                        key={c.key}
                                        style={[
                                          styles.activityChip,
                                          { backgroundColor: c.bg },
                                        ]}
                                      >
                                        <Ionicons name={c.icon} size={10} color={c.color} />
                                        <Text
                                          style={[styles.activityChipText, { color: c.color }]}
                                          numberOfLines={1}
                                        >
                                          {c.text}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                );
                              })()}
                            </View>
                            {(() => {
                              const linkedPOI = activity.poiId
                                ? pois.find((p) => p.id === activity.poiId)
                                : null;
                              const linkedDest = activity.destinationId
                                ? destinations.find((d) => d.id === activity.destinationId)
                                : null;
                              const thumb =
                                activity.thumbnail ||
                                linkedPOI?.images?.[0] ||
                                linkedDest?.images?.[0];
                              if (!thumb) return null;
                              return (
                                <Image
                                  source={{ uri: thumb }}
                                  style={styles.activityThumb}
                                  contentFit="cover"
                                  transition={150}
                                />
                              );
                            })()}
                            {(canEdit ||
                              (activity.latitude != null && activity.longitude != null)) && (
                              <Pressable
                                onPress={() => {
                                  Haptics.selectionAsync();
                                  setActivityMenu({
                                    activity,
                                    dayIdx,
                                    actIdx,
                                    total: day.activities.length,
                                  });
                                }}
                                hitSlop={8}
                                style={({ pressed }) => [
                                  styles.activityMenuBtn,
                                  { opacity: pressed ? 0.6 : 1 },
                                ]}
                              >
                                <Ionicons
                                  name="ellipsis-vertical"
                                  size={18}
                                  color={colors.textTertiary}
                                />
                              </Pressable>
                            )}
                          </View>

                          {itinerary.status !== "draft" &&
                            ((activity.actualCost !== undefined &&
                              activity.actualCost > 0) ||
                              activity.paidBy) && (
                              <View style={styles.activityActualRow}>
                                {activity.actualCost !== undefined &&
                                  activity.actualCost > 0 && (
                                    <View style={styles.activityActualChip}>
                                      <Ionicons
                                        name="cash"
                                        size={11}
                                        color={colors.accent}
                                      />
                                      <Text
                                        style={[
                                          styles.activityActualText,
                                          { color: colors.accent },
                                        ]}
                                      >
                                        Thực chi {formatVND(activity.actualCost)}
                                      </Text>
                                    </View>
                                  )}
                                {activity.paidBy && (
                                  <View style={styles.activityActualChip}>
                                    <Ionicons
                                      name="person"
                                      size={11}
                                      color={colors.textSecondary}
                                    />
                                    <Text
                                      style={[
                                        styles.activityActualText,
                                        { color: colors.textSecondary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {activity.paidBy}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}

                          {(() => {
                            const actReview = getActivityReview(activity.id);
                            if (actReview && itinerary.status !== "draft") {
                              return (
                                <View
                                  style={[styles.reviewBox, { backgroundColor: colors.inputBg }]}
                                >
                                  <View style={styles.reviewBoxHeader}>
                                    <Ionicons name="star" size={14} color="#F59E0B" />
                                    <Text style={[styles.reviewBoxRating, { color: colors.text }]}>
                                      {actReview.rating}/5
                                    </Text>
                                    <Text
                                      style={[
                                        styles.reviewBoxComment,
                                        { color: colors.textSecondary },
                                      ]}
                                      numberOfLines={2}
                                    >
                                      {actReview.comment
                                        .replace(/\s*\[activity:[^\]]+\]/, "")
                                        .replace(/\s*\[resetBefore:\d+\]/, "")}
                                    </Text>
                                  </View>
                                  <View style={styles.reviewBoxActions}>
                                    <Pressable
                                      onPress={() =>
                                        openReviewModal(activity.id, dayIdx, actReview.id)
                                      }
                                      hitSlop={6}
                                    >
                                      <Ionicons
                                        name="create-outline"
                                        size={14}
                                        color={colors.primary}
                                      />
                                    </Pressable>
                                    <Pressable
                                      onPress={() => handleDeleteActivityReview(actReview.id)}
                                      hitSlop={6}
                                    >
                                      <Ionicons
                                        name="trash-outline"
                                        size={14}
                                        color={colors.error}
                                      />
                                    </Pressable>
                                  </View>
                                </View>
                              );
                            }
                            return null;
                          })()}

                          {/* Other users' POI reviews */}
                          {(() => {
                            const otherReviews = getOtherUsersPoiReviews(activity);
                            if (otherReviews.length === 0) return null;
                            return (
                              <View style={{ marginHorizontal: 12, marginBottom: 8 }}>
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    marginBottom: 4,
                                  }}
                                >
                                  <Ionicons
                                    name="people-outline"
                                    size={13}
                                    color={colors.textTertiary}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontFamily: "Inter_500Medium",
                                      color: colors.textTertiary,
                                    }}
                                  >
                                    Đánh giá từ người khác ({otherReviews.length})
                                  </Text>
                                </View>
                                {otherReviews.slice(0, 2).map((r) => {
                                  const cleanComment = r.comment
                                    .replace(/\s*\[activity:[^\]]+\]/g, "")
                                    .replace(/\s*\[resetBefore:[^\]]+\]/g, "")
                                    .trim();
                                  return (
                                    <View
                                      key={r.id}
                                      style={{
                                        flexDirection: "row",
                                        gap: 8,
                                        paddingVertical: 4,
                                        paddingHorizontal: 6,
                                        borderRadius: 8,
                                        backgroundColor: colors.inputBg,
                                        marginBottom: 4,
                                      }}
                                    >
                                      <View
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: 12,
                                          backgroundColor: colors.primary + "30",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontFamily: "Inter_600SemiBold",
                                            color: colors.primary,
                                          }}
                                        >
                                          {r.userName.charAt(0).toUpperCase()}
                                        </Text>
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontFamily: "Inter_600SemiBold",
                                              color: colors.text,
                                            }}
                                            numberOfLines={1}
                                          >
                                            {r.userName}
                                          </Text>
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: 2,
                                            }}
                                          >
                                            <Ionicons name="star" size={10} color="#F59E0B" />
                                            <Text
                                              style={{
                                                fontSize: 10,
                                                fontFamily: "Inter_600SemiBold",
                                                color: "#F59E0B",
                                              }}
                                            >
                                              {r.rating}
                                            </Text>
                                          </View>
                                        </View>
                                        {cleanComment ? (
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontFamily: "Inter_400Regular",
                                              color: colors.textSecondary,
                                              marginTop: 1,
                                            }}
                                            numberOfLines={2}
                                          >
                                            {cleanComment}
                                          </Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  );
                                })}
                                {otherReviews.length > 2 && (
                                  <Pressable
                                    onPress={() => {
                                      setExpandedReviewIds(new Set());
                                      setShowAllUserReviews(false);
                                      setActivityDetailModal(activity);
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontFamily: "Inter_500Medium",
                                        color: colors.primary,
                                        textAlign: "center",
                                        marginTop: 2,
                                      }}
                                    >
                                      Xem thêm {otherReviews.length - 2} đánh giá ›
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            );
                          })()}

                          {getActivityNotes(activity).length > 0 && (
                            <View style={styles.notesContainer}>
                              {getActivityNotes(activity).map((noteItem, noteIdx) => (
                                // Notion / Wanderlog-style sticky note: warm
                                // amber paper background, thick left accent
                                // bar, "Ghi chú" eyebrow label, tap row to
                                // edit, trailing trash for delete. The old
                                // inline icon row read like form chrome
                                // rather than content.
                                <Pressable
                                  key={noteIdx}
                                  onPress={() => {
                                    if (!canEdit) return;
                                    Haptics.selectionAsync();
                                    setNoteModal({
                                      activityId: activity.id,
                                      dayIdx,
                                      note: noteItem,
                                      editIndex: noteIdx,
                                    });
                                  }}
                                  style={({ pressed }) => [
                                    styles.noteSticky,
                                    {
                                      backgroundColor: "#FEF3C7",
                                      opacity: pressed && canEdit ? 0.85 : 1,
                                    },
                                  ]}
                                >
                                  <View style={styles.noteStickyHead}>
                                    <Ionicons
                                      name="bookmark"
                                      size={11}
                                      color="#B45309"
                                    />
                                    <Text style={styles.noteStickyLabel}>
                                      GHI CHÚ
                                    </Text>
                                    {canEdit && (
                                      <Pressable
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          deleteNote(dayIdx, activity.id, noteIdx);
                                        }}
                                        hitSlop={8}
                                        style={{ marginLeft: "auto", padding: 2 }}
                                      >
                                        <Ionicons
                                          name="trash-outline"
                                          size={13}
                                          color="#B45309"
                                        />
                                      </Pressable>
                                    )}
                                  </View>
                                  <Text style={styles.noteStickyText}>
                                    {noteItem}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          )}

                          {itinerary.status !== "draft" &&
                            canEdit &&
                            activity.isCompleted &&
                            !getActivityReview(activity.id) && (
                              <Pressable
                                onPress={() => openReviewModal(activity.id, dayIdx)}
                                style={({ pressed }) => [
                                  styles.activityReviewCta,
                                  {
                                    borderColor: colors.primary + "40",
                                    opacity: pressed ? 0.7 : 1,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name="star-outline"
                                  size={14}
                                  color={colors.primary}
                                />
                                <Text
                                  style={[
                                    styles.activityReviewCtaText,
                                    { color: colors.primary },
                                  ]}
                                >
                                  Đánh giá địa điểm này
                                </Text>
                              </Pressable>
                            )}
                        </View>
                        </Swipeable>
                      </React.Fragment>
                    ))}

                    {canEdit && (itinerary.status === "draft" || itinerary.status === "active") && (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setAddPlaceModal({ dayIdx });
                        }}
                        style={({ pressed }) => [
                          styles.addPlaceFlat,
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <Ionicons name="add" size={18} color={colors.primary} />
                        <Text style={[styles.addPlaceFlatText, { color: colors.primary }]}>
                          {txt.addPlace}
                        </Text>
                      </Pressable>
                    )}
                    {canEdit &&
                      (itinerary.status === "draft" || itinerary.status === "active") &&
                      itinerary.days.length > 1 &&
                      !day.activities.some((a) => a.isCompleted) && (
                        <Pressable
                          onPress={async () => {
                            const doDelete = async () => {
                              const newDays = itinerary.days
                                .filter((_, i) => i !== dayIdx)
                                .map((d, i) => ({ ...d, day: i + 1, title: `Ngày ${i + 1}` }));
                              const startDate = parseTripStartDate(itinerary.startDate);
                              const newEnd = new Date(startDate);
                              newEnd.setDate(newEnd.getDate() + newDays.length - 1);
                              const endStr = formatDateVN(newEnd);
                              const newSpent = recalcSpent(newDays, expenses);
                              await updateItinerary(itinerary.id, {
                                days: newDays,
                                endDate: endStr,
                                spentAmount: newSpent,
                              });
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            };
                            const ok = await confirm({
                              title: "Xóa ngày?",
                              message: `Bạn có chắc muốn xóa ${day.title} cùng tất cả hoạt động bên trong?`,
                              destructive: true,
                              confirmText: t().common.delete,
                            });
                            if (ok) doDelete();
                          }}
                          style={({ pressed }) => [
                            styles.removeDayFlat,
                            { opacity: pressed ? 0.6 : 1 },
                          ]}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={colors.error}
                          />
                          <Text style={[styles.removeDayFlatText, { color: colors.error }]}>
                            Xóa ngày {day.day}
                          </Text>
                        </Pressable>
                      )}
                  </View>
                  )}
                </View>
              );
            })}
            {/* Add Day button: draft or active trips */}
            {canEdit && (itinerary.status === "draft" || itinerary.status === "active") && (
              <Pressable
                onPress={async () => {
                  const newDayNum = itinerary.days.length + 1;
                  const newDays = [
                    ...itinerary.days,
                    { day: newDayNum, title: `Ngày ${newDayNum}`, activities: [] },
                  ];
                  const startDate = parseTripStartDate(itinerary.startDate);
                  const newEnd = new Date(startDate);
                  newEnd.setDate(newEnd.getDate() + newDays.length - 1);
                  const endStr = formatDateVN(newEnd);
                  await updateItinerary(itinerary.id, { days: newDays, endDate: endStr });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                style={({ pressed }) => [
                  styles.addDayDashed,
                  { borderColor: colors.primary + "55", opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={[styles.addDayDashedText, { color: colors.primary }]}>
                  Thêm ngày mới
                </Text>
              </Pressable>
            )}
          </>
        )}

        {activeTab === "expenses" && (
          <View style={styles.expensesTab}>
            <View
              style={[
                styles.expSubtab,
                { backgroundColor: colors.inputBg },
              ]}
            >
              {(["overview", "balance"] as const).map((k) => {
                const active = expenseSubtab === k;
                const label = k === "overview" ? "Tổng quan" : "Chia tiền";
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setExpenseSubtab(k);
                    }}
                    style={({ pressed }) => [
                      styles.expSubtabBtn,
                      active && {
                        backgroundColor: colors.card,
                        shadowColor: "#000",
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 2,
                      },
                      { opacity: !active && pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.expSubtabText,
                        {
                          color: active ? colors.text : colors.textSecondary,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {expenseSubtab === "overview" && (() => {
              const totalBudgetExp = itinerary.totalBudget || 0;
              const remainingExp = totalBudgetExp - totalSpent;
              const pctExp = totalBudgetExp > 0 ? (totalSpent / totalBudgetExp) * 100 : 0;
              const catColors: Record<string, { bg: string; fg: string; label: string }> = {
                food: { bg: "#FEF3C7", fg: "#B45309", label: "Ăn uống" },
                restaurant: { bg: "#FEF3C7", fg: "#B45309", label: "Ăn uống" },
                transport: { bg: "#DBEAFE", fg: "#1D4ED8", label: "Di chuyển" },
                transit: { bg: "#DBEAFE", fg: "#1D4ED8", label: "Di chuyển" },
                hotel: { bg: "#EDE9FE", fg: "#5B21B6", label: "Lưu trú" },
                accommodation: { bg: "#EDE9FE", fg: "#5B21B6", label: "Lưu trú" },
                sightseeing: { bg: "#D1FAE5", fg: "#047857", label: "Tham quan" },
                attraction: { bg: "#D1FAE5", fg: "#047857", label: "Tham quan" },
                shopping: { bg: "#FCE7F3", fg: "#BE185D", label: "Mua sắm" },
                other: { bg: "#F3F4F6", fg: "#374151", label: "Khác" },
              };
              const catTotals: Record<string, number> = {};
              for (const day of itinerary.days) {
                for (const a of day.activities) {
                  const k = a.activityType || "other";
                  catTotals[k] = (catTotals[k] || 0) + (a.actualCost || 0);
                }
              }
              for (const e of expenses) {
                const k = e.type || "other";
                catTotals[k] = (catTotals[k] || 0) + e.amount;
              }
              const catList = Object.entries(catTotals)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4);
              const catSum = catList.reduce((s, [, v]) => s + v, 0);
              return (
                <View style={styles.expHero}>
                  <View style={styles.expHeroTopV2}>
                    <Text style={[styles.expHeroLabel, { color: colors.textTertiary }]}>
                      TỔNG ĐÃ CHI
                    </Text>
                    {totalBudgetExp > 0 && (
                      <View
                        style={[
                          styles.expHeroPctChip,
                          {
                            backgroundColor:
                              pctExp > 90
                                ? colors.error + "18"
                                : pctExp > 70
                                  ? colors.warning + "18"
                                  : colors.success + "18",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.expHeroPctText,
                            {
                              color:
                                pctExp > 90
                                  ? colors.error
                                  : pctExp > 70
                                    ? colors.warning
                                    : colors.success,
                            },
                          ]}
                        >
                          {pctExp.toFixed(0)}%
                        </Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      // Toggle full VND view (TODO: actual modal — for now just haptic)
                    }}
                  >
                    <Text
                      style={[styles.expHeroValueV2, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.55}
                    >
                      {formatVND(totalSpent)}
                      {totalBudgetExp > 0 && (
                        <Text
                          style={[styles.expHeroValueSlash, { color: colors.textTertiary }]}
                        >
                          {" / "}
                          {formatVND(totalBudgetExp)}
                        </Text>
                      )}
                    </Text>
                  </Pressable>
                  {totalBudgetExp > 0 && (
                    <>
                      <View
                        style={[styles.expHeroTrackV2, { backgroundColor: colors.inputBg }]}
                      >
                        <View
                          style={[
                            styles.expHeroFill,
                            {
                              width: `${Math.min(pctExp, 100)}%` as any,
                              backgroundColor:
                                pctExp > 90
                                  ? colors.error
                                  : pctExp > 70
                                    ? colors.warning
                                    : colors.success,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.expHeroFootRow}>
                        <Text
                          style={[
                            styles.expHeroFootText,
                            { color: colors.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {remainingExp >= 0 ? "Còn lại " : "Vượt "}
                          <Text
                            style={{
                              fontFamily: "Inter_700Bold",
                              color: remainingExp >= 0 ? colors.success : colors.error,
                            }}
                          >
                            {formatVND(Math.abs(remainingExp))}
                          </Text>
                        </Text>
                      </View>
                    </>
                  )}
                  {catList.length > 0 && (
                    <View style={styles.expCatList}>
                      {catList.map(([key, val]) => {
                        const tone =
                          catColors[key] ||
                          { bg: colors.primary + "18", fg: colors.primary, label: key };
                        const pct = catSum > 0 ? (val / catSum) * 100 : 0;
                        return (
                          <View key={key} style={styles.expCatRow}>
                            <View style={[styles.expCatDot, { backgroundColor: tone.fg }]} />
                            <Text
                              style={[
                                styles.expCatLabel,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {tone.label}
                            </Text>
                            <View
                              style={[
                                styles.expCatBarTrack,
                                { backgroundColor: colors.inputBg },
                              ]}
                            >
                              <View
                                style={[
                                  styles.expCatBarFill,
                                  {
                                    width: `${pct}%` as any,
                                    backgroundColor: tone.fg,
                                  },
                                ]}
                              />
                            </View>
                            <Text
                              style={[styles.expCatValue, { color: colors.text }]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.6}
                            >
                              {formatVND(val)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })()}
            {expenseSubtab === "overview" && itinerary.status === "completed" &&
              (() => {
                // Calculate stats
                const allActivities = itinerary.days.flatMap((day, dayIdx) =>
                  day.activities.map((act) => ({ ...act, _dayIdx: dayIdx, _dayTitle: day.title })),
                );
                const totalActEstimated = allActivities.reduce(
                  (s, a) => s + (a.estimatedCost || 0),
                  0,
                );
                const totalActActual = allActivities.reduce((s, a) => s + (a.actualCost || 0), 0);
                // Filter manual expenses (not activity-linked ones)
                const manualExps = manualExpenses;
                const totalExpAmount = manualExpenses.reduce((s, e) => s + e.amount, 0);
                const grandTotal = totalActActual + totalExpAmount;
                const budget = itinerary.totalBudget || 0;
                const budgetPct = budget > 0 ? Math.min(100, (grandTotal / budget) * 100) : 0;
                const diff = budget - grandTotal;

                // Stats by category
                const catMap: Record<string, number> = {};
                for (const a of allActivities) {
                  const cat = a.expenseTypeId?.toString() || a.activityType || "other";
                  catMap[cat] = (catMap[cat] || 0) + (a.actualCost || 0);
                }
                for (const e of manualExps) {
                  const cat = e.expenseTypeId?.toString() || e.type || "other";
                  catMap[cat] = (catMap[cat] || 0) + e.amount;
                }
                const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

                // Stats by payer
                const payerMap: Record<string, number> = {};
                for (const a of allActivities) {
                  if (a.paidBy && (a.actualCost || 0) > 0) {
                    payerMap[a.paidBy] = (payerMap[a.paidBy] || 0) + (a.actualCost || 0);
                  }
                }
                for (const e of manualExps) {
                  if (e.paidBy && e.amount > 0) {
                    payerMap[e.paidBy] = (payerMap[e.paidBy] || 0) + e.amount;
                  }
                }
                const payerEntries = Object.entries(payerMap).sort((a, b) => b[1] - a[1]);

                const catColors: Record<string, string> = {
                  food: "#FF6B6B",
                  sightseeing: "#4ECDC4",
                  transport: "#45B7D1",
                  shopping: "#FFA07A",
                  other: "#9B59B6",
                  "1": "#FF6B6B", // Food
                  "2": "#45B7D1", // Transport
                  "3": "#FFA07A", // Shopping
                  "4": "#4ECDC4", // Sightseeing
                  "5": "#9B59B6", // Other
                };
                const payerColors = [
                  "#6C5CE7",
                  "#00B894",
                  "#FDCB6E",
                  "#E17055",
                  "#0984E3",
                  "#D63031",
                  "#00CEC9",
                  "#E84393",
                ];

                const toggleSection = (key: string) =>
                  setSummaryCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

                const saveInlineEdit = async () => {
                  if (!editingSummaryRow) return;
                  setSummaryPaidByDropdown(false);
                  const newDays = [...itinerary.days];
                  const act = newDays[editingSummaryRow.dayIdx].activities.find(
                    (a) => a.id === editingSummaryRow.actId,
                  );

                  if (act) {
                    const amount = parseInt(editingSummaryRow.cost.replace(/[^0-9]/g, ""), 10) || 0;
                    const paidByName = editingSummaryRow.paidBy.trim();

                    // Find matching user ID from companions or current user
                    let paidByUserId = undefined;
                    if (paidByName) {
                      const comp = (itinerary.companions || []).find(
                        (c) => c.userName === paidByName,
                      );
                      if (comp) {
                        paidByUserId = comp.userId;
                      } else if (user?.fullName === paidByName || user?.username === paidByName) {
                        paidByUserId = user.id.toString();
                      }
                    }

                    act.actualCost = amount;
                    act.paidBy = paidByName || undefined;

                    // Sync corresponding expense
                    const newExpenses = [...expenses];
                    const expIdx = newExpenses.findIndex((e) => e.activityId === act.id.toString());
                    if (expIdx !== -1) {
                      newExpenses[expIdx] = {
                        ...newExpenses[expIdx],
                        amount,
                        paidBy: paidByName || undefined,
                        paidByUserId: paidByUserId,
                      };
                    }

                    const newSpent = recalcSpent(newDays, newExpenses);
                    await updateItinerary(itinerary.id, {
                      days: newDays,
                      expenses: newExpenses,
                      spentAmount: newSpent,
                    });
                  }
                  setEditingSummaryRow(null);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                };

                return (
                  <View
                    style={[
                      sumStyles.container,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                  >
                    {/* Header */}
                    <View style={sumStyles.header}>
                      <Ionicons name="stats-chart" size={20} color={colors.primary} />
                      <Text style={[sumStyles.headerTitle, { color: colors.text }]}>
                        {txt.expenseSummary}
                      </Text>
                    </View>

                    {/* ── 1. Budget Overview ── */}
                    <Pressable
                      onPress={() => toggleSection("budget")}
                      style={sumStyles.sectionHeader}
                    >
                      <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                      <Text style={[sumStyles.sectionTitle, { color: colors.text }]}>
                        {txt.budgetOverview}
                      </Text>
                      <Ionicons
                        name={summaryCollapsed.budget ? "chevron-down" : "chevron-up"}
                        size={16}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                    {!summaryCollapsed.budget && (
                      <View style={sumStyles.sectionBody}>
                        <View style={sumStyles.budgetRow}>
                          <Text style={[sumStyles.budgetLabel, { color: colors.textSecondary }]}>
                            {txt.totalBudget}
                          </Text>
                          <Text style={[sumStyles.budgetValue, { color: colors.text }]}>
                            {formatVND(budget)}
                          </Text>
                        </View>
                        <View style={sumStyles.budgetRow}>
                          <Text style={[sumStyles.budgetLabel, { color: colors.textSecondary }]}>
                            {txt.budgetUsed}
                          </Text>
                          <Text style={[sumStyles.budgetValue, { color: colors.text }]}>
                            {formatVND(grandTotal)} ({budgetPct.toFixed(0)}%)
                          </Text>
                        </View>
                        <View style={[sumStyles.progressBg, { backgroundColor: colors.inputBg }]}>
                          <View
                            style={[
                              sumStyles.progressFill,
                              {
                                width: `${Math.min(100, budgetPct)}%`,
                                backgroundColor: diff >= 0 ? "#00B894" : colors.error,
                              },
                            ]}
                          />
                        </View>
                        <View style={sumStyles.budgetRow}>
                          <Text
                            style={[
                              sumStyles.budgetLabel,
                              { color: diff >= 0 ? "#00B894" : colors.error },
                            ]}
                          >
                            {diff >= 0 ? txt.underBudget : txt.overBudget}
                          </Text>
                          <Text
                            style={[
                              sumStyles.budgetValue,
                              {
                                color: diff >= 0 ? "#00B894" : colors.error,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            {diff >= 0 ? "+" : ""}
                            {formatVND(diff)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* ── 2. Activity Expenses Table ── */}
                    <Pressable
                      onPress={() => toggleSection("activities")}
                      style={sumStyles.sectionHeader}
                    >
                      <Ionicons name="list-outline" size={16} color={colors.primary} />
                      <Text style={[sumStyles.sectionTitle, { color: colors.text }]}>
                        {txt.activityExpenses} ({allActivities.length})
                      </Text>
                      <Ionicons
                        name={summaryCollapsed.activities ? "chevron-down" : "chevron-up"}
                        size={16}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                    {!summaryCollapsed.activities && (
                      <View style={sumStyles.sectionBody}>
                        {/* Table header */}
                        <View
                          style={[
                            sumStyles.tableRow,
                            sumStyles.tableHeaderRow,
                            { backgroundColor: colors.primary + "10" },
                          ]}
                        >
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellDay,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {txt.dayLabel}
                          </Text>
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellName,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {txt.activityLabel}
                          </Text>
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellCost,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {txt.estimated}
                          </Text>
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellCost,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {txt.actual}
                          </Text>
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellPayer,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {txt.payer}
                          </Text>
                          <View style={sumStyles.cellAction} />
                        </View>
                        {/* Table body */}
                        {allActivities.map((act, idx) => {
                          const isEditing = editingSummaryRow?.actId === act.id;
                          return (
                            <View
                              key={act.id}
                              style={[
                                sumStyles.tableRow,
                                {
                                  backgroundColor:
                                    idx % 2 === 0 ? "transparent" : colors.inputBg + "40",
                                  zIndex: isEditing && summaryPaidByDropdown ? 9999 : 0,
                                  overflow: "visible" as any,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  sumStyles.tdCell,
                                  sumStyles.cellDay,
                                  { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                Ngày {act._dayIdx + 1}
                              </Text>
                              <View style={sumStyles.cellName}>
                                <Text
                                  style={[sumStyles.tdCell, { color: colors.text }]}
                                  numberOfLines={1}
                                >
                                  {act.title}
                                </Text>
                                <Text style={[sumStyles.tdCellSub, { color: colors.textTertiary }]}>
                                  {act.time}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  sumStyles.tdCell,
                                  sumStyles.cellCost,
                                  { color: colors.textTertiary },
                                ]}
                              >
                                {formatVND(act.estimatedCost || 0)}
                              </Text>
                              {isEditing ? (
                                <TextInput
                                  style={[
                                    sumStyles.inlineInput,
                                    sumStyles.cellCost,
                                    {
                                      backgroundColor: colors.inputBg,
                                      borderColor: colors.primary,
                                      color: colors.text,
                                    },
                                  ]}
                                  value={editingSummaryRow.cost}
                                  keyboardType="numeric"
                                  onChangeText={(v) => {
                                    const sanitized = v.replace(/[^0-9]/g, "");
                                    setEditingSummaryRow({ ...editingSummaryRow, cost: sanitized });
                                  }}
                                  selectTextOnFocus
                                />
                              ) : (
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellCost,
                                    { color: colors.text, fontFamily: "Inter_600SemiBold" },
                                  ]}
                                >
                                  {formatVND(act.actualCost || 0)}
                                </Text>
                              )}
                              {isEditing ? (
                                <View
                                  style={{
                                    position: "relative",
                                    zIndex: summaryPaidByDropdown ? 9999 : 0,
                                  }}
                                >
                                  <Pressable
                                    onPress={() => setSummaryPaidByDropdown(!summaryPaidByDropdown)}
                                    style={[
                                      sumStyles.cellPayer,
                                      {
                                        backgroundColor: colors.inputBg,
                                        borderColor: colors.primary,
                                        borderWidth: 1,
                                        borderRadius: 6,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 2,
                                        paddingHorizontal: 4,
                                        paddingVertical: 4,
                                        minWidth: 70,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontFamily: "Inter_400Regular",
                                        color: editingSummaryRow.paidBy
                                          ? colors.text
                                          : colors.textTertiary,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {editingSummaryRow.paidBy || txt.payer}
                                    </Text>
                                    <Ionicons
                                      name={summaryPaidByDropdown ? "chevron-up" : "chevron-down"}
                                      size={10}
                                      color={colors.textSecondary}
                                    />
                                  </Pressable>
                                  {summaryPaidByDropdown && (
                                    <View
                                      style={[
                                        styles.dropdownList,
                                        {
                                          backgroundColor: colors.card,
                                          borderColor: colors.inputBorder,
                                          position: "absolute",
                                          top: "100%",
                                          right: 0,
                                          minWidth: 160,
                                          zIndex: 9999,
                                          elevation: 10,
                                          ...(Platform.OS === "web"
                                            ? ({ boxShadow: "0 4px 20px rgba(0,0,0,0.25)" } as any)
                                            : {
                                                shadowColor: "#000",
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.25,
                                                shadowRadius: 10,
                                              }),
                                        },
                                      ]}
                                    >
                                      {tripMembers.map((m) => (
                                        <Pressable
                                          key={m.userId}
                                          onPress={() => {
                                            setEditingSummaryRow({
                                              ...editingSummaryRow,
                                              paidBy: m.userName,
                                            });
                                            setSummaryPaidByDropdown(false);
                                          }}
                                          style={[
                                            styles.dropdownItem,
                                            editingSummaryRow.paidBy === m.userName && {
                                              backgroundColor: colors.primary + "15",
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.dropdownItemText,
                                              { color: colors.text },
                                            ]}
                                          >
                                            {m.userName}
                                            {m.isOwner ? " 👑" : ""}
                                          </Text>
                                          {editingSummaryRow.paidBy === m.userName && (
                                            <Ionicons
                                              name="checkmark"
                                              size={14}
                                              color={colors.primary}
                                            />
                                          )}
                                        </Pressable>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              ) : (
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellPayer,
                                    {
                                      color: act.paidBy
                                        ? colors.textSecondary
                                        : colors.textTertiary,
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {act.paidBy || "—"}
                                </Text>
                              )}
                              <View style={sumStyles.cellAction}>
                                {isEditing ? (
                                  <Pressable onPress={saveInlineEdit} hitSlop={6}>
                                    <Ionicons name="checkmark-circle" size={20} color={"#00B894"} />
                                  </Pressable>
                                ) : (
                                  canEdit &&
                                  itinerary.status !== "completed" && (
                                    <Pressable
                                      onPress={() => {
                                        setSummaryPaidByDropdown(false);
                                        setEditingSummaryRow({
                                          dayIdx: act._dayIdx,
                                          actId: act.id,
                                          cost: (act.actualCost || 0).toString(),
                                          paidBy: act.paidBy || "",
                                        });
                                      }}
                                      hitSlop={6}
                                    >
                                      <Ionicons
                                        name="create-outline"
                                        size={16}
                                        color={colors.primary}
                                      />
                                    </Pressable>
                                  )
                                )}
                              </View>
                            </View>
                          );
                        })}
                        {/* Total row */}
                        <View
                          style={[
                            sumStyles.tableRow,
                            sumStyles.totalRow,
                            { borderTopColor: colors.cardBorder },
                          ]}
                        >
                          <Text
                            style={[sumStyles.thCell, sumStyles.cellDay, { color: colors.text }]}
                          />
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellName,
                              { color: colors.text, fontFamily: "Inter_700Bold" },
                            ]}
                          >
                            {txt.totalRow}
                          </Text>
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellCost,
                              { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },
                            ]}
                          >
                            {formatVND(totalActEstimated)}
                          </Text>
                          <Text
                            style={[
                              sumStyles.thCell,
                              sumStyles.cellCost,
                              { color: colors.text, fontFamily: "Inter_700Bold" },
                            ]}
                          >
                            {formatVND(totalActActual)}
                          </Text>
                          <Text
                            style={[sumStyles.thCell, sumStyles.cellPayer, { color: colors.text }]}
                          />
                          <View style={sumStyles.cellAction} />
                        </View>
                      </View>
                    )}

                    {/* ── 3. Additional Expenses Table ── */}
                    {manualExps.length > 0 && (
                      <>
                        <Pressable
                          onPress={() => toggleSection("expenses")}
                          style={sumStyles.sectionHeader}
                        >
                          <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                          <Text style={[sumStyles.sectionTitle, { color: colors.text }]}>
                            {txt.additionalExpenses} ({manualExps.length})
                          </Text>
                          <Ionicons
                            name={summaryCollapsed.expenses ? "chevron-down" : "chevron-up"}
                            size={16}
                            color={colors.textTertiary}
                          />
                        </Pressable>
                        {!summaryCollapsed.expenses && (
                          <View style={sumStyles.sectionBody}>
                            <View
                              style={[
                                sumStyles.tableRow,
                                sumStyles.tableHeaderRow,
                                { backgroundColor: colors.primary + "10" },
                              ]}
                            >
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellName,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {txt.activityLabel}
                              </Text>
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellType,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {txt.expenseType}
                              </Text>
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellCost,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {txt.expenseAmount}
                              </Text>
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellPayer,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {txt.payer}
                              </Text>
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellSplit,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {txt.splitInfo}
                              </Text>
                              <View style={sumStyles.cellAction} />
                            </View>
                            {manualExps.map((exp: any, idx: number) => (
                              <View
                                key={exp.id}
                                style={[
                                  sumStyles.tableRow,
                                  {
                                    backgroundColor:
                                      idx % 2 === 0 ? "transparent" : colors.inputBg + "40",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellName,
                                    { color: colors.text },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {exp.title}
                                </Text>
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellType,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  {getActivityTypeLabel(
                                    exp.expenseTypeId?.toString() || exp.type,
                                    expenseTypes,
                                  )}
                                </Text>
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellCost,
                                    { color: colors.text, fontFamily: "Inter_600SemiBold" },
                                  ]}
                                >
                                  {formatVND(exp.amount)}
                                </Text>
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellPayer,
                                    {
                                      color: exp.paidBy
                                        ? colors.textSecondary
                                        : colors.textTertiary,
                                    },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {exp.paidBy || "—"}
                                </Text>
                                <Text
                                  style={[
                                    sumStyles.tdCell,
                                    sumStyles.cellSplit,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  {exp.splitType === "equal"
                                    ? txt.splitEqual
                                    : exp.splitType === "custom"
                                      ? txt.splitCustom
                                      : txt.noSplit}
                                </Text>
                                <View style={sumStyles.cellAction}>
                                  {canEdit && itinerary.status !== "completed" && (
                                    <Pressable onPress={() => openEditExpense(exp)} hitSlop={6}>
                                      <Ionicons
                                        name="create-outline"
                                        size={16}
                                        color={colors.primary}
                                      />
                                    </Pressable>
                                  )}
                                </View>
                              </View>
                            ))}
                            <View
                              style={[
                                sumStyles.tableRow,
                                sumStyles.totalRow,
                                { borderTopColor: colors.cardBorder },
                              ]}
                            >
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellName,
                                  { color: colors.text, fontFamily: "Inter_700Bold" },
                                ]}
                              >
                                {txt.totalRow}
                              </Text>
                              <Text style={[sumStyles.thCell, sumStyles.cellType]} />
                              <Text
                                style={[
                                  sumStyles.thCell,
                                  sumStyles.cellCost,
                                  { color: colors.text, fontFamily: "Inter_700Bold" },
                                ]}
                              >
                                {formatVND(totalExpAmount)}
                              </Text>
                              <Text style={[sumStyles.thCell, sumStyles.cellPayer]} />
                              <Text style={[sumStyles.thCell, sumStyles.cellSplit]} />
                              <View style={sumStyles.cellAction} />
                            </View>
                          </View>
                        )}
                      </>
                    )}

                    {/* ── 4. Stats by Category ── */}
                    {catEntries.length > 0 && (
                      <>
                        <Pressable
                          onPress={() => toggleSection("category")}
                          style={sumStyles.sectionHeader}
                        >
                          <Ionicons name="pie-chart-outline" size={16} color={colors.primary} />
                          <Text style={[sumStyles.sectionTitle, { color: colors.text }]}>
                            {txt.byCategory}
                          </Text>
                          <Ionicons
                            name={summaryCollapsed.category ? "chevron-down" : "chevron-up"}
                            size={16}
                            color={colors.textTertiary}
                          />
                        </Pressable>
                        {!summaryCollapsed.category && (
                          <View style={sumStyles.sectionBody}>
                            {catEntries.map(([cat, amount]) => {
                              const pct = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
                              const barColor = catColors[cat] || "#999";
                              return (
                                <View key={cat} style={sumStyles.statRow}>
                                  <View style={sumStyles.statLabelRow}>
                                    <View
                                      style={[sumStyles.statDot, { backgroundColor: barColor }]}
                                    />
                                    <Text style={[sumStyles.statLabel, { color: colors.text }]}>
                                      {getActivityTypeLabel(cat, expenseTypes)}
                                    </Text>
                                    <Text
                                      style={[sumStyles.statPct, { color: colors.textTertiary }]}
                                    >
                                      {pct.toFixed(1)}%
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      sumStyles.statBarBg,
                                      { backgroundColor: colors.inputBg },
                                    ]}
                                  >
                                    <View
                                      style={[
                                        sumStyles.statBarFill,
                                        { width: `${pct}%`, backgroundColor: barColor },
                                      ]}
                                    />
                                  </View>
                                  <Text style={[sumStyles.statAmount, { color: colors.text }]}>
                                    {formatVND(amount)}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </>
                    )}

                    {/* ── 5. Stats by Payer ── */}
                    {payerEntries.length > 0 && (
                      <>
                        <Pressable
                          onPress={() => toggleSection("payer")}
                          style={sumStyles.sectionHeader}
                        >
                          <Ionicons name="people-outline" size={16} color={colors.primary} />
                          <Text style={[sumStyles.sectionTitle, { color: colors.text }]}>
                            {txt.byPayer}
                          </Text>
                          <Ionicons
                            name={summaryCollapsed.payer ? "chevron-down" : "chevron-up"}
                            size={16}
                            color={colors.textTertiary}
                          />
                        </Pressable>
                        {!summaryCollapsed.payer && (
                          <View style={sumStyles.sectionBody}>
                            {payerEntries.map(([payer, amount], idx) => {
                              const pct = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
                              const barColor = payerColors[idx % payerColors.length];
                              return (
                                <View key={payer} style={sumStyles.statRow}>
                                  <View style={sumStyles.statLabelRow}>
                                    <View
                                      style={[sumStyles.statDot, { backgroundColor: barColor }]}
                                    />
                                    <Text style={[sumStyles.statLabel, { color: colors.text }]}>
                                      {payer}
                                    </Text>
                                    <Text
                                      style={[sumStyles.statPct, { color: colors.textTertiary }]}
                                    >
                                      {pct.toFixed(1)}%
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      sumStyles.statBarBg,
                                      { backgroundColor: colors.inputBg },
                                    ]}
                                  >
                                    <View
                                      style={[
                                        sumStyles.statBarFill,
                                        { width: `${pct}%`, backgroundColor: barColor },
                                      ]}
                                    />
                                  </View>
                                  <Text style={[sumStyles.statAmount, { color: colors.text }]}>
                                    {formatVND(amount)}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })()}

            {expenseSubtab === "overview" && (expenses.length === 0 ? (
              <View style={styles.emptyExpenses}>
                <Ionicons name="wallet-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  {txt.noExpenses}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                  {txt.noExpensesHint}
                </Text>
              </View>
            ) : (
              (() => {
                const sorted = [...expenses].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                );
                const dayKey = (d: string) => {
                  const dt = new Date(d);
                  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
                };
                const fmtDayHeader = (d: string) => {
                  const dt = new Date(d);
                  const today = new Date();
                  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
                  const yest = new Date(today);
                  yest.setDate(yest.getDate() - 1);
                  const yestKey = `${yest.getFullYear()}-${yest.getMonth()}-${yest.getDate()}`;
                  const dKey = dayKey(d);
                  const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dt.getDay()];
                  const abs = `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}`;
                  if (dKey === todayKey) return `Hôm nay · ${dow} ${abs}`;
                  if (dKey === yestKey) return `Hôm qua · ${dow} ${abs}`;
                  return `${dow} ${abs}`;
                };
                let lastDayKey = "";
                return sorted.map((expense: Expense, idx) => {
                  const expColorMap: Record<string, { bg: string; fg: string }> = {
                    food: { bg: "#FEF3C7", fg: "#B45309" },
                    restaurant: { bg: "#FEF3C7", fg: "#B45309" },
                    shopping: { bg: "#FCE7F3", fg: "#BE185D" },
                    transport: { bg: "#DBEAFE", fg: "#1D4ED8" },
                    sightseeing: { bg: "#D1FAE5", fg: "#047857" },
                    hotel: { bg: "#EDE9FE", fg: "#5B21B6" },
                    accommodation: { bg: "#EDE9FE", fg: "#5B21B6" },
                  };
                  const tone = expColorMap[expense.type] || {
                    bg: colors.primary + "15",
                    fg: colors.primary,
                  };
                  const myId = String(user?.id || "");
                  const isPayer = String(expense.paidByUserId || "") === myId;
                  const mySplit = expense.splits?.find(
                    (sp) => String(sp.userId) === myId,
                  );
                  let myDelta = 0;
                  if (isPayer && expense.splits && expense.splits.length > 0) {
                    myDelta = expense.amount - (mySplit?.amount || 0);
                  } else if (!isPayer && mySplit) {
                    myDelta = -(mySplit.amount || 0);
                  }
                  const curKey = dayKey(expense.createdAt);
                  const showHeader = curKey !== lastDayKey;
                  if (showHeader) {
                    lastDayKey = curKey;
                  }
                  const daySubtotal = sorted
                    .filter((e) => dayKey(e.createdAt) === curKey)
                    .reduce((s, e) => s + e.amount, 0);
                  return (
                    <React.Fragment key={expense.id}>
                      {showHeader && (
                        <View
                          style={[
                            styles.expDayHeader,
                            { borderBottomColor: colors.cardBorder },
                          ]}
                        >
                          <Text
                            style={[
                              styles.expDayHeaderLabel,
                              { color: colors.textTertiary },
                            ]}
                          >
                            {fmtDayHeader(expense.createdAt)}
                          </Text>
                          <Text
                            style={[
                              styles.expDayHeaderTotal,
                              { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {formatVND(daySubtotal)}
                          </Text>
                        </View>
                      )}
                      {(() => {
                        return (
                  <View
                    key={expense.id}
                    style={[
                      styles.expenseCard,
                      { borderBottomColor: colors.cardBorder },
                    ]}
                  >
                    <View style={styles.expenseTopV2}>
                      <View style={[styles.expenseIconCircle, { backgroundColor: tone.bg }]}>
                        <Ionicons
                          name={getActivityTypeIcon(expense.type) as any}
                          size={18}
                          color={tone.fg}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.expenseTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {expense.title}
                        </Text>
                        <View style={styles.expenseMetaV2}>
                          <Text style={[styles.expenseMetaText, { color: colors.textTertiary }]}>
                            {new Date(expense.createdAt).toLocaleDateString("vi-VN")}
                          </Text>
                          <View
                            style={[
                              styles.expenseChip,
                              { backgroundColor: tone.bg },
                            ]}
                          >
                            <Text style={[styles.expenseChipText, { color: tone.fg }]}>
                              {getActivityTypeLabel(
                                expense.expenseTypeId?.toString() || expense.type,
                                expenseTypes,
                              )}
                            </Text>
                          </View>
                          {expense.splitType && expense.splitType !== "none" && (
                            <View
                              style={[
                                styles.expenseChip,
                                { backgroundColor: colors.primary + "15" },
                              ]}
                            >
                              <Ionicons
                                name="people-outline"
                                size={10}
                                color={colors.primary}
                              />
                              <Text
                                style={[styles.expenseChipText, { color: colors.primary }]}
                              >
                                {expense.splitType === "equal" ? txt.splitEqual : txt.splitCustom}
                              </Text>
                            </View>
                          )}
                        </View>
                        {expense.paidBy && (
                          <Text
                            style={[styles.expensePaidBy, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {txt.paidBy}: {expense.paidBy}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text
                          style={[styles.expenseAmount, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {formatVND(expense.amount)}
                        </Text>
                        {myDelta !== 0 && (
                          <Text
                            style={[
                              styles.expenseDeltaText,
                              {
                                color: myDelta > 0 ? colors.success : colors.error,
                              },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                          >
                            {myDelta > 0 ? "Bạn cho mượn " : "Bạn nợ "}
                            {formatVND(Math.abs(myDelta))}
                          </Text>
                        )}
                      </View>
                    </View>

                  {expense.splits && expense.splits.length > 0 && (() => {
                    const splits = expense.splits;
                    const palette = [
                      "#4F46E5",
                      "#0EA5E9",
                      "#10B981",
                      "#F59E0B",
                      "#EF4444",
                      "#8B5CF6",
                      "#EC4899",
                    ];
                    const hashColor = (s: string) => {
                      let h = 0;
                      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
                      return palette[Math.abs(h) % palette.length];
                    };
                    const allEqual = splits.every((sp) => sp.amount === splits[0].amount);
                    const visible = splits.slice(0, 3);
                    const extra = Math.max(splits.length - 3, 0);
                    return (
                      <Pressable
                        onPress={() => setExpenseMenu(expense)}
                        style={({ pressed }) => [
                          styles.splitSummary,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <View style={styles.splitAvatarStack}>
                          {visible.map((sp, idx) => {
                            // Prefer the real profile avatar from the trip
                            // members list so the same person appears
                            // identically everywhere; fall back to a
                            // stable hash-colored initial.
                            const member = tripMembers.find(
                              (m) => String(m.userId) === String(sp.userId),
                            );
                            const avatarUrl = (member as any)?.avatarUrl as
                              | string
                              | null
                              | undefined;
                            return avatarUrl ? (
                              <Image
                                key={sp.userId}
                                source={{ uri: avatarUrl }}
                                style={[
                                  styles.splitAvatar,
                                  {
                                    marginLeft: idx === 0 ? 0 : -8,
                                    borderColor: colors.card,
                                  },
                                ]}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                key={sp.userId}
                                style={[
                                  styles.splitAvatar,
                                  {
                                    backgroundColor: hashColor(sp.userName),
                                    marginLeft: idx === 0 ? 0 : -8,
                                    borderColor: colors.card,
                                  },
                                ]}
                              >
                                <Text style={styles.splitAvatarText}>
                                  {(sp.userName || "?").charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            );
                          })}
                          {extra > 0 && (
                            <View
                              style={[
                                styles.splitAvatar,
                                {
                                  backgroundColor: colors.textTertiary,
                                  marginLeft: -8,
                                  borderColor: colors.card,
                                },
                              ]}
                            >
                              <Text style={styles.splitAvatarText}>+{extra}</Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[styles.splitSummaryText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {(() => {
                            const type = expense.splitType as
                              | "none"
                              | "equal"
                              | "custom"
                              | undefined;
                            const totalMembers =
                              (itinerary.companions?.length ?? 0) + 1;
                            const splitCount = splits.length;
                            const includesAll = splitCount >= totalMembers;
                            const min = Math.min(...splits.map((s) => s.amount));
                            const max = Math.max(...splits.map((s) => s.amount));
                            const sum = splits.reduce((s, p) => s + p.amount, 0);
                            const expectedEqual = Math.round(sum / splitCount);
                            const trulyEqual = splits.every(
                              (sp) => Math.abs(sp.amount - expectedEqual) <= 1,
                            );
                            const whoLabel = includesAll
                              ? `${splitCount} người`
                              : `${splitCount}/${totalMembers} người`;
                            // CASE 1 — Không chia
                            if (!type || type === "none" || splitCount === 0) {
                              return "Không chia · 1 người chịu";
                            }
                            // CASE 2 — Chia đều, gồm tất cả thành viên
                            if (type === "equal") {
                              return `Chia đều ${whoLabel} · ${formatVND(splits[0].amount)}/người`;
                            }
                            // CASE 3 — Chia cá nhân, các trường hợp con:
                            // 3a) hết người, số tiền bằng nhau → giống "chia đều"
                            // 3b) hết người, số tiền khác nhau → "Chia cá nhân X người · min → max"
                            // 3c) ko hết người (chỉ chọn 1 vài), bằng nhau → "Chỉ X/Y người · 100k/người"
                            // 3d) ko hết người, khác nhau → "Chỉ X/Y người · min → max"
                            if (type === "custom") {
                              if (trulyEqual) {
                                return `Chia cá nhân ${whoLabel} · ${formatVND(splits[0].amount)}/người`;
                              }
                              return `Chia cá nhân ${whoLabel} · ${formatVND(min)} → ${formatVND(max)}`;
                            }
                            // Legacy fallback
                            return trulyEqual
                              ? `Chia ${whoLabel} · ${formatVND(splits[0].amount)}/người`
                              : `Chia ${whoLabel} · ${formatVND(min)} → ${formatVND(max)}`;
                          })()}
                        </Text>
                      </Pressable>
                    );
                  })()}

                  {expense.notes && expense.notes.length > 0 && (
                    <View style={styles.notesContainer}>
                      {expense.notes.map((noteItem: string, noteIdx: number) => (
                        <View
                          key={noteIdx}
                          style={[styles.noteBox, { backgroundColor: colors.inputBg }]}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={14}
                            color={colors.textSecondary}
                          />
                          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                            {noteItem}
                          </Text>
                          {canEdit && itinerary.status !== "completed" && (
                            <>
                              <Pressable
                                onPress={() =>
                                  setExpenseNoteModal({
                                    expenseId: expense.id,
                                    note: noteItem,
                                    editIndex: noteIdx,
                                  })
                                }
                                hitSlop={6}
                              >
                                <Ionicons name="create-outline" size={14} color={colors.primary} />
                              </Pressable>
                              <Pressable
                                onPress={() => deleteExpenseNote(expense.id, noteIdx)}
                                hitSlop={6}
                              >
                                <Ionicons
                                  name="close-circle-outline"
                                  size={14}
                                  color={colors.error}
                                />
                              </Pressable>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {canEdit && (
                    // Always show the ⋯ button (even when the trip is
                    // completed). Read actions like "Xem ghi chú" stay
                    // useful; write actions are guarded at save time so the
                    // user still sees a tap target instead of an empty row.
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExpenseMenu(expense);
                      }}
                      hitSlop={12}
                      style={({ pressed }) => [
                        styles.expenseMenuBtn,
                        { opacity: pressed ? 0.5 : 1 },
                      ]}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  )}
                  </View>
                        );
                      })()}
                    </React.Fragment>
                  );
                });
              })()
            ))}

            {expenseSubtab === "balance" && expenses.filter(
              (e) => e.splits && e.splits.length > 0 && e.paidByUserId,
            ).length === 0 && (
              <View style={styles.emptyExpenses}>
                <Ionicons name="git-compare-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  Chưa có khoản chia tiền
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                  Khi nhóm có chi phí chia, số dư giữa các thành viên sẽ hiện ở đây
                </Text>
              </View>
            )}
            {expenseSubtab === "balance" && (() => {
              const expensesWithSplits = expenses.filter(
                (e) => e.splits && e.splits.length > 0 && e.paidByUserId,
              );
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

              const settlements: {
                from: string;
                fromName: string;
                to: string;
                toName: string;
                amount: number;
              }[] = [];
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

              // Export report handler
              const handleExportReport = async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const totalExpenseAmount = expenses.reduce((s, e) => s + e.amount, 0);

                // Group expenses by type
                const byType: Record<string, number> = {};
                for (const e of expenses) {
                  const label = getActivityTypeLabel(e.type);
                  byType[label] = (byType[label] || 0) + e.amount;
                }

                const report = [
                  txt.exportReportTitle,
                  `━━━━━━━━━━━━━━━━━━━━`,
                  `✈️ ${itinerary.title}`,
                  `📍 ${itinerary.destination}`,
                  `🗓 ${itinerary.startDate} → ${itinerary.endDate}`,
                  `👥 ${itinerary.numPeople} người`,
                  `💰 ${txt.totalBudget}: ${formatVND(itinerary.totalBudget || 0)}`,
                  ``,
                  `📋 ${txt.totalExpenses}: ${formatVND(totalExpenseAmount)}`,
                  ...Object.entries(byType).map(
                    ([type, amount]) => `   • ${type}: ${formatVND(amount)}`,
                  ),
                  ``,
                  `🔄 ${txt.settlement}:`,
                  ...settlements.map(
                    (s) => `   • ${s.fromName} → ${s.toName}: ${formatVND(s.amount)}`,
                  ),
                  ``,
                  `📅 ${txt.reportDate}: ${new Date().toLocaleDateString("vi-VN")}`,
                ].join("\n");

                try {
                  if (Platform.OS === "web") {
                    try {
                      await navigator.clipboard.writeText(report);
                    } catch {
                      /* fallback */
                    }
                    window.alert(txt.reportCopied);
                  } else {
                    await Share.share({ message: report, title: txt.exportReportTitle });
                  }
                } catch (e) {
                  console.log("Export report error:", e);
                }
              };

              // Debt reminder handler — wrap each send in try/catch so one
              // failing recipient doesn't silently kill the whole batch.
              const handleDebtReminder = async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (settlements.length === 0) {
                  const msg = "Không có khoản nợ nào để nhắc.";
                  if (Platform.OS === "web") window.alert(msg);
                  else Alert.alert("", msg);
                  return;
                }
                let sentCount = 0;
                let failedCount = 0;
                for (const s of settlements) {
                  try {
                    await addNotification({
                      userId: s.from,
                      title: txt.debtReminderTitle,
                      message: txt.debtReminderMsg(
                        s.fromName,
                        s.toName,
                        formatVND(s.amount),
                        itinerary.title,
                      ),
                      type: "warning",
                      itineraryId: itinerary.id,
                    });
                    await addNotification({
                      userId: s.to,
                      title: txt.debtReminderTitle,
                      message: `${s.fromName} đã được nhắc nhở thanh toán ${formatVND(s.amount)} cho bạn từ chuyến đi "${itinerary.title}"`,
                      type: "info",
                      itineraryId: itinerary.id,
                    });
                    sentCount++;
                  } catch (err) {
                    console.warn("Debt reminder send failed:", err);
                    failedCount++;
                  }
                }
                Haptics.notificationAsync(
                  failedCount > 0
                    ? Haptics.NotificationFeedbackType.Warning
                    : Haptics.NotificationFeedbackType.Success,
                );
                const summary =
                  failedCount === 0
                    ? `${txt.debtReminderSent} (${sentCount} khoản nợ)`
                    : `Gửi được ${sentCount}/${settlements.length} khoản. ${failedCount} khoản gặp lỗi.`;
                if (Platform.OS === "web") window.alert(summary);
                else Alert.alert("", summary);
              };

              return (
                <View style={styles.settlementCard}>
                  <View style={styles.settlementHeader}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
                    <Text style={[styles.settlementTitle, { color: colors.text }]}>
                      {txt.settlement}
                    </Text>
                  </View>
                  {settlements.map((s, idx) => {
                    // Pull the debtor's profile avatar from the canonical
                    // trip members list so the face matches everywhere
                    // (Companions tab, invite popup, etc).
                    const fromMember = tripMembers.find(
                      (m) => String(m.userId) === String(s.from),
                    );
                    const fromAvatarUrl = (fromMember as any)?.avatarUrl as
                      | string
                      | null
                      | undefined;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.settlementRowV2,
                          { borderBottomColor: colors.cardBorder },
                        ]}
                      >
                        {fromAvatarUrl ? (
                          <Image
                            source={{ uri: fromAvatarUrl }}
                            style={styles.settlementAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.settlementAvatar,
                              { backgroundColor: avatarColorFor(String(s.from)) },
                            ]}
                          >
                            <Text style={styles.settlementAvatarText}>
                              {(s.fromName || "?").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[styles.settlementName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {s.fromName}
                          </Text>
                          <Text
                            style={[styles.settlementArrow, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            → {s.toName}
                          </Text>
                        </View>
                        <Text
                          style={[styles.settlementAmount, { color: colors.error }]}
                          numberOfLines={1}
                        >
                          {formatVND(s.amount)}
                        </Text>
                      </View>
                    );
                  })}

                  {/* Export & Reminder Buttons */}
                  <View style={styles.settlementActions}>
                    <Pressable
                      onPress={handleExportReport}
                      style={[
                        styles.settlementBtn,
                        {
                          backgroundColor: colors.primary + "12",
                          borderColor: colors.primary + "30",
                        },
                      ]}
                    >
                      <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                      <Text style={[styles.settlementBtnText, { color: colors.primary }]}>
                        {txt.exportReport}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDebtReminder}
                      style={[
                        styles.settlementBtn,
                        {
                          backgroundColor: colors.accent + "12",
                          borderColor: colors.accent + "30",
                        },
                      ]}
                    >
                      <Ionicons name="notifications-outline" size={16} color={colors.accent} />
                      <Text style={[styles.settlementBtnText, { color: colors.accent }]}>
                        {txt.debtReminder}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })()}

          </View>
        )}

        {activeTab === "companions" && (
          <View style={{ gap: 14 }}>
            {false && canShare && (
              <View style={styles.cmpShareBlock}>
                {/* Removed per user request — invite-via-link lives in the
                    invite popup now; the Companions tab focuses on the
                    member list. */}
                <View style={{ display: "none" }}>
                  <Pressable
                    onPress={() => {}}
                    style={({ pressed }) => [
                      styles.cmpChannel,
                      {
                        borderColor: colors.cardBorder,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.cmpChannelIcon,
                        { backgroundColor: "#0068FF18" },
                      ]}
                    >
                      <Ionicons name="chatbubble" size={16} color="#0068FF" />
                    </View>
                    <Text style={[styles.cmpChannelText, { color: colors.text }]}>
                      Zalo
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {}}
                    style={({ pressed }) => [
                      styles.cmpChannel,
                      {
                        borderColor: colors.cardBorder,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.cmpChannelIcon,
                        { backgroundColor: colors.text + "12" },
                      ]}
                    >
                      <Ionicons name="qr-code" size={16} color={colors.text} />
                    </View>
                    <Text style={[styles.cmpChannelText, { color: colors.text }]}>
                      Mã QR
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {}}
                    style={({ pressed }) => [
                      styles.cmpChannel,
                      {
                        borderColor: colors.cardBorder,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.cmpChannelIcon,
                        { backgroundColor: colors.accent + "18" },
                      ]}
                    >
                      <Ionicons name="mail" size={16} color={colors.accent} />
                    </View>
                    <Text style={[styles.cmpChannelText, { color: colors.text }]}>
                      Email
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View
              style={[
                styles.flatSectionHead,
                { borderTopColor: colors.cardBorder, borderBottomColor: colors.cardBorder },
              ]}
            >
              <Text style={[styles.flatSectionLabel, { color: colors.textTertiary }]}>
                THÀNH VIÊN
              </Text>
              <Text style={[styles.flatSectionCount, { color: colors.text }]}>
                {tripMembers.length}
              </Text>
            </View>

            {tripMembers.map((m, i) => {
                const avatarColors = [
                  "#4F46E5",
                  "#0EA5E9",
                  "#10B981",
                  "#F59E0B",
                  "#EF4444",
                  "#8B5CF6",
                ];
                const bg = avatarColors[i % avatarColors.length];
                const companion = companions.find((c) => c.userId === m.userId);
                return (
                  <View
                    key={m.userId}
                    style={[
                      styles.memberCard,
                      i < tripMembers.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.cardBorder,
                      },
                    ]}
                  >
                    {m.avatarUrl ? (
                      <Image
                        source={{ uri: m.avatarUrl }}
                        style={styles.memberAvatarLg}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View style={[styles.memberAvatarLg, { backgroundColor: bg }]}>
                        <Text style={styles.memberAvatarText}>
                          {m.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <Text
                        style={[styles.memberName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {m.userName}
                      </Text>
                      {(() => {
                        if (m.isOwner) return null;
                        if (!companion?.joinedAt) return null;
                        const joined = new Date(companion.joinedAt);
                        const now = new Date();
                        const diffDay = Math.floor(
                          (now.getTime() - joined.getTime()) / (24 * 60 * 60 * 1000),
                        );
                        const label =
                          diffDay < 1
                            ? "Tham gia hôm nay"
                            : diffDay === 1
                              ? "Tham gia hôm qua"
                              : diffDay < 30
                                ? `Tham gia ${diffDay} ngày trước`
                                : `Tham gia ${joined.getDate().toString().padStart(2, "0")}/${(joined.getMonth() + 1).toString().padStart(2, "0")}/${joined.getFullYear()}`;
                        return (
                          <Text
                            style={[styles.memberJoinedAt, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                        );
                      })()}
                      <View style={styles.memberRoleRow}>
                        <View
                          style={[
                            styles.memberRoleChip,
                            {
                              backgroundColor: m.isOwner
                                ? "#FEF3C7"
                                : companion?.role === "editor"
                                  ? colors.primary + "18"
                                  : colors.textTertiary + "20",
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              m.isOwner
                                ? "shield-checkmark"
                                : companion?.role === "editor"
                                  ? "create-outline"
                                  : "eye-outline"
                            }
                            size={10}
                            color={
                              m.isOwner
                                ? "#B45309"
                                : companion?.role === "editor"
                                  ? colors.primary
                                  : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.memberRoleChipText,
                              {
                                color: m.isOwner
                                  ? "#B45309"
                                  : companion?.role === "editor"
                                    ? colors.primary
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            {m.isOwner
                              ? "Chủ chuyến đi"
                              : companion?.role === "editor"
                                ? txt.editor
                                : txt.viewer}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {isOwner && !m.isOwner && companion && (
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setMemberMenu({ companion, member: m });
                        }}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.memberMenuBtn,
                          { opacity: pressed ? 0.5 : 1 },
                        ]}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    )}
                  </View>
                );
              })}

            {/* Leave-trip button — only show for actual joined members. The
                previous version reused `flatStatusRow` (now solid orange)
                which made the destructive button look like a primary CTA. */}
            {isCompanion && !isOwner && (
              <Pressable
                onPress={handleLeaveTrip}
                style={({ pressed }) => [
                  styles.leaveTripBtn,
                  {
                    backgroundColor: colors.error + "12",
                    borderColor: colors.error + "40",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                <Text style={[styles.leaveTripBtnText, { color: colors.error }]}>
                  {txt.leaveTrip}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {activeTab === "tasks" && (
          <TasksTab
            tasks={tasks}
            isLoading={tasksQuery.isLoading}
            filter={taskFilter}
            setFilter={setTaskFilter}
            colors={colors}
            canEdit={canEdit}
            tripMembers={tripMembers}
            openCreate={() =>
              setTaskModal({
                title: "",
                description: "",
                category: "prep",
                assigneeUserId: "",
                dueDate: "",
              })
            }
            openEdit={(task) =>
              setTaskModal({
                editId: task.id,
                title: task.title,
                description: task.description || "",
                category: (task.category as any) || "",
                assigneeUserId: task.assigneeUserId || "",
                // Pass full ISO so the picker can restore both date AND time.
                dueDate: task.dueDate || "",
              })
            }
            toggleComplete={(task) => {
              updateTaskMut.mutate({
                taskId: task.id,
                data: { isCompleted: !task.isCompleted },
              });
              Haptics.selectionAsync();
            }}
            onDelete={async (task) => {
              const ok = await confirm({
                title: "Xoá việc cần làm?",
                message: `"${task.title}" sẽ bị xoá.`,
                destructive: true,
                confirmText: t().common.delete,
              });
              if (!ok) return;
              deleteTaskMut.mutate(task.id);
            }}
            onClearCompleted={async () => {
              const ok = await confirm({
                title: "Dọn việc đã xong?",
                message: "Tất cả việc đã đánh dấu hoàn thành sẽ bị xoá.",
                destructive: true,
                confirmText: "Dọn",
              });
              if (ok) clearCompletedTasksMut.mutate();
            }}
          />
        )}
      </ScrollView>

      {((activeTab === "expenses" &&
        canEdit &&
        itinerary.status !== "completed") ||
        (activeTab === "tasks" && canEdit)) && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (activeTab === "tasks") {
              setTaskModal({
                title: "",
                description: "",
                category: "prep",
                assigneeUserId: "",
                dueDate: "",
              });
            } else {
              setExpenseModal({});
            }
          }}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}

      <Modal
        visible={!!noteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteModal(null)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setNoteModal(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheetContent, { backgroundColor: colors.card }]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Pressable
                onPress={() => setNoteModal(null)}
                hitSlop={8}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {noteModal?.editIndex !== undefined ? txt.editNote : txt.addNote}
              </Text>
              <Pressable
                onPress={saveNote}
                hitSlop={8}
                disabled={!(noteModal?.note || "").trim()}
              >
                <Text
                  style={[
                    styles.sheetSaveLink,
                    {
                      color: (noteModal?.note || "").trim()
                        ? colors.primary
                        : colors.textTertiary,
                    },
                  ]}
                >
                  Lưu
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.sheetTextarea,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                },
              ]}
              value={noteModal?.note || ""}
              onChangeText={(v) => noteModal && setNoteModal({ ...noteModal, note: v })}
              placeholder={txt.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!costModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCostModal(null);
          setCostPaidByDropdown(false);
          setCostSplitType("none");
          setCostSplitChecked({});
          setCostSplitAmounts({});
        }}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => {
            setCostModal(null);
            setCostPaidByDropdown(false);
            setCostSplitType("none");
            setCostSplitChecked({});
            setCostSplitAmounts({});
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheetContent,
              { backgroundColor: colors.card, maxHeight: "92%" as any },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Pressable
                onPress={() => {
                  setCostModal(null);
                  setCostPaidByDropdown(false);
                  setCostSplitType("none");
                  setCostSplitChecked({});
                  setCostSplitAmounts({});
                }}
                hitSlop={8}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {txt.activityCosts}
              </Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Activity title (read-only) */}
              {costModal?.activityTitle && (
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  value={costModal.activityTitle}
                  editable={false}
                />
              )}
              {/* Estimated cost: editable in draft, active unchecked */}
              {(() => {
                if (!costModal) return null;
                const act = itinerary.days[costModal.dayIdx]?.activities.find(
                  (a) => a.id === costModal.activityId,
                );
                const canEditEst =
                  itinerary.status === "draft" ||
                  (itinerary.status === "active" && act && !act.isCompleted);
                if (!canEditEst) return null;
                return (
                  <>
                    <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                      {txt.estimatedCost} (VNĐ)
                    </Text>
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          color: colors.text,
                          backgroundColor: colors.inputBg,
                          borderColor: colors.inputBorder,
                        },
                      ]}
                      value={costModal?.estimatedCost || ""}
                      onChangeText={(v) => {
                        if (costModal) {
                          const sanitized = v.replace(/[^0-9]/g, "");
                          setCostModal({ ...costModal, estimatedCost: sanitized });
                        }
                      }}
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
                  <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                    {txt.actualCost} (VNĐ)
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        color: colors.text,
                        backgroundColor: colors.inputBg,
                        borderColor: colors.inputBorder,
                      },
                    ]}
                    value={costModal?.cost || ""}
                    onChangeText={(v) => {
                      if (costModal) {
                        const sanitized = v.replace(/[^0-9]/g, "");
                        setCostModal({ ...costModal, cost: sanitized });
                      }
                    }}
                    placeholder="VD: 500000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* Loại chi phí (Category Selector) */}
              <Text style={[styles.modalSubLabel, { color: colors.textSecondary, marginTop: 8 }]}>
                {txt.expenseType}
              </Text>
              <View style={[styles.typeRow, { flexWrap: "wrap", marginBottom: 12 }]}>
                {expenseTypes.map((et) => (
                  <Pressable
                    key={et.id}
                    onPress={() =>
                      costModal &&
                      setCostModal({
                        ...costModal,
                        expenseTypeId: et.id,
                        type: et.name.toLowerCase(),
                      })
                    }
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor:
                          costModal?.expenseTypeId?.toString() === et.id.toString()
                            ? colors.primary
                            : colors.inputBg,
                        borderColor:
                          costModal?.expenseTypeId?.toString() === et.id.toString()
                            ? colors.primary
                            : colors.inputBorder,
                        marginBottom: 6,
                      },
                    ]}
                  >
                    <Ionicons
                      name={getActivityTypeIcon(et.name.toLowerCase() as any) as any}
                      size={14}
                      color={
                        costModal?.expenseTypeId?.toString() === et.id.toString()
                          ? "#fff"
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        {
                          color:
                            costModal?.expenseTypeId?.toString() === et.id.toString()
                              ? "#fff"
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {et.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Người trả - Dropdown style like expense modal */}
              <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>{txt.paidBy}</Text>
              <Pressable
                onPress={() => setCostPaidByDropdown(!costPaidByDropdown)}
                style={[
                  styles.dropdownBtn,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <Text
                  style={[
                    styles.dropdownBtnText,
                    { color: costModal?.paidBy ? colors.text : colors.textTertiary },
                  ]}
                >
                  {costModal?.paidBy || txt.selectPaidBy}
                </Text>
                <Ionicons
                  name={costPaidByDropdown ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
              {costPaidByDropdown && (
                <View
                  style={[
                    styles.dropdownList,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                  ]}
                >
                  {tripMembers.map((m) => (
                    <Pressable
                      key={m.userId}
                      onPress={() => {
                        if (costModal) setCostModal({ ...costModal, paidBy: m.userName });
                        setCostPaidByDropdown(false);
                      }}
                      style={[
                        styles.dropdownItem,
                        costModal?.paidBy === m.userName && {
                          backgroundColor: colors.primary + "15",
                        },
                      ]}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                        {m.userName}
                        {m.isOwner ? " 👑" : ""}
                      </Text>
                      {costModal?.paidBy === m.userName && (
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
              {/* Split type selector - only shown when trip is not draft and there's actual cost */}
              {itinerary.status !== "draft" && tripMembers.length > 1 && (
                <>
                  <Text style={[styles.splitLabel, { color: colors.textSecondary, marginTop: 4 }]}>
                    {txt.splitType}
                  </Text>
                  <View style={styles.typeRow}>
                    {(["none", "equal", "custom"] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => {
                          setCostSplitType(st);
                          if (st !== "none" && Object.keys(costSplitChecked).length === 0) {
                            const checked: Record<string, boolean> = {};
                            tripMembers.forEach((m) => {
                              checked[m.userId] = true;
                            });
                            setCostSplitChecked(checked);
                          }
                        }}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: costSplitType === st ? colors.primary : colors.inputBg,
                            borderColor: costSplitType === st ? colors.primary : colors.inputBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            { color: costSplitType === st ? "#fff" : colors.textSecondary },
                          ]}
                        >
                          {st === "none"
                            ? txt.splitNone
                            : st === "equal"
                              ? txt.splitEqual
                              : txt.splitCustom}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {costSplitType !== "none" && (
                    <View style={[styles.splitMemberList, { borderColor: colors.inputBorder }]}>
                      <Text style={[styles.splitMembersTitle, { color: colors.textSecondary }]}>
                        {txt.splitMembers}
                      </Text>
                      {tripMembers.map((m) => {
                        const isChecked = costSplitChecked[m.userId] ?? false;
                        const totalAmount =
                          parseInt((costModal?.cost || "0").replace(/[^0-9]/g, ""), 10) || 0;
                        const checkedCount = Object.values(costSplitChecked).filter(Boolean).length;
                        const equalShare =
                          checkedCount > 0 ? Math.floor(totalAmount / checkedCount) : 0;
                        return (
                          <View key={m.userId} style={styles.splitMemberRow}>
                            <Pressable
                              onPress={() =>
                                setCostSplitChecked({ ...costSplitChecked, [m.userId]: !isChecked })
                              }
                              style={[
                                styles.checkbox,
                                {
                                  borderColor: isChecked ? colors.success : colors.textTertiary,
                                  backgroundColor: isChecked ? colors.success : "transparent",
                                  width: 20,
                                  height: 20,
                                },
                              ]}
                            >
                              {isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </Pressable>
                            <Text
                              style={[styles.splitMemberName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {m.userName}
                              {m.isOwner ? ` (${txt.tripOwnerLabel})` : ""}
                            </Text>
                            {costSplitType === "equal" && isChecked && (
                              <Text style={[styles.splitMemberAmount, { color: colors.accent }]}>
                                {formatVND(equalShare)}
                              </Text>
                            )}
                            {costSplitType === "custom" && isChecked && (
                              <TextInput
                                style={[
                                  styles.splitAmountInput,
                                  {
                                    color: colors.text,
                                    backgroundColor: colors.inputBg,
                                    borderColor: colors.inputBorder,
                                  },
                                ]}
                                keyboardType="numeric"
                                onChangeText={(v) => {
                                  const sanitized = v.replace(/[^0-9]/g, "");
                                  setCostSplitAmounts({
                                    ...costSplitAmounts,
                                    [m.userId]: sanitized,
                                  });
                                }}
                              />
                            )}
                          </View>
                        );
                      })}
                      {costSplitType === "custom" &&
                        (() => {
                          const totalAmount =
                            parseInt((costModal?.cost || "0").replace(/[^0-9]/g, ""), 10) || 0;
                          const splitSum = Object.entries(costSplitAmounts)
                            .filter(([uid]) => costSplitChecked[uid])
                            .reduce(
                              (s, [, v]) => s + (parseInt(v.replace(/[^0-9]/g, ""), 10) || 0),
                              0,
                            );
                          const diff = totalAmount - splitSum;
                          return diff !== 0 ? (
                            <Text style={[styles.splitWarning, { color: colors.error }]}>
                              {txt.splitTotalMismatch} ({diff > 0 ? "+" : ""}
                              {formatVND(diff)})
                            </Text>
                          ) : null;
                        })()}
                    </View>
                  )}
                </>
              )}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setCostModal(null);
                    setCostPaidByDropdown(false);
                    setCostSplitType("none");
                    setCostSplitChecked({});
                    setCostSplitAmounts({});
                  }}
                  style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>
                    {t().common.cancel}
                  </Text>
                </Pressable>
                {(() => {
                  const total = parseInt((costModal?.cost || "0").replace(/[^0-9]/g, ""), 10) || 0;
                  const sum = Object.entries(costSplitAmounts)
                    .filter(([uid]) => costSplitChecked[uid])
                    .reduce((s, [, v]) => s + (parseInt(v.replace(/[^0-9]/g, ""), 10) || 0), 0);
                  const isInvalid = costSplitType === "custom" && total !== sum;

                  return (
                    <Pressable
                      onPress={saveCost}
                      disabled={isInvalid}
                      style={[
                        styles.modalBtn,
                        { backgroundColor: colors.primary, opacity: isInvalid ? 0.5 : 1 },
                      ]}
                    >
                      <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                        {t().common.save}
                      </Text>
                    </Pressable>
                  );
                })()}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!timeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setTimeModal(null)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setTimeModal(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheetContent, { backgroundColor: colors.card }]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Pressable
                onPress={() => setTimeModal(null)}
                hitSlop={8}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {txt.editTime}
              </Text>
              <Pressable
                onPress={saveTime}
                hitSlop={8}
                disabled={!(timeModal?.time || "").match(/^\d{1,2}:\d{2}/)}
              >
                <Text
                  style={[
                    styles.sheetSaveLink,
                    {
                      color: (timeModal?.time || "").match(/^\d{1,2}:\d{2}/)
                        ? colors.primary
                        : colors.textTertiary,
                    },
                  ]}
                >
                  Lưu
                </Text>
              </Pressable>
            </View>
            <View style={styles.timeQuickChipsRow}>
              {["07:00", "09:00", "12:00", "15:00", "18:00", "21:00"].map((preset) => {
                const active = (timeModal?.time || "").startsWith(preset);
                return (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      if (timeModal) setTimeModal({ ...timeModal, time: preset });
                    }}
                    style={({ pressed }) => [
                      styles.timeQuickChip,
                      {
                        backgroundColor: active
                          ? colors.primary
                          : colors.inputBg,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeQuickChipText,
                        { color: active ? "#fff" : colors.text },
                      ]}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[
                styles.timeBigInput,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                },
              ]}
              value={timeModal?.time || ""}
              onChangeText={(v) => {
                if (timeModal) {
                  const formatted = formatTimeInput(v);
                  setTimeModal({ ...timeModal, time: formatted });
                }
              }}
              placeholder="HH:mm"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              maxLength={8}
              autoFocus
              textAlign="center"
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!addPlaceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddPlaceModal(null)}
      >
        <View style={styles.sheetOverlay}>
          <View
            style={[
              styles.sheetContent,
              { backgroundColor: colors.card, maxHeight: "92%" },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>{txt.addPlace}</Text>
            <View style={{ flexDirection: "row", gap: 0, marginBottom: 12 }}>
              <Pressable
                onPress={() => setAddPlaceTab("system")}
                style={[
                  styles.tabBtn,
                  { flex: 1, paddingVertical: 8 },
                  addPlaceTab === "system" && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={14}
                  color={addPlaceTab === "system" ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      fontSize: 12,
                      color: addPlaceTab === "system" ? colors.primary : colors.textTertiary,
                    },
                  ]}
                >
                  {txt.fromSystem}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAddPlaceTab("manual")}
                style={[
                  styles.tabBtn,
                  { flex: 1, paddingVertical: 8 },
                  addPlaceTab === "manual" && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={addPlaceTab === "manual" ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      fontSize: 12,
                      color: addPlaceTab === "manual" ? colors.primary : colors.textTertiary,
                    },
                  ]}
                >
                  {txt.manual}
                </Text>
              </Pressable>
            </View>

            {addPlaceTab === "system" ? (
              <>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  value={poiSearch}
                  onChangeText={setPoiSearch}
                  placeholder={txt.searchPOI}
                  placeholderTextColor={colors.textTertiary}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 8, maxHeight: 36 }}
                >
                  <Pressable
                    onPress={() => setPoiDestFilter("")}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: !poiDestFilter ? colors.primary : colors.inputBg,
                        borderColor: !poiDestFilter ? colors.primary : colors.inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: !poiDestFilter ? "#fff" : colors.textSecondary },
                      ]}
                    >
                      {txt.allDestinations}
                    </Text>
                  </Pressable>
                  {destinations
                    .filter((d) => d.isActive)
                    .map((d) => (
                      <Pressable
                        key={d.id}
                        onPress={() => setPoiDestFilter(poiDestFilter === d.id ? "" : d.id)}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor:
                              poiDestFilter === d.id ? colors.primary : colors.inputBg,
                            borderColor:
                              poiDestFilter === d.id ? colors.primary : colors.inputBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            { color: poiDestFilter === d.id ? "#fff" : colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {d.name}
                        </Text>
                      </Pressable>
                    ))}
                </ScrollView>
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {filteredPOIs.length === 0 && externalSearchResults.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 20 }}>
                      <Ionicons name="search-outline" size={28} color={colors.textTertiary} />
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 13,
                          fontFamily: "Inter_400Regular",
                          marginTop: 8,
                        }}
                      >
                        {externalSearchLoading
                          ? "Đang tìm trên bản đồ..."
                          : txt.noPOIsFound}
                      </Text>
                    </View>
                  ) : (
                    filteredPOIs.map((poi) => {
                      const parentDest = destinations.find((d) => d.id === poi.destinationId);
                      return (
                        <Pressable
                          key={poi.id}
                          onPress={() =>
                            addPlaceModal && addPlaceFromPOI(poi, addPlaceModal.dayIdx)
                          }
                          style={({ pressed }) => [
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                              padding: 10,
                              borderRadius: 10,
                              backgroundColor: pressed ? colors.primary + "08" : "transparent",
                              borderBottomWidth: 1,
                              borderBottomColor: colors.inputBorder,
                            },
                          ]}
                        >
                          <View
                            style={[styles.typeBadge, { backgroundColor: colors.primary + "12" }]}
                          >
                            <Ionicons
                              name={
                                getActivityTypeIcon(
                                  poi.type === "attraction"
                                    ? "sightseeing"
                                    : poi.type === "restaurant"
                                      ? "food"
                                      : poi.type === "cafe"
                                        ? "food"
                                        : poi.type,
                                ) as any
                              }
                              size={16}
                              color={colors.primary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: "Inter_600SemiBold",
                                color: colors.text,
                              }}
                              numberOfLines={1}
                            >
                              {poi.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                fontFamily: "Inter_400Regular",
                                color: colors.textSecondary,
                              }}
                              numberOfLines={1}
                            >
                              {poi.address}
                            </Text>
                            {parentDest && (
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: "Inter_400Regular",
                                  color: colors.textTertiary,
                                }}
                              >
                                {parentDest.name}
                              </Text>
                            )}
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 2 }}>
                            {poi.rating > 0 && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                <Ionicons name="star" size={10} color="#F59E0B" />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "Inter_500Medium",
                                    color: colors.textSecondary,
                                  }}
                                >
                                  {poi.rating.toFixed(1)}
                                </Text>
                              </View>
                            )}
                            {poi.estimatedCost ? (
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: "Inter_400Regular",
                                  color: colors.accent,
                                }}
                              >
                                {formatVND(poi.estimatedCost)}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })
                  )}

                  {externalSearchResults.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                          paddingHorizontal: 4,
                        }}
                      >
                        <Ionicons name="globe-outline" size={12} color={colors.textTertiary} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_600SemiBold",
                            color: colors.textTertiary,
                            letterSpacing: 0.4,
                            textTransform: "uppercase",
                          }}
                        >
                          Trên Google Maps
                        </Text>
                      </View>
                      {externalSearchResults.map((place, idx) => (
                        <Pressable
                          key={`${place.placeId || place.name}-${idx}`}
                          onPress={() => addPlaceFromExternal(place)}
                          style={({ pressed }) => [
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                              padding: 10,
                              borderRadius: 10,
                              backgroundColor: pressed
                                ? colors.primary + "08"
                                : "transparent",
                              borderBottomWidth: 1,
                              borderBottomColor: colors.inputBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.typeBadge,
                              { backgroundColor: "#4285F4" + "12" },
                            ]}
                          >
                            <Ionicons name="location" size={16} color="#4285F4" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: "Inter_600SemiBold",
                                color: colors.text,
                              }}
                              numberOfLines={1}
                            >
                              {place.name}
                            </Text>
                            {place.address && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Inter_400Regular",
                                  color: colors.textSecondary,
                                }}
                                numberOfLines={1}
                              >
                                {place.address}
                              </Text>
                            )}
                          </View>
                          {typeof place.rating === "number" && place.rating > 0 && (
                            <View
                              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                            >
                              <Ionicons name="star" size={10} color="#F59E0B" />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Inter_500Medium",
                                  color: colors.textSecondary,
                                }}
                              >
                                {place.rating.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {externalSearchLoading && (
                    <View style={{ alignItems: "center", paddingVertical: 12 }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </ScrollView>
                <View style={[styles.modalActions, { marginTop: 10 }]}>
                  <Pressable
                    onPress={() => setAddPlaceModal(null)}
                    style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>
                      {t().common.cancel}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  value={placeTitle}
                  onChangeText={setPlaceTitle}
                  placeholder={txt.addPlacePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                  Thuộc điểm đến nào?
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ maxHeight: 36, marginBottom: 8 }}
                >
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {destinations
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <Pressable
                          key={d.id}
                          onPress={() =>
                            setPlaceDestinationId(placeDestinationId === d.id ? "" : d.id)
                          }
                          style={[
                            styles.typeChip,
                            {
                              backgroundColor:
                                placeDestinationId === d.id ? colors.primary : colors.inputBg,
                              borderColor:
                                placeDestinationId === d.id ? colors.primary : colors.inputBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeChipText,
                              {
                                color: placeDestinationId === d.id ? "#fff" : colors.textSecondary,
                              },
                            ]}
                          >
                            {d.name}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                </ScrollView>

                <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                  Loại hình
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ maxHeight: 36, marginBottom: 8 }}
                >
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {(() => {
                      const getPoiTInfo = (name: string) => {
                        const n = name.toLowerCase();
                        if (
                          n.includes("nhà hàng") ||
                          n.includes("restaurant") ||
                          n.includes("ăn uống") ||
                          n.includes("food")
                        )
                          return { icon: "restaurant", pType: "food" as const, eId: "1" };
                        if (n.includes("cà phê") || n.includes("cafe") || n.includes("coffee"))
                          return { icon: "cafe", pType: "food" as const, eId: "1" };
                        if (
                          n.includes("tham quan") ||
                          n.includes("attraction") ||
                          n.includes("visit") ||
                          n.includes("sight")
                        )
                          return { icon: "camera", pType: "sightseeing" as const, eId: "4" };
                        if (n.includes("mua sắm") || n.includes("shopping") || n.includes("marker"))
                          return { icon: "basket", pType: "shopping" as const, eId: "5" };
                        if (
                          n.includes("khách sạn") ||
                          n.includes("hotel") ||
                          n.includes("stay") ||
                          n.includes("resort")
                        )
                          return { icon: "bed", pType: "other" as const, eId: "3" };
                        if (
                          n.includes("di chuyển") ||
                          n.includes("transport") ||
                          n.includes("taxi")
                        )
                          return { icon: "car", pType: "transport" as const, eId: "2" };
                        return { icon: "help-circle", pType: "other" as const, eId: "3" };
                      };

                      const typesToDisplay =
                        poiTypes.length > 0
                          ? poiTypes
                          : [
                              { id: "attraction", typeName: "Tham quan" },
                              { id: "restaurant", typeName: "Nhà hàng" },
                              { id: "cafe", typeName: "Cà phê" },
                              { id: "hotel", typeName: "Khách sạn" },
                              { id: "shopping", typeName: "Mua sắm" },
                              { id: "other", typeName: "Khác" },
                            ];

                      return typesToDisplay.map((pt) => {
                        const info = getPoiTInfo(pt.typeName);
                        const isSelected = placePoiTypeId === pt.id;

                        return (
                          <Pressable
                            key={pt.id}
                            onPress={() => {
                              setPlaceType(info.pType);
                              setPlaceExpenseTypeId(info.eId);
                              setPlacePoiTypeId(pt.id);
                            }}
                            style={[
                              styles.typeChip,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.inputBg,
                                borderColor: isSelected ? colors.primary : colors.inputBorder,
                              },
                            ]}
                          >
                            <Ionicons
                              name={info.icon as any}
                              size={14}
                              color={isSelected ? "#fff" : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.typeChipText,
                                { color: isSelected ? "#fff" : colors.textSecondary },
                              ]}
                            >
                              {pt.typeName}
                            </Text>
                          </Pressable>
                        );
                      });
                    })()}
                  </View>
                </ScrollView>

                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      marginBottom: 8,
                    },
                  ]}
                  value={placeAddress}
                  onChangeText={setPlaceAddress}
                  placeholder="Địa chỉ (không bắt buộc)"
                  placeholderTextColor={colors.textTertiary}
                />

                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  value={placeCost}
                  onChangeText={(v) => {
                    const sanitized = v.replace(/[^0-9]/g, "");
                    setPlaceCost(sanitized);
                  }}
                  placeholder={txt.expenseAmount + " (VNĐ)"}
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => {
                      setAddPlaceModal(null);
                      setPlaceTitle("");
                      setPlaceAddress("");
                      setPlaceDestinationId("");
                      setPlaceExpenseTypeId(undefined);
                      setPlacePoiTypeId("");
                    }}
                    style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>
                      {t().common.cancel}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={addPlaceToDay}
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t().common.add}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!expenseModal}
        transparent
        animationType="slide"
        onRequestClose={() => resetExpenseModal()}
      >
        <Pressable
          onPress={() => resetExpenseModal()}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.55)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 12,
              maxHeight: "92%",
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.textTertiary,
                opacity: 0.4,
                marginTop: 10,
                marginBottom: 6,
              }}
            />
            <ScrollView
              contentContainerStyle={{ padding: 22, paddingTop: 8, gap: 14 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {expenseModal?.editId ? txt.editExpense : txt.addExpense}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={expenseTitle}
                onChangeText={setExpenseTitle}
                placeholder="VD: Taxi sân bay"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={[styles.typeRow, { flexWrap: "wrap" }]}>
                {expenseTypes.map((et) => {
                  const isSelected = expenseTypeId?.toString() === et.id.toString();
                  return (
                    <Pressable
                      key={et.id}
                      onPress={() => {
                        const idStr = et.id.toString();
                        setExpenseTypeId(et.id);
                        // Map core types for legacy compatibility if possible
                        if (idStr === "1") setExpenseType("food");
                        else if (idStr === "2") setExpenseType("transport");
                        else if (idStr === "3")
                          setExpenseType("other"); // accommodation mapped to other for legacy
                        else if (idStr === "4") setExpenseType("sightseeing");
                        else if (idStr === "5") setExpenseType("shopping");
                        else setExpenseType("other");
                      }}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.inputBg,
                          borderColor: isSelected ? colors.primary : colors.inputBorder,
                          marginBottom: 8,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          getActivityTypeIcon(
                            et.id.toString() === "1"
                              ? "food"
                              : et.id.toString() === "2"
                                ? "transport"
                                : et.id.toString() === "4"
                                  ? "sightseeing"
                                  : et.id.toString() === "5"
                                    ? "shopping"
                                    : "other",
                          ) as any
                        }
                        size={14}
                        color={isSelected ? "#fff" : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          { color: isSelected ? "#fff" : colors.textSecondary },
                        ]}
                      >
                        {et.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={expenseAmount}
                onChangeText={(v) => {
                  const sanitized = v.replace(/[^0-9]/g, "");
                  setExpenseAmount(sanitized);
                }}
                placeholder={txt.expenseAmount + " (VNĐ)"}
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />

              <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>{txt.paidBy}</Text>
              <Pressable
                onPress={() => setPaidByDropdown(!paidByDropdown)}
                style={[
                  styles.dropdownBtn,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
              >
                <Text
                  style={[
                    styles.dropdownBtnText,
                    { color: expensePaidBy ? colors.text : colors.textTertiary },
                  ]}
                >
                  {expensePaidBy || txt.selectPaidBy}
                </Text>
                <Ionicons
                  name={paidByDropdown ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
              {paidByDropdown && (
                <View
                  style={[
                    styles.dropdownList,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                  ]}
                >
                  {tripMembers.map((m) => (
                    <Pressable
                      key={m.userId}
                      onPress={() => {
                        setExpensePaidBy(m.userName);
                        setExpensePaidByUserId(m.userId);
                        setPaidByDropdown(false);
                      }}
                      style={[
                        styles.dropdownItem,
                        expensePaidByUserId === m.userId && {
                          backgroundColor: colors.primary + "15",
                        },
                      ]}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                        {m.userName}
                        {m.isOwner ? " 👑" : ""}
                      </Text>
                      {expensePaidByUserId === m.userId && (
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.splitLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                {txt.splitType}
              </Text>
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
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: expenseSplitType === st ? colors.primary : colors.inputBg,
                        borderColor: expenseSplitType === st ? colors.primary : colors.inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: expenseSplitType === st ? "#fff" : colors.textSecondary },
                      ]}
                    >
                      {st === "none"
                        ? txt.splitNone
                        : st === "equal"
                          ? txt.splitEqual
                          : txt.splitCustom}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {expenseSplitType !== "none" && (
                <View style={[styles.splitMemberList, { borderColor: colors.inputBorder }]}>
                  <Text style={[styles.splitMembersTitle, { color: colors.textSecondary }]}>
                    {txt.splitMembers}
                  </Text>
                  {tripMembers.map((m) => {
                    const isChecked = expenseSplitChecked[m.userId] ?? false;
                    const totalAmount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
                    const checkedCount = Object.values(expenseSplitChecked).filter(Boolean).length;
                    const equalShare =
                      checkedCount > 0 ? Math.floor(totalAmount / checkedCount) : 0;

                    return (
                      <View key={m.userId} style={styles.splitMemberRow}>
                        <Pressable
                          onPress={() =>
                            setExpenseSplitChecked({
                              ...expenseSplitChecked,
                              [m.userId]: !isChecked,
                            })
                          }
                          style={[
                            styles.checkbox,
                            {
                              borderColor: isChecked ? colors.success : colors.textTertiary,
                              backgroundColor: isChecked ? colors.success : "transparent",
                              width: 20,
                              height: 20,
                            },
                          ]}
                        >
                          {isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </Pressable>
                        <Text
                          style={[styles.splitMemberName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {m.userName}
                          {m.isOwner ? ` (${txt.tripOwnerLabel})` : ""}
                        </Text>
                        {expenseSplitType === "equal" && isChecked && (
                          <Text style={[styles.splitMemberAmount, { color: colors.accent }]}>
                            {formatVND(equalShare)}
                          </Text>
                        )}
                        {expenseSplitType === "custom" && isChecked && (
                          <TextInput
                            style={[
                              styles.splitAmountInput,
                              {
                                color: colors.text,
                                backgroundColor: colors.inputBg,
                                borderColor: colors.inputBorder,
                              },
                            ]}
                            value={expenseSplitAmounts[m.userId] || ""}
                            onChangeText={(v) =>
                              setExpenseSplitAmounts({ ...expenseSplitAmounts, [m.userId]: v })
                            }
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numeric"
                          />
                        )}
                      </View>
                    );
                  })}
                  {expenseSplitType === "custom" &&
                    (() => {
                      const totalAmount = parseInt(expenseAmount.replace(/[^0-9]/g, ""), 10) || 0;
                      const splitSum = Object.entries(expenseSplitAmounts)
                        .filter(([uid]) => expenseSplitChecked[uid])
                        .reduce((s, [, v]) => s + (parseInt(v.replace(/[^0-9]/g, ""), 10) || 0), 0);
                      const diff = totalAmount - splitSum;
                      return diff !== 0 ? (
                        <Text style={[styles.splitWarning, { color: colors.error }]}>
                          {txt.splitTotalMismatch} ({diff > 0 ? "+" : ""}
                          {formatVND(diff)})
                        </Text>
                      ) : null;
                    })()}
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  onPress={resetExpenseModal}
                  style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>
                    {t().common.cancel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={addOrEditExpense}
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                    {expenseModal?.editId ? t().common.save : t().common.add}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!expenseNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setExpenseNoteModal(null)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setExpenseNoteModal(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheetContent, { backgroundColor: colors.card }]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Pressable
                onPress={() => setExpenseNoteModal(null)}
                hitSlop={8}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {expenseNoteModal?.editIndex !== undefined ? txt.editNote : txt.addNote}
              </Text>
              <Pressable
                onPress={saveExpenseNote}
                hitSlop={8}
                disabled={!(expenseNoteModal?.note || "").trim()}
              >
                <Text
                  style={[
                    styles.sheetSaveLink,
                    {
                      color: (expenseNoteModal?.note || "").trim()
                        ? colors.primary
                        : colors.textTertiary,
                    },
                  ]}
                >
                  Lưu
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.sheetTextarea,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                },
              ]}
              value={expenseNoteModal?.note || ""}
              onChangeText={(v) =>
                expenseNoteModal && setExpenseNoteModal({ ...expenseNoteModal, note: v })
              }
              placeholder={txt.notePlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!taskModal}
        transparent
        animationType="slide"
        onRequestClose={() => setTaskModal(null)}
      >
        <Pressable
          onPress={() => setTaskModal(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.55)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 12,
              maxHeight: "92%",
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.textTertiary,
                opacity: 0.4,
                marginTop: 10,
                marginBottom: 6,
              }}
            />
            <ScrollView
              contentContainerStyle={{ padding: 22, paddingTop: 8, gap: 14 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {taskModal?.editId ? "Sửa việc cần làm" : "Thêm việc cần làm"}
              </Text>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={taskModal?.title || ""}
                onChangeText={(v) =>
                  setTaskModal((prev) => (prev ? { ...prev, title: v } : prev))
                }
                placeholder="VD: Đặt vé máy bay, mua thuốc..."
                placeholderTextColor={colors.textTertiary}
              />

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    minHeight: 80,
                    textAlignVertical: "top",
                  },
                ]}
                value={taskModal?.description || ""}
                onChangeText={(v) =>
                  setTaskModal((prev) =>
                    prev ? { ...prev, description: v } : prev,
                  )
                }
                placeholder="Mô tả thêm (không bắt buộc)"
                placeholderTextColor={colors.textTertiary}
                multiline
              />

              <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                Phân loại
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {(
                  [
                    { key: "prep", label: "Chuẩn bị", color: "#3B82F6" },
                    { key: "during", label: "Trong chuyến", color: "#10B981" },
                    { key: "after", label: "Sau chuyến", color: "#F59E0B" },
                  ] as const
                ).map((c) => {
                  const active = taskModal?.category === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() =>
                        setTaskModal((prev) =>
                          prev ? { ...prev, category: c.key } : prev,
                        )
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: StyleSheet.hairlineWidth,
                        backgroundColor: active ? c.color : colors.inputBg,
                        borderColor: active ? c.color : colors.cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_600SemiBold",
                          color: active ? "#fff" : colors.textSecondary,
                        }}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                Giao cho
              </Text>
              {(() => {
                const selectedMember = taskModal?.assigneeUserId
                  ? tripMembers.find((m) => m.userId === taskModal.assigneeUserId)
                  : null;
                return (
                  <View>
                    <Pressable
                      onPress={() => setTaskAssigneeDropdown((v) => !v)}
                      style={[
                        styles.assigneeTrigger,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: taskAssigneeDropdown
                            ? colors.primary
                            : colors.cardBorder,
                        },
                      ]}
                    >
                      {selectedMember ? (
                        <>
                          {selectedMember.avatarUrl ? (
                            <Image
                              source={{ uri: selectedMember.avatarUrl }}
                              style={styles.assigneeTriggerAvatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.assigneeTriggerAvatar,
                                {
                                  backgroundColor: avatarColorFor(selectedMember.userId),
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                              ]}
                            >
                              <Text style={styles.assigneeTriggerAvatarText}>
                                {(selectedMember.userName || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.assigneeTriggerName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {selectedMember.userName}
                            </Text>
                            {selectedMember.isOwner && (
                              <Text
                                style={[
                                  styles.assigneeTriggerSub,
                                  { color: colors.textTertiary },
                                ]}
                              >
                                Chủ chuyến
                              </Text>
                            )}
                          </View>
                        </>
                      ) : (
                        <>
                          <View
                            style={[
                              styles.assigneeTriggerAvatar,
                              {
                                backgroundColor: colors.cardBorder,
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons
                              name="person-outline"
                              size={16}
                              color={colors.textTertiary}
                            />
                          </View>
                          <Text
                            style={[
                              styles.assigneeTriggerName,
                              { color: colors.textSecondary, flex: 1 },
                            ]}
                          >
                            Không giao cho ai
                          </Text>
                        </>
                      )}
                      <Ionicons
                        name={taskAssigneeDropdown ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                    {taskAssigneeDropdown && (
                      <View
                        style={[
                          styles.assigneeDropdown,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.cardBorder,
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => {
                            setTaskModal((prev) =>
                              prev ? { ...prev, assigneeUserId: "" } : prev,
                            );
                            setTaskAssigneeDropdown(false);
                          }}
                          style={({ pressed }) => [
                            styles.assigneeOption,
                            {
                              backgroundColor: pressed ? colors.inputBg : "transparent",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.assigneeOptionAvatar,
                              {
                                backgroundColor: colors.cardBorder,
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons
                              name="close"
                              size={14}
                              color={colors.textTertiary}
                            />
                          </View>
                          <Text
                            style={[
                              styles.assigneeOptionName,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Không giao cho ai
                          </Text>
                          {!taskModal?.assigneeUserId && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={colors.primary}
                            />
                          )}
                        </Pressable>
                        {tripMembers.map((m, idx) => {
                          const active = taskModal?.assigneeUserId === m.userId;
                          return (
                            <Pressable
                              key={m.userId}
                              onPress={() => {
                                setTaskModal((prev) =>
                                  prev ? { ...prev, assigneeUserId: m.userId } : prev,
                                );
                                setTaskAssigneeDropdown(false);
                              }}
                              style={({ pressed }) => [
                                styles.assigneeOption,
                                {
                                  backgroundColor: pressed
                                    ? colors.inputBg
                                    : "transparent",
                                  borderTopWidth:
                                    idx === 0 ? StyleSheet.hairlineWidth : 0,
                                  borderTopColor: colors.cardBorder,
                                },
                              ]}
                            >
                              {m.avatarUrl ? (
                                <Image
                                  source={{ uri: m.avatarUrl }}
                                  style={styles.assigneeOptionAvatar}
                                  contentFit="cover"
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.assigneeOptionAvatar,
                                    {
                                      backgroundColor: avatarColorFor(m.userId),
                                      alignItems: "center",
                                      justifyContent: "center",
                                    },
                                  ]}
                                >
                                  <Text style={styles.assigneeTriggerAvatarText}>
                                    {(m.userName || "?").charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.assigneeOptionName,
                                    { color: colors.text },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {m.userName}
                                </Text>
                                {m.isOwner && (
                                  <Text
                                    style={[
                                      styles.assigneeTriggerSub,
                                      { color: colors.textTertiary },
                                    ]}
                                  >
                                    Chủ chuyến
                                  </Text>
                                )}
                              </View>
                              {active && (
                                <Ionicons
                                  name="checkmark"
                                  size={18}
                                  color={colors.primary}
                                />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })()}

              <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                Hạn (không bắt buộc)
              </Text>
              <TaskDueDatePicker
                value={taskModal?.dueDate || null}
                onChange={(iso) =>
                  setTaskModal((prev) => (prev ? { ...prev, dueDate: iso || "" } : prev))
                }
                colors={colors}
              />

              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setTaskModal(null);
                    setTaskAssigneeDropdown(false);
                  }}
                  style={[styles.modalBtn, { backgroundColor: colors.inputBg }]}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>
                    {t().common.cancel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    if (!taskModal) return;
                    const title = taskModal.title.trim();
                    if (!title) {
                      if (Platform.OS === "web") window.alert("Vui lòng nhập tiêu đề việc.");
                      else Alert.alert("Thiếu thông tin", "Vui lòng nhập tiêu đề việc.");
                      return;
                    }
                    const dueIsoOrNull = taskModal.dueDate.trim()
                      ? taskModal.dueDate.trim()
                      : null;
                    try {
                      if (taskModal.editId) {
                        await updateTaskMut.mutateAsync({
                          taskId: taskModal.editId,
                          data: {
                            title,
                            description: taskModal.description.trim() || null,
                            category: taskModal.category || null,
                            assigneeUserId: taskModal.assigneeUserId || null,
                            dueDate: dueIsoOrNull,
                          },
                        });
                      } else {
                        await createTaskMut.mutateAsync({
                          title,
                          description: taskModal.description.trim() || null,
                          category: taskModal.category || null,
                          assigneeUserId: taskModal.assigneeUserId || null,
                          dueDate: dueIsoOrNull,
                        });
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setTaskModal(null);
                      setTaskAssigneeDropdown(false);
                    } catch (err: any) {
                      // Surface as much detail as possible — the previous
                      // generic alert hid the real cause (missing DB table,
                      // schema mismatch, etc) which made debugging painful.
                      console.error("Save task failed:", err);
                      const detail =
                        err?.message ||
                        err?.toString?.() ||
                        "Vui lòng thử lại.";
                      const hint = detail.includes("trip_tasks")
                        ? "\n\nGợi ý: chạy `npm run db:push` trước khi dùng tính năng task."
                        : "";
                      if (Platform.OS === "web")
                        window.alert(`Không lưu được task:\n${detail}${hint}`);
                      else Alert.alert("Không lưu được task", `${detail}${hint}`);
                    }
                  }}
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                    {taskModal?.editId ? t().common.save : t().common.add}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editInfoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditInfoModal(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setEditInfoModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheetContent, { backgroundColor: colors.card }]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Pressable
                onPress={() => setEditInfoModal(false)}
                hitSlop={8}
                style={[styles.sheetCloseBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {txt.editTripInfo}
              </Text>
              <Pressable onPress={saveEditInfo} hitSlop={8}>
                <Text style={[styles.sheetSaveLink, { color: colors.primary }]}>
                  Lưu
                </Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                {txt.totalBudget} (VNĐ)
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={editBudget}
                onChangeText={(v) => {
                  const sanitized = v.replace(/[^0-9]/g, "");
                  setEditBudget(sanitized);
                }}
                keyboardType="numeric"
              />
              <Text style={[styles.modalSubLabel, { color: colors.textSecondary }]}>
                {txt.travelers}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={editNumPeople}
                onChangeText={(v) => {
                  const sanitized = v.replace(/[^0-9]/g, "");
                  setEditNumPeople(sanitized);
                }}
                keyboardType="numeric"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={shareModal}
        transparent
        animationType="slide"
        // NOTE: Share modal already uses bottom-sheet semantics — leave as is
        // for now. Tag for full audit in #140 if stacking observed.
        onRequestClose={() => setShareModal(false)}
      >
        <View style={invStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModal(false)} />
          <View style={[invStyles.sheet, { backgroundColor: colors.card }]}>
            <View style={invStyles.handle} />

            <View style={invStyles.headerRow}>
              <View style={[invStyles.headerIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="person-add" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[invStyles.headerTitle, { color: colors.text }]}>
                  {txt.inviteCompanion}
                </Text>
                <Text style={[invStyles.headerSub, { color: colors.textSecondary }]}>
                  {txt.inviteSubtitle}
                </Text>
              </View>
              <Pressable
                onPress={() => setShareModal(false)}
                hitSlop={10}
                style={[invStyles.closeBtn, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={invStyles.section}>
              <Text style={[invStyles.sectionLabel, { color: colors.textSecondary }]}>
                {txt.permission}
              </Text>
              <View style={[invStyles.permToggle, { backgroundColor: colors.inputBg }]}>
                {canShareAsEditor && (
                  <Pressable
                    style={[
                      invStyles.permBtn,
                      sharePermission === "editor" && [
                        invStyles.permBtnActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                    onPress={() => setSharePermission("editor")}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={sharePermission === "editor" ? "#fff" : colors.textSecondary}
                    />
                    <Text
                      style={[
                        invStyles.permBtnText,
                        { color: sharePermission === "editor" ? "#fff" : colors.text },
                      ]}
                    >
                      {txt.canEdit}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    invStyles.permBtn,
                    sharePermission === "viewer" && [
                      invStyles.permBtnActive,
                      { backgroundColor: colors.primary },
                    ],
                  ]}
                  onPress={() => setSharePermission("viewer")}
                >
                  <Ionicons
                    name="eye-outline"
                    size={16}
                    color={sharePermission === "viewer" ? "#fff" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      invStyles.permBtnText,
                      { color: sharePermission === "viewer" ? "#fff" : colors.text },
                    ]}
                  >
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

            {isOwner && (
              <View style={invStyles.section}>
                <Text style={[invStyles.sectionLabel, { color: colors.textSecondary }]}>
                  Mời theo username
                </Text>
                <View
                  style={[
                    invStyles.searchWrap,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <Ionicons name="search" size={16} color={colors.textTertiary} />
                  <TextInput
                    style={[invStyles.searchInput, { color: colors.text }]}
                    placeholder="Tìm @username hoặc tên..."
                    placeholderTextColor={colors.textTertiary}
                    value={inviteQuery}
                    onChangeText={setInviteQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {inviteSearching && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                  {inviteQuery.length > 0 && !inviteSearching && (
                    <Pressable onPress={() => setInviteQuery("")} hitSlop={6}>
                      <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                    </Pressable>
                  )}
                </View>
                {inviteResults.length > 0 && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {inviteResults.map((u) => (
                      <View
                        key={u.userId}
                        style={[
                          invStyles.memberRow,
                          { backgroundColor: colors.inputBg },
                        ]}
                      >
                        {u.avatarUrl ? (
                          <Image
                            source={{ uri: u.avatarUrl }}
                            style={invStyles.memberAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              invStyles.memberAvatar,
                              { backgroundColor: colors.primary },
                            ]}
                          >
                            <Text style={invStyles.manageBtnAvatarText}>
                              {(u.fullName || u.userName || "?").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[invStyles.manageBtnText, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {u.fullName || u.userName}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: "Inter_400Regular",
                              color: colors.textSecondary,
                            }}
                            numberOfLines={1}
                          >
                            @{u.userName}
                          </Text>
                        </View>
                        {sessionInvitedIds.has(u.userId) ? (
                          <View
                            style={[
                              invStyles.inviteBtn,
                              { backgroundColor: "#10B981" },
                            ]}
                          >
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={invStyles.inviteBtnText}>Đã mời</Text>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleInviteByUserId(u)}
                            disabled={inviteBusyUserId === u.userId}
                            style={({ pressed }) => [
                              invStyles.inviteBtn,
                              {
                                backgroundColor: colors.primary,
                                opacity:
                                  pressed || inviteBusyUserId === u.userId ? 0.6 : 1,
                              },
                            ]}
                          >
                            {inviteBusyUserId === u.userId ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="person-add" size={14} color="#fff" />
                                <Text style={invStyles.inviteBtnText}>Mời</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {inviteQuery.trim().length >= 2 &&
                  !inviteSearching &&
                  inviteResults.length === 0 && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Inter_400Regular",
                        color: colors.textSecondary,
                        textAlign: "center",
                        marginTop: 8,
                      }}
                    >
                      Không tìm thấy người dùng phù hợp.
                    </Text>
                  )}

                {/* Inline toast — sits inside the modal so it actually shows
                    above the bottom-sheet (Alert.alert was getting hidden). */}
                {inviteToast && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                      marginTop: 8,
                      backgroundColor:
                        inviteToast.kind === "success"
                          ? "#10B981" + "18"
                          : inviteToast.kind === "error"
                            ? colors.error + "18"
                            : colors.primary + "18",
                    }}
                  >
                    <Ionicons
                      name={
                        inviteToast.kind === "success"
                          ? "checkmark-circle"
                          : inviteToast.kind === "error"
                            ? "alert-circle"
                            : "information-circle"
                      }
                      size={16}
                      color={
                        inviteToast.kind === "success"
                          ? "#10B981"
                          : inviteToast.kind === "error"
                            ? colors.error
                            : colors.primary
                      }
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontFamily: "Inter_600SemiBold",
                        color: colors.text,
                      }}
                    >
                      {inviteToast.text}
                    </Text>
                  </View>
                )}

                {sessionInvitedIds.size > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_500Medium",
                      color: colors.textTertiary,
                      marginTop: 8,
                    }}
                  >
                    Phiên này đã mời {sessionInvitedIds.size} người.
                  </Text>
                )}

                {/* Sent invitations list — persistent across sessions, sourced
                    from the new trip_invitations table. Pending rows have a
                    "Huỷ" button; accepted/declined are read-only. */}
                {sentInvitations.length > 0 && (
                  <View style={{ marginTop: 12, gap: 6 }}>
                    <Text
                      style={[
                        invStyles.sectionLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Lời mời đã gửi ({sentInvitations.length})
                    </Text>
                    {sentInvitations.slice(0, 10).map((inv) => {
                      const statusColor =
                        inv.status === "pending"
                          ? colors.warning
                          : inv.status === "accepted"
                            ? "#10B981"
                            : colors.error;
                      const statusLabel =
                        inv.status === "pending"
                          ? "Đang chờ"
                          : inv.status === "accepted"
                            ? "Đã đồng ý"
                            : inv.status === "declined"
                              ? "Đã từ chối"
                              : "Đã huỷ";
                      return (
                        <View
                          key={inv.id}
                          style={[
                            invStyles.memberRow,
                            { backgroundColor: colors.inputBg },
                          ]}
                        >
                          {inv.inviteeAvatarUrl ? (
                            <Image
                              source={{ uri: inv.inviteeAvatarUrl }}
                              style={invStyles.memberAvatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                invStyles.memberAvatar,
                                {
                                  backgroundColor: avatarColorFor(
                                    inv.inviteeUserId,
                                  ),
                                },
                              ]}
                            >
                              <Text style={invStyles.manageBtnAvatarText}>
                                {(inv.inviteeName ||
                                  inv.inviteeUserName ||
                                  "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[
                                invStyles.manageBtnText,
                                { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {inv.inviteeName ||
                                inv.inviteeUserName ||
                                "Người dùng"}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: statusColor,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Inter_600SemiBold",
                                  color: statusColor,
                                }}
                              >
                                {statusLabel}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Inter_400Regular",
                                  color: colors.textTertiary,
                                }}
                              >
                                · {inv.role === "editor" ? "Chỉnh sửa" : "Xem"}
                              </Text>
                            </View>
                          </View>
                          {inv.status === "pending" && (
                            <Pressable
                              onPress={() => cancelInvitationMut.mutate(inv.id)}
                              hitSlop={6}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: colors.error + "18",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Inter_700Bold",
                                  color: colors.error,
                                }}
                              >
                                Huỷ
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Manage companions shortcut — single row, opens the full
                companions sheet for editing roles/removing members. Per
                latest UX: the popup no longer surfaces the joined list
                inline (was duplicating the Companions tab). */}
            <Pressable
              style={[invStyles.manageBtn, { backgroundColor: colors.inputBg }]}
              onPress={() => {
                setShareModal(false);
                setCompanionModal(true);
              }}
            >
              <View style={invStyles.manageBtnLeft}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <Text style={[invStyles.manageBtnText, { color: colors.primary }]}>
                  {txt.manageCompanions}
                  {companions.length > 0 ? ` (${companions.length})` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={companionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCompanionModal(false)}
      >
        <View style={invStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCompanionModal(false)} />
          <View style={[invStyles.sheet, { backgroundColor: colors.card, maxHeight: "75%" }]}>
            <View style={invStyles.handle} />

            <View style={invStyles.headerRow}>
              <Pressable
                onPress={() => {
                  setCompanionModal(false);
                  if (canShare) setShareModal(true);
                }}
                hitSlop={10}
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
              <Text
                style={[invStyles.headerTitle, { color: colors.text, flex: 1, marginLeft: 12 }]}
              >
                {txt.manageCompanions}
              </Text>
              <Pressable
                onPress={() => setCompanionModal(false)}
                hitSlop={10}
                style={[invStyles.closeBtn, { backgroundColor: colors.inputBg }]}
              >
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
                // Use the same avatar treatment as the Companions tab — real
                // avatarUrl when available, hashed-color initial otherwise —
                // so the same member doesn't appear with two different
                // images across screens.
                const avatarUrl = (c as any).avatarUrl as string | null | undefined;
                return (
                  <View
                    key={c.userId}
                    style={[
                      invStyles.compRow,
                      i < companions.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.cardBorder,
                      },
                    ]}
                  >
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={invStyles.compAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          invStyles.compAvatar,
                          { backgroundColor: avatarColorFor(c.userId) },
                        ]}
                      >
                        <Text style={invStyles.compAvatarText}>
                          {(c.userName || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[invStyles.compName, { color: colors.text }]}>{c.userName}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons
                          name={
                            (c as any).isOwner
                              ? "ribbon-outline"
                              : c.role === "editor"
                                ? "create-outline"
                                : "eye-outline"
                          }
                          size={12}
                          color={colors.textSecondary}
                        />
                        <Text style={[invStyles.compRole, { color: colors.textSecondary }]}>
                          {(c as any).isOwner
                            ? "Chủ chuyến"
                            : c.role === "editor"
                              ? txt.editor
                              : txt.viewer}
                        </Text>
                      </View>
                    </View>
                    {isOwner && !(c as any).isOwner && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pressable
                          onPress={() =>
                            handleChangeCompanionRole(c, c.role === "editor" ? "viewer" : "editor")
                          }
                          hitSlop={6}
                          style={[
                            invStyles.roleToggleBtn,
                            {
                              backgroundColor:
                                c.role === "editor" ? colors.primary + "18" : colors.accent + "18",
                            },
                          ]}
                        >
                          <Ionicons
                            name={c.role === "editor" ? "eye-outline" : "create-outline"}
                            size={14}
                            color={c.role === "editor" ? colors.primary : colors.accent}
                          />
                          <Text
                            style={[
                              invStyles.roleToggleText,
                              { color: c.role === "editor" ? colors.primary : colors.accent },
                            ]}
                          >
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

      <Modal
        visible={!!expenseMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setExpenseMenu(null)}
      >
        {expenseMenu && (
          <Pressable
            style={styles.sheetOverlay}
            onPress={() => setExpenseMenu(null)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[styles.sheetContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.menuHeader}>
                <Text
                  style={[styles.menuHeaderTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {expenseMenu.title}
                </Text>
                <Text style={[styles.menuHeaderSub, { color: colors.textTertiary }]}>
                  {formatVND(expenseMenu.amount)}
                  {expenseMenu.paidBy ? ` · ${expenseMenu.paidBy} trả` : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const target = expenseMenu;
                  setExpenseMenu(null);
                  setExpenseNoteModal({ expenseId: target.id, note: "" });
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Thêm ghi chú
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const target = expenseMenu;
                  setExpenseMenu(null);
                  openEditExpense(target);
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Sửa khoản chi
                </Text>
              </Pressable>
              <View
                style={[styles.menuDivider, { backgroundColor: colors.cardBorder }]}
              />
              <Pressable
                onPress={() => {
                  const target = expenseMenu;
                  setExpenseMenu(null);
                  deleteExpense(target.id);
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>
                  Xoá khoản chi
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </Modal>

      <Modal
        visible={!!memberMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setMemberMenu(null)}
      >
        {memberMenu && (
          <Pressable
            style={styles.sheetOverlay}
            onPress={() => setMemberMenu(null)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[styles.sheetContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.menuHeader}>
                <Text
                  style={[styles.menuHeaderTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {memberMenu.member.userName}
                </Text>
                <Text style={[styles.menuHeaderSub, { color: colors.textTertiary }]}>
                  Đang là {memberMenu.companion.role === "editor" ? "Cộng tác viên" : "Người xem"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const target = memberMenu;
                  setMemberMenu(null);
                  if (target.companion.role !== "editor") {
                    handleChangeCompanionRole(target.companion, "editor");
                  }
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Có thể chỉnh sửa
                </Text>
                {memberMenu.companion.role === "editor" && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.primary}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  const target = memberMenu;
                  setMemberMenu(null);
                  if (target.companion.role !== "viewer") {
                    handleChangeCompanionRole(target.companion, "viewer");
                  }
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="eye-outline" size={20} color={colors.text} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  Chỉ xem
                </Text>
                {memberMenu.companion.role === "viewer" && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.primary}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </Pressable>
              <View
                style={[styles.menuDivider, { backgroundColor: colors.cardBorder }]}
              />
              <Pressable
                onPress={() => {
                  const target = memberMenu;
                  setMemberMenu(null);
                  handleRemoveCompanion(target.companion);
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="person-remove" size={20} color={colors.error} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>
                  Xoá khỏi chuyến đi
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </Modal>

      <Modal
        visible={!!activityMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setActivityMenu(null)}
      >
        {activityMenu && (() => {
          const a = activityMenu.activity;
          const dIdx = activityMenu.dayIdx;
          const aIdx = activityMenu.actIdx;
          const hasCoords = a.latitude != null && a.longitude != null;
          const isDraft = itinerary.status === "draft";
          const isActive = itinerary.status === "active";
          const canEditTime = canEdit && (isDraft || (isActive && !a.isCompleted));
          const canEditCost = canEdit && (isDraft || isActive);
          const canMove = canEdit && (isDraft || (isActive && !a.isCompleted));
          const canDelete = canEdit && (isDraft || (isActive && !a.isCompleted));
          const isCompleted = itinerary.status === "completed";

          type Item = {
            key: string;
            icon: any;
            label: string;
            color?: string;
            onPress: () => void;
            external?: boolean;
          };
          const editGroup: Item[] = [];
          const externalGroup: Item[] = [];
          const destructiveGroup: Item[] = [];

          if (canEdit && isActive && !a.isCompleted) {
            editGroup.push({
              key: "mark",
              icon: "checkmark-circle-outline",
              label: "Đánh dấu đã hoàn thành",
              color: colors.success,
              onPress: () => {
                setActivityMenu(null);
                toggleActivityComplete(dIdx, a.id);
              },
            });
          }
          if (canEdit && isActive && a.isCompleted) {
            editGroup.push({
              key: "unmark",
              icon: "ellipse-outline",
              label: "Bỏ đánh dấu hoàn thành",
              onPress: () => {
                setActivityMenu(null);
                toggleActivityComplete(dIdx, a.id);
              },
            });
          }
          if (canEdit) {
            editGroup.push({
              key: "note",
              icon: "document-text-outline",
              label: "Thêm ghi chú",
              onPress: () => {
                setActivityMenu(null);
                setNoteModal({ activityId: a.id, dayIdx: dIdx, note: "" });
              },
            });
          }
          if (canEditCost) {
            editGroup.push({
              key: "cost",
              icon: "cash-outline",
              label: isActive ? "Sửa chi phí thực tế" : "Sửa chi phí dự kiến",
              onPress: () => {
                setActivityMenu(null);
                setCostPaidByDropdown(false);
                setCostModal({
                  activityId: a.id,
                  dayIdx: dIdx,
                  cost: (a.actualCost || 0).toString(),
                  estimatedCost: (a.estimatedCost || 0).toString(),
                  paidBy: a.paidBy || user?.fullName || "",
                  activityTitle: a.title,
                  expenseTypeId: a.expenseTypeId,
                  type: a.activityType || "other",
                });
              },
            });
          }
          if (canEditTime) {
            editGroup.push({
              key: "time",
              icon: "time-outline",
              label: "Sửa giờ",
              onPress: () => {
                setActivityMenu(null);
                setTimeModal({ activityId: a.id, dayIdx: dIdx, time: a.time });
              },
            });
          }
          if (canMove && aIdx > 0) {
            editGroup.push({
              key: "up",
              icon: "arrow-up",
              label: "Di chuyển lên trên",
              onPress: () => {
                setActivityMenu(null);
                moveActivity(dIdx, aIdx, "up");
              },
            });
          }
          if (canMove && aIdx < activityMenu.total - 1) {
            editGroup.push({
              key: "down",
              icon: "arrow-down",
              label: "Di chuyển xuống dưới",
              onPress: () => {
                setActivityMenu(null);
                moveActivity(dIdx, aIdx, "down");
              },
            });
          }
          if (
            itinerary.status !== "draft" &&
            canEdit &&
            a.isCompleted &&
            !getActivityReview(a.id)
          ) {
            editGroup.push({
              key: "review",
              icon: "star-outline",
              label: "Viết đánh giá",
              color: "#F59E0B",
              onPress: () => {
                setActivityMenu(null);
                openReviewModal(a.id, dIdx);
              },
            });
          }
          if (
            itinerary.status !== "draft" &&
            canEdit &&
            a.isCompleted &&
            getActivityReview(a.id)
          ) {
            const rev = getActivityReview(a.id);
            if (rev) {
              editGroup.push({
                key: "review-edit",
                icon: "create-outline",
                label: "Sửa đánh giá",
                onPress: () => {
                  setActivityMenu(null);
                  openReviewModal(a.id, dIdx, rev.id);
                },
              });
              destructiveGroup.push({
                key: "review-delete",
                icon: "trash-outline",
                label: "Xoá đánh giá",
                color: colors.error,
                onPress: () => {
                  setActivityMenu(null);
                  handleDeleteActivityReview(rev.id);
                },
              });
            }
          }
          if (hasCoords) {
            externalGroup.push({
              key: "maps",
              icon: "map-outline",
              label: "Mở Google Maps",
              external: true,
              onPress: () => {
                setActivityMenu(null);
                openGoogleMaps({
                  lat: a.latitude,
                  lng: a.longitude,
                  address: a.address,
                  name: a.title,
                  googlePlaceId: a.googlePlaceId,
                });
              },
            });
            externalGroup.push({
              key: "grab",
              icon: "car-outline",
              label: "Đặt Grab",
              color: "#00B14F",
              external: true,
              onPress: () => {
                setActivityMenu(null);
                openGrab(a.latitude, a.longitude, a.title);
              },
            });
          }
          if (canDelete) {
            destructiveGroup.push({
              key: "delete",
              icon: "trash-outline",
              label: "Xoá địa điểm này",
              color: colors.error,
              onPress: () => {
                setActivityMenu(null);
                deleteActivity(dIdx, a.id);
              },
            });
          }

          const renderItem = (item: Item) => (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.color || colors.text}
              />
              <Text
                style={[
                  styles.menuItemText,
                  { color: item.color || colors.text },
                ]}
              >
                {item.label}
              </Text>
              {item.external && (
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={colors.textTertiary}
                  style={{ marginLeft: "auto" }}
                />
              )}
            </Pressable>
          );

          return (
            <Pressable
              style={styles.sheetOverlay}
              onPress={() => setActivityMenu(null)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={[styles.sheetContent, { backgroundColor: colors.card }]}
              >
                <View style={styles.sheetHandle} />
                <View style={styles.menuHeader}>
                  <Text
                    style={[styles.menuHeaderTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {a.title}
                  </Text>
                  <Text
                    style={[styles.menuHeaderSub, { color: colors.textTertiary }]}
                  >
                    {a.time}
                    {a.duration ? ` · ${formatDuration(a.duration)}` : ""}
                  </Text>
                </View>
                {editGroup.length > 0 && (
                  <View>{editGroup.map(renderItem)}</View>
                )}
                {externalGroup.length > 0 && (
                  <>
                    {editGroup.length > 0 && (
                      <View
                        style={[
                          styles.menuDivider,
                          { backgroundColor: colors.cardBorder },
                        ]}
                      />
                    )}
                    <View>{externalGroup.map(renderItem)}</View>
                  </>
                )}
                {destructiveGroup.length > 0 && (
                  <>
                    {(editGroup.length > 0 || externalGroup.length > 0) && (
                      <View
                        style={[
                          styles.menuDivider,
                          { backgroundColor: colors.cardBorder },
                        ]}
                      />
                    )}
                    <View>{destructiveGroup.map(renderItem)}</View>
                  </>
                )}
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>

      <Modal
        visible={!!routeMapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRouteMapModal(null)}
      >
        {routeMapModal &&
          (() => {
            const day = itinerary.days[routeMapModal.dayIdx];
            if (!day) {
              return (
                <View
                  style={[
                    routeMapStyles.container,
                    { backgroundColor: colors.background },
                  ]}
                />
              );
            }
            const actsWithCoords = day.activities.filter(
              (a) => a.latitude != null && a.longitude != null,
            );
            const uniquePoints: {
              lat: number;
              lng: number;
              name: string;
              type?: string;
              index: number;
              activities: typeof actsWithCoords;
            }[] = [];
            actsWithCoords.forEach((a) => {
              const existing = uniquePoints.find(
                (p) =>
                  Math.abs(p.lat - a.latitude!) < 0.0001 &&
                  Math.abs(p.lng - a.longitude!) < 0.0001,
              );
              if (existing) {
                existing.activities.push(a);
                existing.name = existing.activities.map((act) => act.title).join(" → ");
              } else {
                uniquePoints.push({
                  lat: a.latitude!,
                  lng: a.longitude!,
                  name: a.title,
                  type: a.activityType,
                  index: uniquePoints.length,
                  activities: [a],
                });
              }
            });
            const allSameLocation = uniquePoints.length <= 1 && actsWithCoords.length > 1;
            const mapPoints = uniquePoints.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              name: p.name,
              type: p.type,
              index: p.index,
            }));
            let totalDistanceKm = 0;
            for (let i = 1; i < uniquePoints.length; i++) {
              totalDistanceKm += haversineDistance(
                uniquePoints[i - 1].lat,
                uniquePoints[i - 1].lng,
                uniquePoints[i].lat,
                uniquePoints[i].lng,
              );
            }
            const screenHeight = Dimensions.get("window").height;

            return (
              <View
                style={[
                  routeMapStyles.container,
                  { backgroundColor: colors.background },
                ]}
              >
                <View style={routeMapStyles.mapWrap}>
                  {allSameLocation || uniquePoints.length === 0 ? (
                    <View
                      style={[
                        routeMapStyles.mapPlaceholder,
                        { backgroundColor: colors.inputBg },
                      ]}
                    >
                      <Ionicons name="location" size={42} color={colors.primary} />
                      <Text
                        style={[routeMapStyles.placeholderTitle, { color: colors.text }]}
                      >
                        {uniquePoints.length === 0
                          ? "Ngày này chưa có vị trí"
                          : "Tất cả ở cùng một địa điểm"}
                      </Text>
                      <Text
                        style={[
                          routeMapStyles.placeholderHint,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {uniquePoints.length === 0
                          ? "Thêm địa chỉ cho hoạt động để xem tuyến đường."
                          : "Bản đồ tuyến đường hiển thị khi có nhiều địa điểm khác nhau."}
                      </Text>
                    </View>
                  ) : (
                    <RouteMap
                      points={mapPoints}
                      height={screenHeight * 0.55}
                      colors={colors as any}
                      showRoute={true}
                    />
                  )}

                  <View
                    style={[
                      routeMapStyles.topBar,
                      { paddingTop: insets.top + webTopInset + 8 },
                    ]}
                  >
                    <Pressable
                      onPress={() => setRouteMapModal(null)}
                      hitSlop={6}
                      style={({ pressed }) => [
                        routeMapStyles.topBtn,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Ionicons name="arrow-back" size={20} color="#111827" />
                    </Pressable>
                    <View style={routeMapStyles.topTitleWrap}>
                      <Text style={routeMapStyles.topTitle} numberOfLines={1}>
                        Tuyến đường ngày {day.day}
                      </Text>
                      <Text style={routeMapStyles.topSub} numberOfLines={1}>
                        {actsWithCoords.length} điểm
                        {totalDistanceKm > 0
                          ? ` • ${totalDistanceKm.toFixed(1)} km`
                          : ""}
                      </Text>
                    </View>
                    {actsWithCoords[0] && (
                      <Pressable
                        onPress={() =>
                          openGoogleMaps({
                            lat: actsWithCoords[0].latitude,
                            lng: actsWithCoords[0].longitude,
                            address: actsWithCoords[0].address,
                            name: actsWithCoords[0].title,
                            googlePlaceId: actsWithCoords[0].googlePlaceId,
                          })
                        }
                        hitSlop={6}
                        style={({ pressed }) => [
                          routeMapStyles.topBtn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Ionicons name="open-outline" size={18} color="#111827" />
                      </Pressable>
                    )}
                  </View>
                </View>

                <View
                  style={[
                    routeMapStyles.sheet,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={routeMapStyles.handle} />
                  {itinerary.days.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={routeMapStyles.dayPillsRow}
                    >
                      {itinerary.days.map((d, idx) => {
                        const active = routeMapModal.dayIdx === idx;
                        return (
                          <Pressable
                            key={idx}
                            onPress={() => setRouteMapModal({ dayIdx: idx })}
                            style={({ pressed }) => [
                              routeMapStyles.dayPill,
                              active
                                ? { backgroundColor: colors.primary }
                                : {
                                    backgroundColor: colors.inputBg,
                                    borderColor: colors.cardBorder,
                                    borderWidth: StyleSheet.hairlineWidth,
                                  },
                              { opacity: pressed ? 0.85 : 1 },
                            ]}
                          >
                            {/* Single inline label fits a horizontal pill row
                                better than the previous stacked "N\nNgày". */}
                            <Text
                              style={[
                                routeMapStyles.dayPillCombined,
                                { color: active ? "#fff" : colors.primary },
                              ]}
                            >
                              Ngày {idx + 1}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 4 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text
                      style={[
                        routeMapStyles.sheetTitle,
                        { color: colors.text, marginBottom: 8 },
                      ]}
                      numberOfLines={1}
                    >
                      {day.title?.replace(/^Ngày\s*\d+\s*[-–]?\s*/i, "") || `Ngày ${day.day}`}
                    </Text>
                    {actsWithCoords.length === 0 ? (
                      <View
                        style={[
                          routeMapStyles.emptyState,
                          { backgroundColor: colors.inputBg },
                        ]}
                      >
                        <Ionicons
                          name="location-outline"
                          size={28}
                          color={colors.textTertiary}
                        />
                        <Text
                          style={[
                            routeMapStyles.emptyTitle,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Chưa có địa điểm có toạ độ
                        </Text>
                      </View>
                    ) : (
                      actsWithCoords.map((a, i) => {
                        const isLast = i === actsWithCoords.length - 1;
                        const next = !isLast ? actsWithCoords[i + 1] : null;
                        const segDist =
                          next && next.latitude != null && next.longitude != null
                            ? haversineDistance(
                                a.latitude!,
                                a.longitude!,
                                next.latitude,
                                next.longitude,
                              )
                            : 0;
                        const typeColor =
                          a.activityType === "food" || a.activityType === "restaurant"
                            ? "#F59E0B"
                            : a.activityType === "hotel" ||
                                a.activityType === "accommodation"
                              ? "#EC4899"
                              : a.activityType === "transport" ||
                                  a.activityType === "transit"
                                ? "#10B981"
                                : colors.primary;
                        return (
                          <View key={a.id}>
                            <Pressable
                              onPress={() => {
                                setRouteMapModal(null);
                                setExpandedReviewIds(new Set());
                                setShowAllUserReviews(false);
                                setActivityDetailModal(a);
                              }}
                              style={({ pressed }) => [
                                routeMapStyles.stopRow,
                                { opacity: pressed ? 0.8 : 1 },
                              ]}
                            >
                              <View style={routeMapStyles.stopRail}>
                                <View
                                  style={[
                                    routeMapStyles.stopDot,
                                    { backgroundColor: typeColor },
                                  ]}
                                >
                                  <Text style={routeMapStyles.stopDotText}>{i + 1}</Text>
                                </View>
                                {!isLast && (
                                  <View
                                    style={[
                                      routeMapStyles.stopLine,
                                      { backgroundColor: colors.cardBorder },
                                    ]}
                                  />
                                )}
                              </View>
                              <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                                <View style={routeMapStyles.stopHeadRow}>
                                  <Text
                                    style={[
                                      routeMapStyles.stopTime,
                                      { color: colors.primary },
                                    ]}
                                  >
                                    {a.time}
                                  </Text>
                                  {!!a.duration && (
                                    <View
                                      style={[
                                        routeMapStyles.stopDurChip,
                                        { backgroundColor: colors.inputBg },
                                      ]}
                                    >
                                      <Ionicons
                                        name="hourglass"
                                        size={10}
                                        color={colors.textSecondary}
                                      />
                                      <Text
                                        style={[
                                          routeMapStyles.stopDurText,
                                          { color: colors.textSecondary },
                                        ]}
                                      >
                                        {formatDuration(a.duration)}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <Text
                                  style={[
                                    routeMapStyles.stopTitle,
                                    { color: colors.text },
                                  ]}
                                  numberOfLines={2}
                                >
                                  {a.title}
                                </Text>
                                {a.address && (
                                  <View style={routeMapStyles.stopAddrRow}>
                                    <Ionicons
                                      name="location"
                                      size={12}
                                      color={colors.textTertiary}
                                    />
                                    <Text
                                      style={[
                                        routeMapStyles.stopAddr,
                                        { color: colors.textTertiary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {a.address}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </Pressable>
                            {!isLast && segDist > 0 && (
                              <View style={routeMapStyles.segRow}>
                                <View
                                  style={[
                                    routeMapStyles.segIcon,
                                    { backgroundColor: colors.primary + "15" },
                                  ]}
                                >
                                  <Ionicons
                                    name="navigate"
                                    size={11}
                                    color={colors.primary}
                                  />
                                </View>
                                <Text
                                  style={[
                                    routeMapStyles.segText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  ~{segDist.toFixed(1)} km đến điểm tiếp theo
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              </View>
            );
          })()}
      </Modal>

      <Modal
        visible={!!activityDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setActivityDetailModal(null)}
      >
        <View style={actDetailStyles.overlay}>
          <View style={[actDetailStyles.sheet, { backgroundColor: colors.background }]}>
            {activityDetailModal &&
              (() => {
                const act = activityDetailModal;
                const linkedDest = act.destinationId
                  ? destinations.find((d) => d.id === act.destinationId)
                  : destinations.find((d) => d.name === act.title);
                const linkedPOI = act.poiId ? pois.find((p) => p.id === act.poiId) : null;
                const sampleReviews = linkedDest?.sampleReviews || [];
                const heroImage =
                  activityHeroImages.length > 0
                    ? activityHeroImages[activityHeroIdx % activityHeroImages.length]
                    : null;
                const typeGradients: Record<string, [string, string]> = {
                  food: ["#F59E0B", "#EF4444"],
                  restaurant: ["#F59E0B", "#EF4444"],
                  cafe: ["#FB923C", "#F43F5E"],
                  attraction: ["#3B82F6", "#8B5CF6"],
                  sightseeing: ["#3B82F6", "#8B5CF6"],
                  hotel: ["#EC4899", "#8B5CF6"],
                  accommodation: ["#EC4899", "#8B5CF6"],
                  transport: ["#10B981", "#06B6D4"],
                  transit: ["#10B981", "#06B6D4"],
                  shopping: ["#F472B6", "#A855F7"],
                };
                const heroGradient: [string, string] =
                  typeGradients[act.activityType] || ["#6366F1", "#8B5CF6"];

                const heroOpenHours = act.openHours || linkedPOI?.openHours || "";
                const heroCost =
                  act.estimatedCost > 0
                    ? act.estimatedCost
                    : linkedPOI?.estimatedCost && linkedPOI.estimatedCost > 0
                      ? linkedPOI.estimatedCost
                      : 0;

                const statTiles: Array<{
                  key: string;
                  icon: any;
                  iconBg: string;
                  iconColor: string;
                  value: string;
                  label: string;
                }> = [];
                statTiles.push({
                  key: "duration",
                  icon: "hourglass",
                  iconBg: "#DBEAFE",
                  iconColor: "#3B82F6",
                  value: act.duration || "—",
                  label: txt.estDuration,
                });
                if (heroCost > 0) {
                  statTiles.push({
                    key: "cost",
                    icon: "cash",
                    iconBg: "#D1FAE5",
                    iconColor: "#10B981",
                    value: formatVND(heroCost),
                    label: txt.estimatedCost,
                  });
                }
                if (heroOpenHours) {
                  statTiles.push({
                    key: "hours",
                    icon: "time",
                    iconBg: "#FCE7F3",
                    iconColor: "#EC4899",
                    value: heroOpenHours,
                    label: txt.openHours,
                  });
                }

                return (
                  <>
                    <View style={actDetailStyles.hero}>
                      {heroImage ? (
                        <Image
                          source={{ uri: heroImage }}
                          style={actDetailStyles.heroImage}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <LinearGradient
                          colors={heroGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={actDetailStyles.heroImage}
                        >
                          <Ionicons
                            name={getActivityTypeIcon(act.activityType) as any}
                            size={64}
                            color="rgba(255,255,255,0.35)"
                          />
                        </LinearGradient>
                      )}
                      <LinearGradient
                        colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.65)"]}
                        style={actDetailStyles.heroShade}
                      />
                      {activityHeroImages.length > 1 && (
                        <View style={actDetailStyles.heroDots}>
                          {activityHeroImages.map((_, i) => (
                            <Pressable key={i} onPress={() => setActivityHeroIdx(i)} hitSlop={6}>
                              <View
                                style={[
                                  actDetailStyles.heroDot,
                                  i === activityHeroIdx % activityHeroImages.length &&
                                    actDetailStyles.heroDotActive,
                                ]}
                              />
                            </Pressable>
                          ))}
                        </View>
                      )}
                      <View style={actDetailStyles.heroTopRow}>
                        <Pressable
                          onPress={() => setActivityDetailModal(null)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            actDetailStyles.heroCircleBtn,
                            { backgroundColor: "rgba(255,255,255,0.95)", opacity: pressed ? 0.8 : 1 },
                          ]}
                        >
                          <Ionicons name="close" size={20} color="#111827" />
                        </Pressable>
                        <View style={actDetailStyles.heroChip}>
                          <Ionicons
                            name={getActivityTypeIcon(act.activityType) as any}
                            size={12}
                            color="#fff"
                          />
                          <Text style={actDetailStyles.heroChipText}>
                            {getActivityTypeLabel(act.activityType)}
                          </Text>
                        </View>
                      </View>
                      <View style={actDetailStyles.heroFooter}>
                        <Text style={actDetailStyles.heroTitle} numberOfLines={2}>
                          {act.title}
                        </Text>
                        <View style={actDetailStyles.heroMetaRow}>
                          <View style={actDetailStyles.heroMetaItem}>
                            <Ionicons name="time" size={12} color="rgba(255,255,255,0.9)" />
                            <Text style={actDetailStyles.heroMetaText}>{act.time}</Text>
                          </View>
                          {!!act.duration && (
                            <>
                              <View style={actDetailStyles.heroMetaDot} />
                              <View style={actDetailStyles.heroMetaItem}>
                                <Ionicons
                                  name="hourglass"
                                  size={12}
                                  color="rgba(255,255,255,0.9)"
                                />
                                <Text style={actDetailStyles.heroMetaText}>{act.duration}</Text>
                              </View>
                            </>
                          )}
                          {!!linkedDest?.name && (
                            <>
                              <View style={actDetailStyles.heroMetaDot} />
                              <View style={actDetailStyles.heroMetaItem}>
                                <Ionicons name="location" size={12} color="rgba(255,255,255,0.9)" />
                                <Text style={actDetailStyles.heroMetaText} numberOfLines={1}>
                                  {linkedDest.name}
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={actDetailStyles.scrollContent}
                    >
                      <View style={actDetailStyles.statsStrip}>
                        {statTiles.map((tile) => (
                          <View
                            key={tile.key}
                            style={[
                              actDetailStyles.statTile,
                              { backgroundColor: colors.card, borderColor: colors.cardBorder },
                            ]}
                          >
                            <View
                              style={[actDetailStyles.statIcon, { backgroundColor: tile.iconBg }]}
                            >
                              <Ionicons name={tile.icon} size={14} color={tile.iconColor} />
                            </View>
                            <Text
                              style={[actDetailStyles.statValue, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {tile.value}
                            </Text>
                            <Text
                              style={[
                                actDetailStyles.statLabel,
                                { color: colors.textTertiary },
                              ]}
                              numberOfLines={1}
                            >
                              {tile.label}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {act.address && (
                        <Pressable
                          onPress={() => {
                            if (act.latitude != null && act.longitude != null) {
                              openGoogleMaps({
                                lat: act.latitude,
                                lng: act.longitude,
                                address: act.address,
                                name: act.title,
                                googlePlaceId: act.googlePlaceId,
                              });
                            }
                          }}
                          style={({ pressed }) => [
                            actDetailStyles.addressCard,
                            { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.85 : 1 },
                          ]}
                        >
                          <View
                            style={[
                              actDetailStyles.addressIcon,
                              { backgroundColor: colors.primary + "15" },
                            ]}
                          >
                            <Ionicons name="location" size={16} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[actDetailStyles.addressLabel, { color: colors.textTertiary }]}
                            >
                              Địa chỉ
                            </Text>
                            <Text
                              style={[actDetailStyles.addressText, { color: colors.text }]}
                              numberOfLines={2}
                            >
                              {act.address}
                            </Text>
                          </View>
                          {act.latitude != null && act.longitude != null && (
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={colors.textTertiary}
                            />
                          )}
                        </Pressable>
                      )}

                      <View
                        style={[
                          actDetailStyles.card,
                          { backgroundColor: colors.card, borderColor: colors.cardBorder },
                        ]}
                      >
                        <Text style={[actDetailStyles.cardTitle, { color: colors.text }]}>
                          {txt.activityAbout}
                        </Text>
                        <Text
                          style={[actDetailStyles.description, { color: colors.textSecondary }]}
                        >
                          {linkedPOI?.description || linkedDest?.description || act.description}
                        </Text>
                      </View>

                      {(() => {
                        const googleRating =
                          (act.rating && act.rating > 0 ? act.rating : 0) ||
                          (linkedPOI && linkedPOI.rating > 0 ? linkedPOI.rating : 0);
                        const googleCount =
                          (act.reviewCount && act.reviewCount > 0 ? act.reviewCount : 0) ||
                          (linkedPOI?.reviewCount ?? 0) ||
                          (serpPlaceInfo?.totalReviews ?? 0);
                        const userReviewsForAct = reviews.filter((r) => {
                          const rPoiId = String(r.poiId || "");
                          const rActId = String(r.activityId || "");
                          const targetActId = String(act.id || "");
                          const targetPoiId = String(act.poiId || "");
                          if (targetPoiId && rPoiId === targetPoiId) return true;
                          if (rActId && rActId === targetActId) return true;
                          const tag = r.comment.match(/\[activity:([^\]]+)\]/);
                          if (tag && tag[1] === targetActId) return true;
                          return false;
                        });
                        const userCount = userReviewsForAct.length;
                        const userAvg =
                          userCount > 0
                            ? Math.round(
                                (userReviewsForAct.reduce((s, r) => s + r.rating, 0) / userCount) *
                                  10,
                              ) / 10
                            : 0;
                        if (googleCount === 0 && userCount === 0 && googleRating === 0) return null;
                        return (
                          <View
                            style={[
                              actDetailStyles.ratingSplit,
                              { backgroundColor: colors.card, borderColor: colors.cardBorder },
                            ]}
                          >
                            <View style={actDetailStyles.ratingSplitCol}>
                              <View style={actDetailStyles.ratingSplitHead}>
                                <Ionicons name="logo-google" size={14} color="#4285F4" />
                                <Text
                                  style={[
                                    actDetailStyles.ratingSplitLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  Đánh giá Google Maps
                                </Text>
                              </View>
                              {googleRating > 0 ? (
                                <View style={actDetailStyles.ratingSplitSrcBlock}>
                                  <View style={actDetailStyles.ratingSplitValueRow}>
                                    <Ionicons name="star" size={16} color="#F59E0B" />
                                    <Text
                                      style={[
                                        actDetailStyles.ratingSplitValue,
                                        { color: colors.text },
                                      ]}
                                    >
                                      {googleRating.toFixed(1)}
                                    </Text>
                                  </View>
                                  {googleCount > 0 && (
                                    <Text
                                      style={[
                                        actDetailStyles.ratingSplitCount,
                                        { color: colors.textTertiary },
                                      ]}
                                    >
                                      {googleCount.toLocaleString("vi-VN")} đánh giá
                                    </Text>
                                  )}
                                </View>
                              ) : (
                                <Text
                                  style={[
                                    actDetailStyles.ratingSplitEmpty,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  Chưa có dữ liệu
                                </Text>
                              )}
                            </View>
                            <View
                              style={[
                                actDetailStyles.ratingSplitDivider,
                                { backgroundColor: colors.cardBorder },
                              ]}
                            />
                            <View style={actDetailStyles.ratingSplitCol}>
                              <View style={actDetailStyles.ratingSplitHead}>
                                <Ionicons name="people-circle" size={16} color={colors.primary} />
                                <Text
                                  style={[
                                    actDetailStyles.ratingSplitLabel,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  Cộng đồng PlanGo
                                </Text>
                              </View>
                              {userCount > 0 ? (
                                <View style={actDetailStyles.ratingSplitSrcBlock}>
                                  <View style={actDetailStyles.ratingSplitValueRow}>
                                    <Ionicons name="star" size={16} color="#F59E0B" />
                                    <Text
                                      style={[
                                        actDetailStyles.ratingSplitValue,
                                        { color: colors.text },
                                      ]}
                                    >
                                      {userAvg.toFixed(1)}
                                    </Text>
                                  </View>
                                  <Text
                                    style={[
                                      actDetailStyles.ratingSplitCount,
                                      { color: colors.textTertiary },
                                    ]}
                                  >
                                    {userCount} đánh giá
                                  </Text>
                                </View>
                              ) : (
                                <Text
                                  style={[
                                    actDetailStyles.ratingSplitEmpty,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  Chưa có đánh giá
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })()}

                      {(() => {
                        if (!linkedPOI) return null;
                        return (
                          <>
                            {linkedPOI.googleReviews && linkedPOI.googleReviews.length > 0 && (
                              <>
                                <Text
                                  style={[actDetailStyles.sectionTitle, { color: colors.text }]}
                                >
                                  Google Reviews ({linkedPOI.googleReviews.length})
                                </Text>
                                {linkedPOI.googleReviews.map((review, idx) => (
                                  <View
                                    key={idx}
                                    style={[
                                      actDetailStyles.reviewCard,
                                      { backgroundColor: colors.inputBg },
                                    ]}
                                  >
                                    <View style={actDetailStyles.reviewHeader}>
                                      <View
                                        style={[
                                          actDetailStyles.reviewAvatar,
                                          { backgroundColor: "#4285F4" },
                                        ]}
                                      >
                                        <Text style={actDetailStyles.reviewAvatarText}>
                                          {review.author.charAt(0).toUpperCase()}
                                        </Text>
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <Text
                                          style={[
                                            actDetailStyles.reviewName,
                                            { color: colors.text },
                                          ]}
                                        >
                                          {review.author}
                                        </Text>
                                        <View
                                          style={[
                                            actDetailStyles.sourceBadge,
                                            { backgroundColor: "#4285F420" },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              actDetailStyles.sourceText,
                                              { color: "#4285F4" },
                                            ]}
                                          >
                                            Google
                                          </Text>
                                        </View>
                                      </View>
                                      <View style={{ flexDirection: "row", gap: 2 }}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Ionicons
                                            key={star}
                                            name={star <= review.rating ? "star" : "star-outline"}
                                            size={12}
                                            color="#F59E0B"
                                          />
                                        ))}
                                      </View>
                                    </View>
                                    <Text
                                      style={[
                                        actDetailStyles.reviewComment,
                                        { color: colors.textSecondary },
                                      ]}
                                    >
                                      {review.text}
                                    </Text>
                                    {review.time && (
                                      <Text
                                        style={{
                                          fontSize: 11,
                                          fontFamily: "Inter_400Regular",
                                          color: colors.textTertiary,
                                          marginTop: 4,
                                        }}
                                      >
                                        {review.time}
                                      </Text>
                                    )}
                                  </View>
                                ))}
                              </>
                            )}
                          </>
                        );
                      })()}

                      {sampleReviews.length > 0 && (
                        <>
                          <Text style={[actDetailStyles.sectionTitle, { color: colors.text }]}>
                            {txt.activityReviews}
                          </Text>
                          {sampleReviews.map((review, idx) => (
                            <View
                              key={idx}
                              style={[
                                actDetailStyles.reviewCard,
                                { backgroundColor: colors.inputBg },
                              ]}
                            >
                              <View style={actDetailStyles.reviewHeader}>
                                <View
                                  style={[
                                    actDetailStyles.reviewAvatar,
                                    {
                                      backgroundColor:
                                        review.source === "Google" ? "#4285F4" : "#34E0A1",
                                    },
                                  ]}
                                >
                                  <Text style={actDetailStyles.reviewAvatarText}>
                                    {review.author.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[actDetailStyles.reviewName, { color: colors.text }]}
                                  >
                                    {review.author}
                                  </Text>
                                  <View
                                    style={[
                                      actDetailStyles.sourceBadge,
                                      {
                                        backgroundColor:
                                          review.source === "Google" ? "#4285F420" : "#34E0A120",
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        actDetailStyles.sourceText,
                                        {
                                          color: review.source === "Google" ? "#4285F4" : "#00AA6C",
                                        },
                                      ]}
                                    >
                                      {review.source}
                                    </Text>
                                  </View>
                                </View>
                                <View style={{ flexDirection: "row", gap: 2 }}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Ionicons
                                      key={star}
                                      name={star <= review.rating ? "star" : "star-outline"}
                                      size={12}
                                      color="#F59E0B"
                                    />
                                  ))}
                                </View>
                              </View>
                              <Text
                                style={[
                                  actDetailStyles.reviewComment,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {review.comment}
                              </Text>
                            </View>
                          ))}
                        </>
                      )}

                      {(() => {
                        const actId = act.id;
                        const actPoiInfo = getActivityPoiInfo(act);
                        const actPoiId = String(actPoiInfo?.poiId || "");
                        const targetActId = String(act.id || "");

                        // Debug log to help identify why reviews might be missing
                        if (__DEV__ && act.title.includes("Bát Đàn")) {
                          console.log(
                            `[ReviewDebug] Activity: ${act.title}, ID: ${targetActId}, POI: ${actPoiId}`,
                          );
                          console.log(`[ReviewDebug] Total existing reviews: ${reviews.length}`);
                          if (reviews.length > 0) {
                            const firstRev = reviews[0];
                            console.log(
                              `[ReviewDebug] Sample Review 0: ID=${firstRev.id}, ActID=${firstRev.activityId}, PoiID=${firstRev.poiId}`,
                            );
                          }
                        }

                        const destUserReviews = reviews
                          .filter((r) => {
                            const rPoiId = String(r.poiId || "");
                            const rActId = String(r.activityId || "");
                            const rDestId = String(r.destinationId || "");
                            const targetDestId = String(linkedDest?.id || "");

                            // Match by activityId field (new way)
                            if (rActId && rActId === targetActId) return true;
                            // Match by [activity:xxx] tag in comment (legacy)
                            const activityTag = r.comment.match(/\[activity:([^\]]+)\]/);
                            if (activityTag && activityTag[1] === targetActId) return true;
                            // Match by poiId
                            if (actPoiId && rPoiId === actPoiId) return true;
                            // Match by destinationId (general destination reviews)
                            if (targetDestId && rDestId === targetDestId) {
                              // Only include if no specific activity/poi tag (general review)
                              if (!activityTag && !rActId && !rPoiId) return true;
                            }
                            return false;
                          })
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                          );

                        const formatReviewDate = (dateStr: string) => {
                          const d = new Date(dateStr);
                          return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
                        };

                        const cleanComment = (comment: string) =>
                          comment
                            .replace(/\[activity:[^\]]+\]/g, "")
                            .replace(/\[resetBefore:[^\]]+\]/g, "")
                            .trim();

                        return (
                          <>
                            <View style={userRevStyles.sectionHeader}>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[actDetailStyles.sectionTitle, { color: colors.text }]}
                                >
                                  {txt.userReviewsForDest}
                                </Text>
                              </View>
                              {destUserReviews.length > 0 && (
                                <View
                                  style={[
                                    userRevStyles.countBadge,
                                    { backgroundColor: colors.primary + "15" },
                                  ]}
                                >
                                  <Text
                                    style={[userRevStyles.countText, { color: colors.primary }]}
                                  >
                                    {destUserReviews.length}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {destUserReviews.length === 0 ? (
                              <View
                                style={[
                                  userRevStyles.emptyState,
                                  { backgroundColor: colors.inputBg },
                                ]}
                              >
                                <Ionicons
                                  name="chatbubbles-outline"
                                  size={28}
                                  color={colors.textTertiary}
                                />
                                <Text
                                  style={[
                                    userRevStyles.emptyTitle,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {txt.noUserReviewsYet}
                                </Text>
                                <Text
                                  style={[userRevStyles.emptyHint, { color: colors.textTertiary }]}
                                >
                                  {txt.beFirstToReview}
                                </Text>
                              </View>
                            ) : (
                              <>
                                {(showAllUserReviews
                                  ? destUserReviews
                                  : destUserReviews.slice(0, 5)
                                ).map((review) => {
                                  const reviewColors = [
                                    "#4F46E5",
                                    "#0EA5E9",
                                    "#10B981",
                                    "#F59E0B",
                                    "#EF4444",
                                    "#8B5CF6",
                                  ];
                                  let hash = 0;
                                  for (let ci = 0; ci < review.userName.length; ci++)
                                    hash =
                                      ((hash << 5) - hash + review.userName.charCodeAt(ci)) | 0;
                                  const avatarBg =
                                    reviewColors[Math.abs(hash) % reviewColors.length];
                                  const commentText = cleanComment(review.comment);
                                  const isCurrentUser = review.userId === user?.id;
                                  const isExpanded = expandedReviewIds.has(review.id);
                                  const COMMENT_LIMIT = 100;
                                  const isLong = commentText.length > COMMENT_LIMIT;
                                  const displayComment =
                                    isLong && !isExpanded
                                      ? commentText.slice(0, COMMENT_LIMIT).trimEnd() + "..."
                                      : commentText;

                                  return (
                                    <View
                                      key={review.id}
                                      style={[
                                        userRevStyles.card,
                                        {
                                          backgroundColor: colors.inputBg,
                                          borderColor: isCurrentUser
                                            ? colors.primary + "30"
                                            : "transparent",
                                        },
                                      ]}
                                    >
                                      <View style={userRevStyles.cardHeader}>
                                        <View
                                          style={[
                                            userRevStyles.avatar,
                                            { backgroundColor: avatarBg },
                                          ]}
                                        >
                                          <Text style={userRevStyles.avatarText}>
                                            {review.userName.charAt(0).toUpperCase()}
                                          </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <View style={userRevStyles.nameRow}>
                                            <Text
                                              style={[userRevStyles.name, { color: colors.text }]}
                                            >
                                              {review.userName}
                                            </Text>
                                            {isCurrentUser && (
                                              <View
                                                style={[
                                                  userRevStyles.youBadge,
                                                  { backgroundColor: colors.primary + "15" },
                                                ]}
                                              >
                                                <Text
                                                  style={[
                                                    userRevStyles.youBadgeText,
                                                    { color: colors.primary },
                                                  ]}
                                                >
                                                  {txt.you}
                                                </Text>
                                              </View>
                                            )}
                                          </View>
                                          <Text
                                            style={[
                                              userRevStyles.date,
                                              { color: colors.textTertiary },
                                            ]}
                                          >
                                            {formatReviewDate(review.createdAt)}
                                          </Text>
                                        </View>
                                      </View>

                                      <View style={userRevStyles.ratingRow}>
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Ionicons
                                            key={star}
                                            name={star <= review.rating ? "star" : "star-outline"}
                                            size={14}
                                            color="#F59E0B"
                                          />
                                        ))}
                                        <Text
                                          style={[
                                            userRevStyles.ratingLabel,
                                            { color: colors.textSecondary },
                                          ]}
                                        >
                                          {review.rating === 5
                                            ? txt.ratingExcellent
                                            : review.rating === 4
                                              ? txt.ratingVeryGood
                                              : review.rating === 3
                                                ? txt.ratingGood
                                                : review.rating === 2
                                                  ? txt.ratingFair
                                                  : txt.ratingPoor}
                                        </Text>
                                      </View>

                                      {commentText.length > 0 && (
                                        <View>
                                          <Text
                                            style={[
                                              userRevStyles.comment,
                                              { color: colors.textSecondary },
                                            ]}
                                          >
                                            {displayComment}
                                          </Text>
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
                                              <Text
                                                style={[
                                                  userRevStyles.seeMoreText,
                                                  { color: colors.primary },
                                                ]}
                                              >
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
                                              setReviewPhotos(
                                                Array.isArray((review as any).photos)
                                                  ? ((review as any).photos as string[])
                                                  : [],
                                              );
                                              const activityTag =
                                                review.comment.match(/\[activity:([^\]]+)\]/);
                                              setReviewModal({
                                                activityId: activityTag ? activityTag[1] : "",
                                                dayIdx: 0,
                                                destinationId: review.destinationId,
                                                editReviewId: review.id,
                                              });
                                            }}
                                            style={[
                                              userRevStyles.actionBtn,
                                              { backgroundColor: colors.primary + "10" },
                                            ]}
                                          >
                                            <Ionicons
                                              name="create-outline"
                                              size={14}
                                              color={colors.primary}
                                            />
                                            <Text
                                              style={[
                                                userRevStyles.actionBtnText,
                                                { color: colors.primary },
                                              ]}
                                            >
                                              {txt.editReview}
                                            </Text>
                                          </Pressable>
                                          <Pressable
                                            onPress={() => {
                                              const doDelete = () =>
                                                deleteReview(review.id, {
                                                  userId: user!.id,
                                                  type: "item",
                                                });
                                              if (typeof window !== "undefined" && window.confirm) {
                                                if (window.confirm(txt.deleteReviewConfirm))
                                                  doDelete();
                                              } else {
                                                Alert.alert(
                                                  txt.deleteReview,
                                                  txt.deleteReviewConfirm,
                                                  [
                                                    { text: t().common.cancel, style: "cancel" },
                                                    {
                                                      text: txt.deleteReview,
                                                      style: "destructive",
                                                      onPress: doDelete,
                                                    },
                                                  ],
                                                );
                                              }
                                            }}
                                            style={[
                                              userRevStyles.actionBtn,
                                              { backgroundColor: colors.error + "10" },
                                            ]}
                                          >
                                            <Ionicons
                                              name="trash-outline"
                                              size={14}
                                              color={colors.error}
                                            />
                                            <Text
                                              style={[
                                                userRevStyles.actionBtnText,
                                                { color: colors.error },
                                              ]}
                                            >
                                              {txt.deleteReview}
                                            </Text>
                                          </Pressable>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}

                                {!showAllUserReviews && destUserReviews.length > 5 && (
                                  <Pressable
                                    onPress={() => setShowAllUserReviews(true)}
                                    style={[
                                      userRevStyles.showMoreBtn,
                                      { backgroundColor: colors.inputBg },
                                    ]}
                                  >
                                    <Ionicons
                                      name="chatbubbles-outline"
                                      size={16}
                                      color={colors.primary}
                                    />
                                    <Text
                                      style={[
                                        userRevStyles.showMoreText,
                                        { color: colors.primary },
                                      ]}
                                    >
                                      {txt.moreReviews(destUserReviews.length - 5)}
                                    </Text>
                                    <Ionicons
                                      name="chevron-down"
                                      size={16}
                                      color={colors.primary}
                                    />
                                  </Pressable>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}

                      {/* SerpAPI Google Maps Reviews */}
                      {(() => {
                        const act = activityDetailModal;
                        if (!act) return null;
                        const hasSearchPotential = !!(act.googlePlaceId || act.title);
                        if (!hasSearchPotential && !serpLoading && serpReviews.length === 0)
                          return null;
                        return (
                          <>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginTop: 4,
                              }}
                            >
                              <Text style={[actDetailStyles.sectionTitle, { color: colors.text }]}>
                                {txt.serpReviews}
                              </Text>
                              {serpPlaceInfo && serpPlaceInfo.totalReviews > 0 && (
                                <View
                                  style={[
                                    userRevStyles.countBadge,
                                    { backgroundColor: "#4285F4" + "15" },
                                  ]}
                                >
                                  <Text style={[userRevStyles.countText, { color: "#4285F4" }]}>
                                    {serpPlaceInfo.totalReviews}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {serpLoading && serpReviews.length === 0 && (
                              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_400Regular",
                                    color: colors.textTertiary,
                                    marginTop: 8,
                                  }}
                                >
                                  {txt.serpReviewsLoading}
                                </Text>
                              </View>
                            )}

                            {serpError && serpReviews.length === 0 && (
                              <View
                                style={[
                                  userRevStyles.emptyState,
                                  { backgroundColor: colors.inputBg },
                                ]}
                              >
                                <Ionicons
                                  name="alert-circle-outline"
                                  size={24}
                                  color={colors.textTertiary}
                                />
                                <Text
                                  style={[
                                    userRevStyles.emptyTitle,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {txt.serpReviewsError}
                                </Text>
                              </View>
                            )}

                            {serpReviews.length > 0 &&
                              serpReviews
                                .slice(0, serpReviews.length)
                                .map((review: any, idx: number) => {
                                  const SNIPPET_LIMIT = 150;
                                  const isLongSnippet =
                                    (review.snippet || "").length > SNIPPET_LIMIT;
                                  const isExpandedSnippet = expandedReviewIds.has(`serp_${idx}`);
                                  const displaySnippet =
                                    isLongSnippet && !isExpandedSnippet
                                      ? (review.snippet || "").slice(0, SNIPPET_LIMIT).trimEnd() +
                                        "..."
                                      : review.snippet || "";

                                  return (
                                    <View
                                      key={review.reviewId || idx}
                                      style={[
                                        actDetailStyles.reviewCard,
                                        {
                                          backgroundColor: colors.inputBg,
                                          borderLeftWidth: 3,
                                          borderLeftColor: "#4285F4",
                                        },
                                      ]}
                                    >
                                      <View style={actDetailStyles.reviewHeader}>
                                        {review.authorPhoto ? (
                                          <View
                                            style={[
                                              actDetailStyles.reviewAvatar,
                                              { backgroundColor: "#4285F4", overflow: "hidden" },
                                            ]}
                                          >
                                            <Text style={actDetailStyles.reviewAvatarText}>
                                              {review.author.charAt(0).toUpperCase()}
                                            </Text>
                                          </View>
                                        ) : (
                                          <View
                                            style={[
                                              actDetailStyles.reviewAvatar,
                                              { backgroundColor: "#4285F4" },
                                            ]}
                                          >
                                            <Text style={actDetailStyles.reviewAvatarText}>
                                              {review.author.charAt(0).toUpperCase()}
                                            </Text>
                                          </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: 6,
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            <Text
                                              style={[
                                                actDetailStyles.reviewName,
                                                { color: colors.text },
                                              ]}
                                            >
                                              {review.author}
                                            </Text>
                                            {review.isLocalGuide && (
                                              <View
                                                style={{
                                                  flexDirection: "row",
                                                  alignItems: "center",
                                                  gap: 2,
                                                  backgroundColor: "#4285F4" + "18",
                                                  paddingHorizontal: 6,
                                                  paddingVertical: 1,
                                                  borderRadius: 8,
                                                }}
                                              >
                                                <Ionicons
                                                  name="shield-checkmark"
                                                  size={10}
                                                  color="#4285F4"
                                                />
                                                <Text
                                                  style={{
                                                    fontSize: 9,
                                                    fontFamily: "Inter_600SemiBold",
                                                    color: "#4285F4",
                                                  }}
                                                >
                                                  {txt.serpLocalGuide}
                                                </Text>
                                              </View>
                                            )}
                                          </View>
                                          {review.date && (
                                            <Text
                                              style={{
                                                fontSize: 11,
                                                fontFamily: "Inter_400Regular",
                                                color: colors.textTertiary,
                                                marginTop: 1,
                                              }}
                                            >
                                              {review.date}
                                            </Text>
                                          )}
                                        </View>
                                        <View style={{ flexDirection: "row", gap: 2 }}>
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <Ionicons
                                              key={star}
                                              name={star <= review.rating ? "star" : "star-outline"}
                                              size={12}
                                              color="#F59E0B"
                                            />
                                          ))}
                                        </View>
                                      </View>
                                      {displaySnippet.length > 0 && (
                                        <View>
                                          <Text
                                            style={[
                                              actDetailStyles.reviewComment,
                                              { color: colors.textSecondary },
                                            ]}
                                          >
                                            {displaySnippet}
                                          </Text>
                                          {isLongSnippet && (
                                            <Pressable
                                              onPress={() => {
                                                setExpandedReviewIds((prev) => {
                                                  const next = new Set(prev);
                                                  const key = `serp_${idx}`;
                                                  if (next.has(key)) next.delete(key);
                                                  else next.add(key);
                                                  return next;
                                                });
                                              }}
                                              hitSlop={6}
                                            >
                                              <Text
                                                style={[
                                                  userRevStyles.seeMoreText,
                                                  { color: colors.primary },
                                                ]}
                                              >
                                                {isExpandedSnippet ? txt.seeLess : txt.seeMore}
                                              </Text>
                                            </Pressable>
                                          )}
                                        </View>
                                      )}
                                      {review.likes > 0 && (
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 4,
                                            marginTop: 4,
                                          }}
                                        >
                                          <Ionicons
                                            name="thumbs-up-outline"
                                            size={12}
                                            color={colors.textTertiary}
                                          />
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontFamily: "Inter_400Regular",
                                              color: colors.textTertiary,
                                            }}
                                          >
                                            {txt.serpReviewLikes(review.likes)}
                                          </Text>
                                        </View>
                                      )}
                                      {review.response && (
                                        <View
                                          style={{
                                            marginTop: 8,
                                            paddingLeft: 10,
                                            borderLeftWidth: 2,
                                            borderLeftColor: colors.textTertiary + "40",
                                          }}
                                        >
                                          <Text
                                            style={{
                                              fontSize: 11,
                                              fontFamily: "Inter_600SemiBold",
                                              color: colors.textSecondary,
                                            }}
                                          >
                                            Phản hồi:
                                          </Text>
                                          <Text
                                            style={{
                                              fontSize: 12,
                                              fontFamily: "Inter_400Regular",
                                              color: colors.textTertiary,
                                              marginTop: 2,
                                            }}
                                          >
                                            {review.response.snippet}
                                          </Text>
                                          {review.response.date && (
                                            <Text
                                              style={{
                                                fontSize: 10,
                                                fontFamily: "Inter_400Regular",
                                                color: colors.textTertiary,
                                                marginTop: 2,
                                              }}
                                            >
                                              {review.response.date}
                                            </Text>
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}

                            {serpNextToken && (
                              <Pressable
                                onPress={() => {
                                  if (serpPlaceId && !serpLoading) {
                                    fetchSerpReviews(serpPlaceId, serpNextToken);
                                  }
                                }}
                                style={({ pressed }) => [
                                  userRevStyles.showMoreBtn,
                                  { backgroundColor: colors.inputBg, opacity: pressed ? 0.8 : 1 },
                                ]}
                              >
                                {serpLoading ? (
                                  <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                  <>
                                    <Ionicons
                                      name="chatbubbles-outline"
                                      size={16}
                                      color="#4285F4"
                                    />
                                    <Text
                                      style={[userRevStyles.showMoreText, { color: "#4285F4" }]}
                                    >
                                      {txt.serpReviewsLoadMore}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#4285F4" />
                                  </>
                                )}
                              </Pressable>
                            )}
                          </>
                        );
                      })()}

                      {act.latitude != null && act.longitude != null && (
                        <Pressable
                          onPress={() => {
                            const placeName = act.title || "";
                            const addr = act.address || "";
                            const searchTerm = [placeName, addr].filter(Boolean).join(", ");
                            const query = searchTerm.trim()
                              ? encodeURIComponent(searchTerm.trim())
                              : `${act.latitude},${act.longitude}`;
                            const placeIdParam = act.googlePlaceId
                              ? `&query_place_id=${act.googlePlaceId}`
                              : "";
                            Linking.openURL(
                              `https://www.google.com/maps/search/?api=1&query=${query}${placeIdParam}`,
                            );
                          }}
                          style={({ pressed }) => [
                            actDetailStyles.googleMoreBtn,
                            {
                              backgroundColor: colors.card,
                              borderColor: "#4285F4" + "40",
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                        >
                          <Ionicons name="logo-google" size={16} color="#4285F4" />
                          <Text style={[actDetailStyles.googleMoreText, { color: "#4285F4" }]}>
                            {txt.activitySeeMoreReviews}
                          </Text>
                          <Ionicons name="open-outline" size={14} color="#4285F4" />
                        </Pressable>
                      )}
                    </ScrollView>

                    {act.latitude != null && act.longitude != null && (
                      <View
                        style={[
                          actDetailStyles.bottomBar,
                          { backgroundColor: colors.card, borderTopColor: colors.cardBorder },
                        ]}
                      >
                        <Pressable
                          onPress={() =>
                            openGoogleMaps({
                              lat: act.latitude,
                              lng: act.longitude,
                              address: act.address,
                              name: act.title,
                              googlePlaceId: act.googlePlaceId,
                            })
                          }
                          style={({ pressed }) => [
                            actDetailStyles.bottomBtnPrimary,
                            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                          ]}
                        >
                          <Ionicons name="map" size={18} color="#fff" />
                          <Text style={actDetailStyles.bottomBtnPrimaryText}>{txt.openMaps}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openGrab(act.latitude, act.longitude, act.title)}
                          style={({ pressed }) => [
                            actDetailStyles.bottomBtnSecondary,
                            { backgroundColor: "#00B14F", opacity: pressed ? 0.9 : 1 },
                          ]}
                          hitSlop={6}
                        >
                          <Ionicons name="car" size={20} color="#fff" />
                        </Pressable>
                      </View>
                    )}
                  </>
                );
              })()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!reviewModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setReviewModal(null)}
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      >
        <View style={[styles.reviewFs, { backgroundColor: colors.background }]}>
          <View style={[styles.reviewFsHeader, { paddingTop: insets.top + 6 }]}>
            <Pressable
              onPress={() => setReviewModal(null)}
              hitSlop={8}
              style={[styles.reviewFsClose, { backgroundColor: colors.inputBg }]}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
            <Text
              style={[styles.reviewFsTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {reviewModal?.editReviewId
                ? "Sửa đánh giá"
                : reviewModal?.activityId
                  ? "Đánh giá địa điểm"
                  : "Đánh giá chuyến đi"}
            </Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.reviewFsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {!reviewModal?.activityId && !reviewModal?.editReviewId && (
              <View style={styles.reviewFsCelebrate}>
                <Text style={styles.reviewFsCelebrateEmoji}>🎉</Text>
                <Text
                  style={[
                    styles.reviewFsCelebrateText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Chuyến đi hoàn thành! Hãy chia sẻ cảm nhận của bạn.
                </Text>
              </View>
            )}
            <Text
              style={[styles.reviewFsSubject, { color: colors.text }]}
              numberOfLines={2}
            >
              {reviewModal?.editReviewId
                ? ""
                : reviewModal?.activityId
                  ? itinerary.days[reviewModal.dayIdx]?.activities.find(
                      (a) => a.id === reviewModal.activityId,
                    )?.title || ""
                  : destinations.find(
                      (d) => d.id === reviewModal?.destinationId,
                    )?.name || itinerary.destination}
            </Text>
            <View style={styles.reviewFsStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReviewRating(star);
                  }}
                  hitSlop={4}
                >
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={42}
                    color={star <= reviewRating ? "#F59E0B" : colors.textTertiary}
                  />
                </Pressable>
              ))}
            </View>
            <Text
              style={[styles.reviewFsRatingLabel, { color: colors.textSecondary }]}
            >
              {reviewRating === 5
                ? "Tuyệt vời"
                : reviewRating === 4
                  ? "Rất tốt"
                  : reviewRating === 3
                    ? "Tốt"
                    : reviewRating === 2
                      ? "Tạm được"
                      : "Chưa tốt"}
            </Text>
            <TextInput
              style={[
                styles.reviewFsTextarea,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                },
              ]}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Chia sẻ trải nghiệm của bạn..."
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.reviewFsPhotoSection}>
              <Text style={[styles.reviewFsPhotoLabel, { color: colors.textSecondary }]}>
                Ảnh ({reviewPhotos.length}/10)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewFsPhotoRow}
              >
                {reviewPhotos.map((uri, idx) => (
                  <View key={`${idx}-${uri.slice(0, 24)}`} style={styles.reviewFsPhotoItem}>
                    <Image
                      source={{ uri }}
                      style={styles.reviewFsPhotoImg}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() => removeReviewPhoto(idx)}
                      hitSlop={6}
                      style={styles.reviewFsPhotoRemove}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {reviewPhotos.length < 10 && (
                  <Pressable
                    onPress={pickReviewPhoto}
                    style={[
                      styles.reviewFsPhotoAdd,
                      { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Ionicons name="add" size={26} color={colors.textSecondary} />
                    <Text
                      style={[styles.reviewFsPhotoAddText, { color: colors.textSecondary }]}
                    >
                      Thêm ảnh
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          </ScrollView>
          <View
            style={[
              styles.reviewFsBottomBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.cardBorder,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <Pressable
              onPress={submitActivityReview}
              style={({ pressed }) => [
                styles.reviewFsSubmit,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="paper-plane" size={16} color="#fff" />
              <Text style={styles.reviewFsSubmitText}>
                {reviewModal?.editReviewId ? "Cập nhật" : "Đăng đánh giá"}
              </Text>
            </Pressable>
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
  tripHero: {
    height: 280,
    marginHorizontal: -20,
    backgroundColor: "#E5E7EB",
    position: "relative",
    justifyContent: "space-between",
  },
  tripHeroImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  tripHeroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
  },
  tripHeroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tripHeroActions: { flexDirection: "row", gap: 10 },
  tripHeroFooter: { paddingHorizontal: 20, paddingBottom: 22, gap: 8 },
  tripHeroChipRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  tripHeroStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tripHeroAiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.92)",
  },
  tripHeroStatusText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  tripHeroTitle: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tripHeroMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  tripHeroMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  tripHeroMetaText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tripHeroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  tripHeroDots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tripHeroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  tripHeroDotActive: {
    width: 22,
    backgroundColor: "#fff",
  },
  flatBlock: { paddingVertical: 14 },
  flatStatsGrid: { gap: 12 },
  // Card-like row so the 4 stat tiles stand out on the white background.
  // Without this, the stats just hung in the middle of the page.
  flatStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  flatStatsRowDivider: { height: StyleSheet.hairlineWidth, width: "100%" },
  flatStatItem: { flex: 1, alignItems: "center", gap: 3, minWidth: 0, paddingHorizontal: 2 },
  flatStatValue: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  flatStatValueMoney: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  flatStatLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  flatStatDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  flatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flatRowLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  flatRowValue: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  flatBudget: {
    paddingVertical: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flatBudgetHeadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flatBudgetLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  flatBudgetValue: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  flatLink: { fontSize: 13, fontFamily: "Inter_700Bold" },
  flatProgressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  flatProgressFill: { height: "100%", borderRadius: 3 },
  flatBudgetFootRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flatBudgetFootText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  budgetCompact: {
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  budgetCompactRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  budgetCompactValue: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold" },
  budgetCompactPercent: { fontSize: 13, fontFamily: "Inter_700Bold" },
  budgetCompactTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  budgetCompactFill: { height: "100%", borderRadius: 2 },
  budgetCompactV2: {
    paddingVertical: 14,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  budgetCompactTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetCompactLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  budgetCompactPctWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  budgetCompactPercentV2: { fontSize: 13, fontFamily: "Inter_700Bold" },
  budgetCompactValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  budgetCompactValueV2: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  budgetCompactValueSlash: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0,
  },
  budgetCompactRemaining: { fontSize: 11, fontFamily: "Inter_700Bold" },
  budgetCompactTrackV2: { height: 6, borderRadius: 3, overflow: "hidden" },
  // Standalone "Leave trip" pill — light error tint with matching border
  // and text so it reads as a destructive (not primary) action.
  leaveTripBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1.5,
  },
  leaveTripBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  // Real button look — solid pill with light-tinted background, centered
  // content. Was a plain text row that read like a passive label.
  flatStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1.5,
  },
  flatStatusText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  flatDayBlock: { paddingTop: 8 },
  flatDayHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flatDayLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  flatDayTitle: { fontSize: 19, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  flatDayMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  flatDayMapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  flatDayMapText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  dayQuickActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
    flexWrap: "wrap",
  },
  dayQuickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  dayQuickActionText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  shareFlat: { paddingVertical: 16, gap: 10 },
  shareFlatLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  shareFlatHint: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
  shareFlatPermRow: { flexDirection: "row", gap: 8 },
  shareFlatPerm: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shareFlatPermText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  shareFlatCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  shareFlatCopyText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  flatSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  flatSectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  flatSectionCount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statTilesRow: {
    flexDirection: "row",
    marginTop: -34,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 0,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  statTileCol: { flex: 1, alignItems: "center", gap: 3, minWidth: 0, paddingHorizontal: 2 },
  statTileDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 2 },
  statTileIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statTileValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    maxWidth: "100%",
    textAlign: "center",
  },
  statTileLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  startingPointPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  startingPointLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  startingPointValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  budgetCardV2: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  budgetTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  budgetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(8,145,178,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  budgetTopLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  budgetTopValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  budgetEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetBar: { height: 10, borderRadius: 5, overflow: "hidden" },
  budgetBarFill: { height: "100%", borderRadius: 5 },
  budgetPillsRow: { flexDirection: "row", gap: 8 },
  budgetPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 0,
  },
  budgetPillDot: { width: 6, height: 6, borderRadius: 3 },
  budgetPillLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  budgetPillValue: { fontSize: 12, fontFamily: "Inter_700Bold" },
  statusCta: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statusCtaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusCtaTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statusCtaSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
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
    marginTop: 6,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },
  tabBarInner: {
    flexDirection: "row",
    gap: 18,
    paddingHorizontal: 4,
  },
  tabBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: -StyleSheet.hairlineWidth,
    position: "relative",
  },
  tabBtnRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  tabBtnCount: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 20,
    textAlign: "center",
    overflow: "hidden",
  },
  tabBtnUnderline: {
    position: "absolute",
    bottom: -1,
    height: 3,
    width: 40,
    borderRadius: 2,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  dayBlock: { gap: 10 },
  dayHero: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dayHeroNumBox: {
    width: 64,
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  dayHeroNumLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  dayHeroNum: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    lineHeight: 36,
    marginTop: -2,
  },
  dayHeroDate: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  dayHeroTitle: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 23,
    fontFamily: "Inter_700Bold",
  },
  dayHeroMetaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dayHeroMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dayHeroMetaText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dayHeroMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  dayHeroMapBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  dayQuickRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  dayQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayQuickBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dayCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  dayBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  dayBadgeNum: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 24 },
  dayBadgeLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 1,
  },
  dayBadgeText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  dayTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  dayMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  dayMetaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dayMetaDot: { width: 3, height: 3, borderRadius: 1.5 },
  dayChevron: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activitiesList: { gap: 8, marginTop: 8, marginBottom: 8 },
  activityCard: {
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  activityRail: { width: 32, alignItems: "center", gap: 3, paddingTop: 1 },
  activityRailNum: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  activityCatDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTimeFlat: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  activityTitleFlat: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  activityAddrFlat: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  activityThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: "#E5E7EB" },
  activityMenuBtn: {
    padding: 4,
    marginLeft: -4,
    marginTop: -4,
  },
  swipeLeftAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: 28,
    gap: 8,
    width: "100%",
    height: "100%",
  },
  swipeRightAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 28,
    gap: 8,
    width: "100%",
    height: "100%",
  },
  swipeActionText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  activityChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  activityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activityChipText: { fontSize: 10, fontFamily: "Inter_700Bold", maxWidth: 100 },
  activityActualRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginLeft: 44,
    marginTop: 4,
  },
  activityActualChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 180,
  },
  activityActualText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  activityReviewCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginLeft: 44,
    marginTop: 8,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityReviewCtaText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  addPlaceFlat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingLeft: 8,
    marginLeft: 32,
  },
  addPlaceFlatText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
  removeDayFlat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignSelf: "flex-start",
  },
  removeDayFlatText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addDayDashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 14,
    marginBottom: 4,
  },
  addDayDashedText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: -0.1 },
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
  activityTime: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline" as const,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  activityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activityDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  activityDuration: { fontSize: 11, fontFamily: "Inter_400Regular" },
  costRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 32 },
  costText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  paidByText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  notesContainer: { gap: 8, marginLeft: 44, marginTop: 8 },
  // Sticky-note look: warm amber paper, thick left bar, eyebrow label, body
  // text in dark amber. Mimics the Notion / Apple Reminders attached-note
  // pattern instead of looking like a passive disabled form input.
  noteSticky: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
    gap: 4,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  noteStickyHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  noteStickyLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    color: "#B45309",
  },
  noteStickyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
    color: "#78350F",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  noteText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 19,
  },
  activityActions: { flexDirection: "row", gap: 6, paddingLeft: 32, flexWrap: "wrap" },
  reviewBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginLeft: 32,
  },
  reviewBoxHeader: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  reviewBoxRating: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reviewBoxComment: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, marginLeft: 4 },
  reviewBoxActions: { flexDirection: "row", gap: 10, marginLeft: 8 },
  ratingRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 },
  miniBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
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
  expensesTab: { gap: 0 },
  expSubtab: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    gap: 4,
    marginTop: 12,
    marginBottom: 4,
  },
  expSubtabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 9,
  },
  expSubtabText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyExpenses: { alignItems: "center", paddingVertical: 40, gap: 8 },
  // Card-shaped overview hero — stands out on the now-white page background
  // with a subtle tint, hairline border, and soft shadow. User feedback:
  // "hòa luôn vào nền" → fix by giving it a real card surface.
  expHero: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  expHeroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  expHeroTopV2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  expHeroLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  expHeroValue: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  expHeroValueV2: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  expHeroValueSlash: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: -0.1,
  },
  expHeroPctChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  expHeroPctText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  expHeroTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  expHeroTrackV2: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  expHeroFill: { height: "100%", borderRadius: 4 },
  expHeroRemaining: { fontSize: 12, fontFamily: "Inter_500Medium" },
  expHeroFootRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expHeroFootText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  expCatList: { gap: 10, marginTop: 6 },
  expCatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  expCatDot: { width: 8, height: 8, borderRadius: 4 },
  expCatLabel: { width: 80, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  expCatBarTrack: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  expCatBarFill: { height: "100%", borderRadius: 2.5, opacity: 0.85 },
  expCatValue: { fontSize: 12, fontFamily: "Inter_700Bold", minWidth: 90, textAlign: "right" },
  expDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  expDayHeaderLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  expDayHeaderTotal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  expenseCard: {
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expenseTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  expenseTopV2: { flexDirection: "row", alignItems: "center", gap: 12 },
  expenseIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  expenseMeta: { flexDirection: "row", flexWrap: "wrap" },
  expenseMetaV2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginTop: 3,
  },
  expenseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  expenseChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  expensePaidBy: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  expenseMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  expenseAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  expenseDeltaText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  expenseMenuBtn: {
    position: "absolute",
    top: 8,
    right: 0,
    padding: 6,
  },
  splitSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 54,
    marginTop: 6,
    paddingVertical: 4,
  },
  splitAvatarStack: { flexDirection: "row", alignItems: "center" },
  splitAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  splitAvatarText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  splitSummaryText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },
  settlementRowV2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settlementAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  settlementAvatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  settlementArrow: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  shareHero: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shareHeroHeadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  shareHeroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareHeroTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  shareHeroSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  sharePermRow: { flexDirection: "row", gap: 8 },
  sharePermBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  sharePermText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  shareCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  shareCopyText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  memberAvatarLg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  assigneeTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  assigneeTriggerAvatar: { width: 30, height: 30, borderRadius: 15 },
  assigneeTriggerAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  assigneeTriggerName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  assigneeTriggerSub: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 1 },
  assigneeDropdown: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  assigneeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  assigneeOptionAvatar: { width: 28, height: 28, borderRadius: 14 },
  assigneeOptionName: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  memberName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  memberRoleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  memberRoleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  memberRoleChipText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  memberMenuBtn: {
    padding: 6,
  },
  memberJoinedAt: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0,
  },
  cmpShareBlock: { gap: 10, paddingVertical: 4 },
  cmpLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
  },
  cmpLinkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cmpLinkTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  cmpLinkSubRow: { flexDirection: "row", alignItems: "center", marginTop: 1 },
  cmpLinkSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  cmpCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  cmpCopyBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  cmpChannelRow: { flexDirection: "row", gap: 8 },
  cmpChannel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cmpChannelIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cmpChannelText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  expenseActions: { flexDirection: "row", gap: 6, paddingLeft: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalTitle: { fontSize: 19, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  modalSubLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginTop: 4,
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    minHeight: 46,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 4,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  sheetSaveLink: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sheetTextarea: {
    minHeight: 120,
    maxHeight: 280,
    padding: 14,
    borderRadius: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  timeQuickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  timeQuickChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  timeQuickChipText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  timeBigInput: {
    height: 64,
    borderRadius: 16,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  reviewFs: { flex: 1 },
  reviewFsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  reviewFsClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewFsTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  reviewFsScroll: { padding: 20, paddingTop: 8, gap: 16 },
  reviewFsCelebrate: { alignItems: "center", gap: 4, paddingTop: 8 },
  reviewFsCelebrateEmoji: { fontSize: 40 },
  reviewFsCelebrateText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  reviewFsSubject: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  reviewFsStarsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  reviewFsRatingLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  reviewFsTextarea: {
    minHeight: 140,
    padding: 14,
    borderRadius: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  reviewFsPhotoSection: { marginTop: 16, gap: 8 },
  reviewFsPhotoLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  reviewFsPhotoRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  reviewFsPhotoItem: {
    width: 92,
    height: 92,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
  },
  reviewFsPhotoImg: { width: "100%", height: "100%" },
  reviewFsPhotoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewFsPhotoAdd: {
    width: 92,
    height: 92,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  reviewFsPhotoAddText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  reviewFsBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewFsSubmit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  reviewFsSubmitText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  menuHeader: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 2,
  },
  menuHeaderTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  menuHeaderSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuItemText: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
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
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  splitMemberList: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  splitMembersTitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 },
  splitMemberRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  splitMemberName: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  splitMemberAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  splitAmountInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  splitWarning: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  splitDetails: { paddingLeft: 28, paddingTop: 4, gap: 2 },
  splitDetailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  splitDetailName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  splitDetailAmount: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  // Same card-tint as expHero so the Chia-tiền surface holds its own
  // against the white page background.
  settlementCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  settlementHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  settlementTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  settlementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  settlementName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  settlementOwes: { fontSize: 12, fontFamily: "Inter_400Regular" },
  settlementAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginLeft: "auto" },
  settlementActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e030",
  },
  settlementBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  settlementBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

const sumStyles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    // Same card-tint as expHero / settlementCard so the post-trip summary
    // is visually consistent with the rest of the Chi phí tab and doesn't
    // bleed into the white page background.
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  sectionBody: { paddingHorizontal: 10, paddingBottom: 10, overflow: "visible" as any },
  // Budget overview
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  budgetLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  budgetValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressBg: {
    height: 8,
    borderRadius: 4,
    marginVertical: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  // Table styles
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  tableHeaderRow: {
    borderRadius: 8,
    marginBottom: 2,
  },
  totalRow: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 10,
  },
  thCell: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tdCell: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tdCellSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  cellDay: { width: 44, textAlign: "center" },
  cellName: { flex: 1, minWidth: 60 },
  cellCost: { width: 75, textAlign: "right" },
  cellPayer: { width: 60, textAlign: "center" },
  cellType: { width: 60, textAlign: "center" },
  cellSplit: { width: 60, textAlign: "center" },
  cellAction: { width: 24, alignItems: "center" },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  // Bar chart stats
  statRow: {
    gap: 4,
    marginBottom: 10,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  statPct: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  statBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  statAmount: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "right" },
});

const travelStyles = StyleSheet.create({
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
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    height: "92%",
  },
  hero: {
    height: 240,
    width: "100%",
    backgroundColor: "#E5E7EB",
    position: "relative",
    justifyContent: "space-between",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  heroShade: { ...StyleSheet.absoluteFillObject },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  heroCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heroChipText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  heroFooter: { paddingHorizontal: 20, paddingBottom: 18, gap: 6 },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroMetaText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  heroDots: {
    position: "absolute",
    bottom: 86,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  heroDotActive: {
    width: 22,
    backgroundColor: "#fff",
  },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 14 },
  statsStrip: { flexDirection: "row", gap: 10 },
  statTile: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.2 },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addressLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  addressText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ratingSplit: {
    flexDirection: "column",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 0,
    overflow: "hidden",
  },
  ratingSplitCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 0,
  },
  ratingSplitDivider: { height: StyleSheet.hairlineWidth, width: "100%" },
  ratingSplitHead: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  ratingSplitLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  ratingSplitValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingSplitValue: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 26 },
  ratingSplitCount: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  ratingSplitEmpty: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  ratingSplitSrcBlock: { alignItems: "flex-end", gap: 0, minWidth: 70 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  ratingBar: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 12 },
  ratingText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ratingCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewCard: { borderRadius: 14, padding: 12, gap: 8 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reviewName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  sourceText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  reviewComment: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  googleMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  googleMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bottomBtnPrimaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  bottomBtnSecondary: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
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
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  copyLinkSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    padding: 0,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 64,
    justifyContent: "center",
  },
  inviteBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
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

const routeMapStyles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { position: "relative", overflow: "hidden" },
  mapPlaceholder: {
    height: Dimensions.get("window").height * 0.62,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  placeholderTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  placeholderHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  topTitleWrap: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
  },
  topTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 8,
  },
  dayPillsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillCombined: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  dayPillNum: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 18 },
  dayPillLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyState: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    borderRadius: 14,
  },
  emptyTitle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  stopRow: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  stopRail: { alignItems: "center", width: 28 },
  stopDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  stopDotText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  stopLine: { flex: 1, width: 2, marginTop: 4, marginBottom: -8 },
  stopHeadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopTime: { fontSize: 13, fontFamily: "Inter_700Bold" },
  stopDurChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stopDurText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  stopTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  stopAddrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  stopAddr: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  segRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 40,
    paddingVertical: 4,
  },
  segIcon: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: { fontSize: 11, fontFamily: "Inter_500Medium" },
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
