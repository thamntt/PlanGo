import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import {
  validateRequired,
  validateDate,
  validateDateRange,
  validateNumPeople,
  parseDDMMYYYY,
} from "@/lib/validation";
import { formatVND } from "@/lib/format";
import type { ItineraryDay } from "@/types";
import { t } from "@/lib/i18n";
import {
  useTrips,
  useCreateTrip,
  useDeleteTrip,
  useGenerateItinerary,
  useDestinations,
  usePreferences,
} from "@/hooks/queries";

interface FormErrors {
  destination?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: string;
  budget?: string;
  numPeople?: string;
  startingPoint?: string;
}

// 34 tỉnh & thành phố theo cải cách hành chính 2025 (sau khi sáp nhập từ 63).
// Gồm 6 thành phố trực thuộc Trung ương + 28 tỉnh.
const VIETNAM_CITIES = [
  // Thành phố trực thuộc Trung ương (6)
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Huế",
  // Tỉnh (28) — đã sáp nhập, tên chính thức 2025
  "Cao Bằng",
  "Lạng Sơn",
  "Lai Châu",
  "Điện Biên",
  "Sơn La",
  "Lào Cai", // sáp nhập Lào Cai + Yên Bái
  "Tuyên Quang", // sáp nhập Tuyên Quang + Hà Giang
  "Thái Nguyên", // sáp nhập Thái Nguyên + Bắc Kạn
  "Phú Thọ", // sáp nhập Phú Thọ + Hòa Bình + Vĩnh Phúc
  "Quảng Ninh",
  "Bắc Ninh", // sáp nhập Bắc Ninh + Bắc Giang
  "Hưng Yên", // sáp nhập Hưng Yên + Thái Bình
  "Ninh Bình", // sáp nhập Ninh Bình + Hà Nam + Nam Định
  "Thanh Hóa",
  "Nghệ An",
  "Hà Tĩnh",
  "Quảng Trị", // sáp nhập Quảng Trị + Quảng Bình
  "Quảng Ngãi", // sáp nhập Quảng Ngãi + Kon Tum
  "Gia Lai", // sáp nhập Gia Lai + Bình Định
  "Đắk Lắk", // sáp nhập Đắk Lắk + Phú Yên
  "Khánh Hòa", // sáp nhập Khánh Hòa + Ninh Thuận
  "Lâm Đồng", // sáp nhập Lâm Đồng + Đắk Nông + Bình Thuận
  "Đồng Nai", // sáp nhập Đồng Nai + Bình Phước
  "Tây Ninh", // sáp nhập Tây Ninh + Long An
  "Vĩnh Long", // sáp nhập Vĩnh Long + Bến Tre + Trà Vinh
  "Đồng Tháp", // sáp nhập Đồng Tháp + Tiền Giang
  "An Giang", // sáp nhập An Giang + Kiên Giang
  "Cà Mau", // sáp nhập Cà Mau + Bạc Liêu
];

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Category icon + color mapping for preferences (improves visual richness vs
// plain text chips). Names match seed data; fallback handles unknowns.
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const PREF_VISUAL: Record<string, { icon: IconName; color: string }> = {
  Biển: { icon: "waves", color: "#06B6D4" },
  Núi: { icon: "image-filter-hdr", color: "#10B981" },
  "Thành phố": { icon: "city-variant", color: "#8B5CF6" },
  "Văn hóa": { icon: "drama-masks", color: "#EC4899" },
  "Ẩm thực": { icon: "silverware-fork-knife", color: "#F97316" },
  "Nhiếp ảnh": { icon: "camera", color: "#F43F5E" },
  "Phiêu lưu": { icon: "hiking", color: "#EF4444" },
  "Nghỉ dưỡng": { icon: "spa", color: "#059669" },
  "Lịch sử": { icon: "castle", color: "#D97706" },
  "Thiên nhiên": { icon: "leaf", color: "#84CC16" },
  "Mua sắm": { icon: "shopping", color: "#A855F7" },
  "Giải trí đêm": { icon: "glass-cocktail", color: "#7C3AED" },
  "Tâm linh": { icon: "temple-buddhist", color: "#CA8A04" },
  "Cắm trại": { icon: "tent", color: "#16A34A" },
  "Spa & Wellness": { icon: "spa-outline", color: "#0EA5E9" },
  "Gia đình": { icon: "human-male-female-child", color: "#0891B2" },
  "Hẹn hò": { icon: "heart", color: "#F472B6" },
};
function getPrefVisual(name: string) {
  return PREF_VISUAL[name] || { icon: "tag" as IconName, color: "#64748B" };
}

function formatBudgetInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  return day > start && day < end;
}

export default function CreateTripScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { data: itineraries = [] } = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const { data: destinations = [] } = useDestinations();
  const { data: preferences = [] } = usePreferences();
  const createTripMut = useCreateTrip();
  const deleteTripMut = useDeleteTrip();
  const generateItineraryMut = useGenerateItinerary();
  const params = useLocalSearchParams<{ editId?: string; dest?: string }>();

  const editingItinerary = params.editId ? itineraries.find((i) => i.id === params.editId) : null;
  const isEditing = !!editingItinerary;

  // Multi-destination state (Phase 2 business logic).
  // Each entry has { id, name, days } where days is user-allocated.
  // The first item's name is mirrored to `destination` for backwards-compat
  // with the existing AI/save API.
  const [selectedDestinations, setSelectedDestinations] = useState<
    { id: string; name: string; days: number }[]
  >(
    params.dest
      ? [{ id: "", name: params.dest, days: 0 }]
      : editingItinerary?.destination
        ? [{ id: "", name: editingItinerary.destination, days: 0 }]
        : [],
  );
  const [destination, setDestination] = useState(
    editingItinerary?.destination || params.dest || "",
  );
  const [startingPoint, setStartingPoint] = useState(editingItinerary?.startingPoint || "");
  const [startDate, setStartDate] = useState(editingItinerary?.startDate || "");
  const [endDate, setEndDate] = useState(editingItinerary?.endDate || "");
  const [budgetText, setBudgetText] = useState(
    editingItinerary?.totalBudget ? formatBudgetInput(editingItinerary.totalBudget.toString()) : "",
  );
  const [numPeople, setNumPeople] = useState(editingItinerary?.numPeople?.toString() || "2");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(editingItinerary?.preferences || []);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [previewDays, setPreviewDays] = useState<ItineraryDay[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewExpandedDay, setPreviewExpandedDay] = useState<number | null>(0);
  const [aiError, setAiError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mode selection — null = show picker; "ai" = AI flow; "manual" = self-design.
  // When editing, skip picker (editing existing trip uses the form directly).
  const [mode, setMode] = useState<"ai" | "manual" | null>(isEditing ? "manual" : null);

  const [showStartingSuggestions, setShowStartingSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  // Search query inside the destination picker — separate from the destination
  // string so picking a destination doesn't auto-fill the search box.
  const [destSearch, setDestSearch] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const destinationNames = useMemo(() => destinations.map((d) => d.name), [destinations]);

  const allLocationNames = useMemo(() => {
    const set = new Set([...VIETNAM_CITIES, ...destinationNames]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [destinationNames]);

  const startingSuggestions = useMemo(() => {
    if (!startingPoint.trim()) return allLocationNames;
    const q = startingPoint.toLowerCase().trim();
    return allLocationNames.filter((n) => n.toLowerCase().includes(q));
  }, [startingPoint, allLocationNames]);

  const sortedDestinationNames = useMemo(() => {
    return [...destinationNames].sort((a, b) => a.localeCompare(b, "vi"));
  }, [destinationNames]);

  const destSuggestions = useMemo(() => {
    if (!destSearch.trim()) return sortedDestinationNames;
    const q = destSearch.toLowerCase().trim();
    return sortedDestinationNames.filter((n) => n.toLowerCase().includes(q));
  }, [destSearch, sortedDestinationNames]);

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  };

  // ─── Multi-destination derived state ──
  const tripDays = useMemo(() => {
    const start = parseDDMMYYYY(startDate);
    const end = parseDDMMYYYY(endDate);
    if (!start || !end) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const totalAllocatedDays = useMemo(
    () => selectedDestinations.reduce((sum, d) => sum + (d.days || 0), 0),
    [selectedDestinations],
  );

  // Auto-distribute days when destinations change or tripDays changes.
  // Distribute evenly + give remainder to first destination.
  React.useEffect(() => {
    if (tripDays <= 0 || selectedDestinations.length === 0) return;
    const hasUnset = selectedDestinations.some((d) => d.days === 0);
    if (!hasUnset && totalAllocatedDays === tripDays) return;
    const n = selectedDestinations.length;
    // Single dest gets ALL trip days (no allocation needed)
    if (n === 1) {
      setSelectedDestinations((prev) => prev.map((d) => ({ ...d, days: tripDays })));
      return;
    }
    if (n > tripDays) return; // tight schedule — let warning handle, skip auto-distribute
    const base = Math.floor(tripDays / n);
    const remainder = tripDays - base * n;
    setSelectedDestinations((prev) =>
      prev.map((d, idx) => ({ ...d, days: base + (idx < remainder ? 1 : 0) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripDays, selectedDestinations.length]);

  // Keep primary destination synced (for backward compat with existing API).
  React.useEffect(() => {
    const primary = selectedDestinations[0]?.name || "";
    if (primary !== destination) setDestination(primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDestinations]);

  const addDestination = useCallback(
    (name: string) => {
      setSelectedDestinations((prev) => {
        if (prev.some((d) => d.name === name)) return prev; // already added
        const destObj = destinations.find((d) => d.name === name);
        return [...prev, { id: destObj?.id || "", name, days: 0 }];
      });
      clearError("destination");
      Haptics.selectionAsync();
    },
    [destinations],
  );

  const removeDestination = useCallback((name: string) => {
    setSelectedDestinations((prev) => prev.filter((d) => d.name !== name));
    Haptics.selectionAsync();
  }, []);

  /**
   * Smart day rebalancing: when user adjusts one destination's days, take from
   * (or give to) the others so total stays equal to trip duration.
   * - Increase: pull days from the OTHER dest with most days (down to min 1)
   * - Decrease: give the day to the OTHER dest with fewest days (round-robin)
   * If no other dest can give a day (all at min 1), the increase is blocked.
   */
  const updateDestinationDays = useCallback((name: string, days: number) => {
    setSelectedDestinations((prev) => {
      const idx = prev.findIndex((d) => d.name === name);
      if (idx === -1) return prev;
      const current = prev[idx].days;
      const target = Math.max(1, days);
      const delta = target - current;
      if (delta === 0) return prev;
      const next = prev.map((d) => ({ ...d }));
      const otherIdx = next.map((_, i) => i).filter((i) => i !== idx);
      if (otherIdx.length === 0) return prev; // single dest — nothing to balance against

      if (delta > 0) {
        // Need to take `delta` days from others (largest first)
        let need = delta;
        while (need > 0) {
          // Pick the other with the largest days, must be > 1
          let pickI = -1;
          let pickDays = 1;
          for (const i of otherIdx) {
            if (next[i].days > pickDays) {
              pickDays = next[i].days;
              pickI = i;
            }
          }
          if (pickI === -1) return prev; // can't satisfy — block the change
          next[pickI].days -= 1;
          need -= 1;
        }
        next[idx].days = target;
      } else {
        // Decrease: give days to others (smallest first)
        let give = -delta;
        while (give > 0) {
          let pickI = otherIdx[0];
          for (const i of otherIdx) {
            if (next[i].days < next[pickI].days) pickI = i;
          }
          next[pickI].days += 1;
          give -= 1;
        }
        next[idx].days = target;
      }
      return next;
    });
  }, []);

  const budgetNumber = parseInt(budgetText.replace(/\./g, ""), 10) || 0;

  // Block only when truly nothing to submit (no destinations). Multi-dest in
  // tight time = warning, not hard block — let the user decide (real-world
  // day-trip pattern: e.g. Đà Nẵng + Hội An within 1 day is fine).
  const destinationsInfeasible = selectedDestinations.length === 0;
  const destinationsTightSchedule = tripDays > 0 && selectedDestinations.length > tripDays;

  const handleBudgetChange = (text: string) => {
    const formatted = formatBudgetInput(text);
    setBudgetText(formatted);
    clearError("budget");
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (selectedDestinations.length === 0) {
      newErrors.destination = "Vui lòng chọn ít nhất 1 điểm đến";
    } else if (
      tripDays > 0 &&
      selectedDestinations.length <= tripDays &&
      totalAllocatedDays !== tripDays
    ) {
      // Only enforce day-allocation match when feasible (N dest <= tripDays).
      // Tight schedule (N > tripDays) is a warning, not a block.
      newErrors.destination = `Tổng ${totalAllocatedDays} ngày phân bổ chưa khớp với ${tripDays} ngày chuyến đi`;
    }
    const startErr = validateDate(startDate, t().createTrip.startDate);
    if (startErr) newErrors.startDate = startErr;
    const endErr = validateDate(endDate, t().createTrip.endDate);
    if (endErr) newErrors.endDate = endErr;
    if (!startErr && !endErr) {
      const rangeErr = validateDateRange(startDate, endDate);
      if (rangeErr) newErrors.dateRange = rangeErr;
    }
    if (!budgetText.trim()) {
      newErrors.budget = t().validation.budgetRequired;
    } else if (budgetNumber <= 0) {
      newErrors.budget = t().validation.budgetInvalid;
    }
    const numErr = validateNumPeople(numPeople);
    if (numErr) newErrors.numPeople = numErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchAIDays = async (): Promise<ItineraryDay[] | null> => {
    try {
      // For multi-destination: pass primary as `destination` (backward compat)
      // and include the full `destinations` array so AI/BE can plan trips
      // across multiple cities with correct day allocation + transport.
      const data = await generateItineraryMut.mutateAsync({
        destination: destination.trim(),
        destinations: selectedDestinations.map((d) => ({ name: d.name, days: d.days })),
        startDate,
        endDate,
        budget: formatVND(budgetNumber),
        totalBudget: budgetNumber,
        startingPoint: startingPoint.trim(),
        numPeople: parseInt(numPeople) || 2,
        preferences: selectedPrefs,
      } as any);
      if (data?.days && Array.isArray(data.days)) {
        return data.days as ItineraryDay[];
      }
      return null;
    } catch (e) {
      console.log("AI generation error:", e);
      return null;
    }
  };

  /**
   * Manual mode: skip AI generation entirely. Create the trip with empty days
   * (skeleton) sized to the selected date range, then jump to the itinerary
   * editor where the user fills in activities.
   */
  const handleManualBuild = async () => {
    if (!validate()) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Build empty day skeleton — each day is tagged with its destination
      // based on the user-allocated day count per destination. So Day 1-3 might
      // be "Hà Nội" and Day 4-5 "Hạ Long" in a multi-dest trip.
      const start = parseDDMMYYYY(startDate);
      const end = parseDDMMYYYY(endDate);
      const skeletonDays: ItineraryDay[] = [];
      if (start && end) {
        // Build a per-day destination label by walking the allocation
        const dayDestLabel: string[] = [];
        for (const dest of selectedDestinations) {
          for (let j = 0; j < dest.days; j++) dayDestLabel.push(dest.name);
        }
        const diffMs = end.getTime() - start.getTime();
        const numDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        for (let i = 0; i < numDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          skeletonDays.push({
            day: i + 1,
            date: formatDateDDMMYYYY(d),
            location: dayDestLabel[i] || destination,
            title: dayDestLabel[i] || destination || `Ngày ${i + 1}`,
            activities: [],
          } as ItineraryDay);
        }
      }

      if (isEditing && editingItinerary) {
        await deleteTripMut.mutateAsync(editingItinerary.id);
      }
      const itin = await createTripMut.mutateAsync({
        destination: destination.trim(),
        destinations: selectedDestinations.map((d) => ({ name: d.name, days: d.days })),
        startDate,
        endDate,
        budget: formatVND(budgetNumber),
        totalBudget: budgetNumber,
        startingPoint: startingPoint.trim(),
        numPeople: parseInt(numPeople) || 2,
        preferences: selectedPrefs,
        userId: user!.id,
        days: skeletonDays,
      } as any);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/itinerary/[id]",
        params: { id: itin.id, fresh: "1" },
      });
    } catch {
      Alert.alert(t().common.error, "Không tạo được chuyến đi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!validate()) return;

    setLoading(true);
    setAiError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const aiDays = await fetchAIDays();

    if (aiDays && aiDays.length > 0) {
      setPreviewDays(aiDays);
      setPreviewExpandedDay(0);
      setShowPreview(true);
      setAiError(false);
    } else {
      // AI failed — generate locally and save directly (old flow)
      setAiError(true);
      try {
        if (isEditing && editingItinerary) {
          await deleteTripMut.mutateAsync(editingItinerary.id);
        }
        const itin = await createTripMut.mutateAsync({
          destination: destination.trim(),
          startDate,
          endDate,
          budget: formatVND(budgetNumber),
          totalBudget: budgetNumber,
          startingPoint: startingPoint.trim(),
          numPeople: parseInt(numPeople) || 2,
          preferences: selectedPrefs,
          userId: user!.id,
        } as any);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: "/itinerary/[id]", params: { id: itin.id } });
      } catch (e) {
        Alert.alert(t().common.error, t().createTrip.generateFailed);
      }
    }
    setLoading(false);
  };

  const handleSavePreview = async () => {
    if (!previewDays) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isEditing && editingItinerary) {
        await deleteTripMut.mutateAsync(editingItinerary.id);
      }
      const itin = await createTripMut.mutateAsync({
        destination: destination.trim(),
        destinations: selectedDestinations.map((d) => ({ name: d.name, days: d.days })),
        startDate,
        endDate,
        budget: formatVND(budgetNumber),
        totalBudget: budgetNumber,
        startingPoint: startingPoint.trim(),
        numPeople: parseInt(numPeople) || 2,
        preferences: selectedPrefs,
        userId: user!.id,
        days: previewDays,
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPreview(false);
      router.replace({ pathname: "/itinerary/[id]", params: { id: itin.id } });
    } catch (e) {
      Alert.alert(t().common.error, t().createTrip.generateFailed);
    }
    setSaving(false);
  };

  const handleRegenerate = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const aiDays = await fetchAIDays();

    if (aiDays && aiDays.length > 0) {
      setPreviewDays(aiDays);
      setPreviewExpandedDay(0);
    } else {
      if (Platform.OS === "web") {
        window.alert("Không thể tạo lại lịch trình AI. Vui lòng thử lại.");
      } else {
        Alert.alert("", "Không thể tạo lại lịch trình AI. Vui lòng thử lại.");
      }
    }
    setLoading(false);
  };

  const previewTotalCost = useMemo(() => {
    if (!previewDays) return 0;
    return previewDays.reduce(
      (sum, day) => sum + day.activities.reduce((s, a) => s + (a.estimatedCost || 0), 0),
      0,
    );
  }, [previewDays]);

  const openCalendar = useCallback(() => {
    const existingStart = startDate ? parseDDMMYYYY(startDate) : null;
    const existingEnd = endDate ? parseDDMMYYYY(endDate) : null;
    if (existingStart) {
      setRangeStart(existingStart);
      setCalendarMonth(existingStart.getMonth());
      setCalendarYear(existingStart.getFullYear());
    } else {
      const now = new Date();
      setRangeStart(null);
      setCalendarMonth(now.getMonth());
      setCalendarYear(now.getFullYear());
    }
    setRangeEnd(existingEnd);
    setShowStartingSuggestions(false);
    setShowDestSuggestions(false);
    setShowCalendar(true);
  }, [startDate, endDate]);

  const handleCalendarDayPress = useCallback(
    (day: Date) => {
      Haptics.selectionAsync();
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(day);
        setRangeEnd(null);
      } else {
        if (day < rangeStart) {
          setRangeStart(day);
          setRangeEnd(null);
        } else {
          const diffDays = Math.ceil(
            (day.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays > 30) {
            Alert.alert(t().common.error, t().validation.maxTripDuration);
            return;
          }
          setRangeEnd(day);
        }
      }
    },
    [rangeStart, rangeEnd],
  );

  const confirmDateRange = useCallback(() => {
    if (rangeStart && rangeEnd) {
      setStartDate(formatDateDDMMYYYY(rangeStart));
      setEndDate(formatDateDDMMYYYY(rangeEnd));
      clearError("startDate");
      clearError("endDate");
      clearError("dateRange");
      setShowCalendar(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [rangeStart, rangeEnd]);

  const goToPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
    const adjustedFirst = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: (Date | null)[] = [];
    for (let i = 0; i < adjustedFirst; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(calendarYear, calendarMonth, i));
    return days;
  }, [calendarYear, calendarMonth]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];

  const isPrevDisabled = calendarYear === today.getFullYear() && calendarMonth <= today.getMonth();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Simplified AI Loading Modal */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <BlurView
            intensity={20}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: colors.card, borderColor: colors.inputBorder },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              AI đang phân tích và tạo chuyến đi của bạn, vui lòng chờ...
            </Text>
          </View>
        </View>
      </Modal>

      {/* Header chỉ hiện ở form steps. Mode picker dùng edge-swipe gesture
          (vuốt cạnh) để back — không cần arrow. */}
      {(mode !== null || isEditing) && (
        <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
          <Pressable
            onPress={() => {
              if (mode && !isEditing) setMode(null);
              else if (router.canGoBack()) router.back();
              else router.replace("/(tabs)");
            }}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: pressed ? 0.18 : 0.08,
                shadowRadius: pressed ? 8 : 4,
                elevation: pressed ? 4 : 2,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isEditing ? t().itinerary.editTrip : mode === "ai" ? "Tạo bằng AI" : "Tự thiết kế"}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* ═══════ MODE SELECTION — Original simple cards ═══════ */}
      {mode === null && !isEditing && (
        <View style={{ flex: 1 }}>
          {/* Subtle PlanGo brand-tinted background — diagonal wash fading to
              theme bg so it feels distinct from inner cards but not garish. */}
          <LinearGradient
            colors={
              isDark
                ? [colors.primary + "26", colors.background, colors.accent + "1A"]
                : [colors.primary + "1A", colors.background, colors.accent + "12"]
            }
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Circular close (X) — top-right, replaces back arrow */}
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            style={({ pressed }) => [
              {
                position: "absolute",
                top: insets.top + webTopInset + 12,
                right: 20,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: pressed ? 0.18 : 0.08,
                shadowRadius: pressed ? 8 : 4,
                elevation: pressed ? 4 : 2,
                opacity: pressed ? 0.85 : 1,
                zIndex: 10,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>

          <ScrollView
            contentContainerStyle={{
              padding: 20,
              paddingTop: insets.top + webTopInset + 64,
              gap: 18,
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: "Inter_700Bold",
                  color: colors.text,
                  textAlign: "center",
                  letterSpacing: -0.2,
                }}
              >
                Hôm nay bạn muốn đi đâu?
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: colors.textSecondary,
                  marginTop: 8,
                  textAlign: "center",
                  maxWidth: 280,
                  lineHeight: 19,
                }}
              >
                Chọn cách bạn muốn lên kế hoạch cho chuyến đi
              </Text>
            </View>

            {/* AI option card — whole card is tappable */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setMode("ai");
              }}
              style={({ pressed }) => [
                modeCardStyles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: pressed ? colors.primary : colors.primary + "40",
                  borderWidth: pressed ? 2 : 1.5,
                  opacity: pressed ? 0.96 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  shadowOpacity: pressed ? 0.18 : 0.06,
                  shadowRadius: pressed ? 14 : 6,
                  shadowOffset: { width: 0, height: pressed ? 6 : 2 },
                  shadowColor: colors.primary,
                  elevation: pressed ? 8 : 2,
                },
              ]}
            >
              <View style={modeCardStyles.gradientWrap}>
                <View
                  style={[modeCardStyles.gradientBg, { backgroundColor: colors.primary + "12" }]}
                />
              </View>
              <View style={modeCardStyles.cardHeader}>
                <View style={[modeCardStyles.iconCircle, { backgroundColor: colors.primary }]}>
                  <Ionicons name="sparkles" size={24} color="#fff" />
                </View>
                <View style={modeCardStyles.recommendBadge}>
                  <Text style={modeCardStyles.recommendBadgeText}>Đề xuất</Text>
                </View>
              </View>
              <Text style={[modeCardStyles.cardTitle, { color: colors.text }]}>AI gợi ý</Text>
              <Text style={[modeCardStyles.cardDesc, { color: colors.textSecondary }]}>
                Để AI phân tích sở thích và tự động tạo lịch trình hoàn chỉnh
              </Text>
              <View style={modeCardStyles.benefitList}>
                <View style={modeCardStyles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={[modeCardStyles.benefitText, { color: colors.text }]}>
                    Nhanh, chỉ vài giây
                  </Text>
                </View>
                <View style={modeCardStyles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={[modeCardStyles.benefitText, { color: colors.text }]}>
                    Tự động phân bổ thời gian, chi phí
                  </Text>
                </View>
                <View style={modeCardStyles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={[modeCardStyles.benefitText, { color: colors.text }]}>
                    Gợi ý địa điểm nổi tiếng theo sở thích
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Manual option card — whole card is tappable */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setMode("manual");
              }}
              style={({ pressed }) => [
                modeCardStyles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: pressed ? colors.accent : colors.accent + "40",
                  borderWidth: pressed ? 2 : 1.5,
                  opacity: pressed ? 0.96 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  shadowOpacity: pressed ? 0.18 : 0.06,
                  shadowRadius: pressed ? 14 : 6,
                  shadowOffset: { width: 0, height: pressed ? 6 : 2 },
                  shadowColor: colors.accent,
                  elevation: pressed ? 8 : 2,
                },
              ]}
            >
              <View style={modeCardStyles.gradientWrap}>
                <View
                  style={[modeCardStyles.gradientBg, { backgroundColor: colors.accent + "12" }]}
                />
              </View>
              <View style={modeCardStyles.cardHeader}>
                <View style={[modeCardStyles.iconCircle, { backgroundColor: colors.accent }]}>
                  <Ionicons name="brush" size={24} color="#fff" />
                </View>
              </View>
              <Text style={[modeCardStyles.cardTitle, { color: colors.text }]}>Tự thiết kế</Text>
              <Text style={[modeCardStyles.cardDesc, { color: colors.textSecondary }]}>
                Tự tay lên kế hoạch chi tiết theo ý thích của bạn
              </Text>
              <View style={modeCardStyles.benefitList}>
                <View style={modeCardStyles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  <Text style={[modeCardStyles.benefitText, { color: colors.text }]}>
                    Toàn quyền kiểm soát từng hoạt động
                  </Text>
                </View>
                <View style={modeCardStyles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  <Text style={[modeCardStyles.benefitText, { color: colors.text }]}>
                    Linh hoạt thêm/sửa/sắp xếp
                  </Text>
                </View>
                <View style={modeCardStyles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  <Text style={[modeCardStyles.benefitText, { color: colors.text }]}>
                    Phù hợp khi đã có ý tưởng cụ thể
                  </Text>
                </View>
              </View>
            </Pressable>

            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_400Regular",
                color: colors.textTertiary,
                textAlign: "center",
                marginTop: 12,
                fontStyle: "italic",
              }}
            >
              Có thể đổi giữa AI và tự thiết kế bất cứ lúc nào sau khi tạo chuyến đi
            </Text>
          </ScrollView>
        </View>
      )}

      {/* ═══════ FORM — Modern card-based layout ═══════ */}
      {(mode !== null || isEditing) && (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 100,
            gap: 14,
            paddingTop: 4,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Starting point card */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowStartingSuggestions(true);
            }}
            style={({ pressed }) => [
              f.fieldCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                opacity: pressed ? 0.95 : 1,
              },
            ]}
          >
            <View style={f.fieldHead}>
              <View style={[f.fieldIcon, { backgroundColor: "#06B6D4" + "1A" }]}>
                <Ionicons name="navigate" size={16} color="#06B6D4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[f.fieldLabel, { color: colors.text }]}>Điểm xuất phát</Text>
                <Text style={[f.fieldHint, { color: colors.textTertiary }]}>
                  Nơi bạn bắt đầu chuyến đi (không bắt buộc)
                </Text>
              </View>
            </View>
            <View
              style={[
                f.dateBox,
                {
                  backgroundColor: colors.inputBg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                },
              ]}
            >
              <Text
                style={[
                  f.datePlaceholder,
                  { color: startingPoint ? colors.text : colors.textTertiary, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {startingPoint || "Chọn thành phố xuất phát..."}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
            </View>
          </Pressable>

          {/* Multi-destination card */}
          <View
            style={[
              f.fieldCard,
              {
                backgroundColor: colors.card,
                borderColor: errors.destination ? colors.error : colors.cardBorder,
              },
            ]}
          >
            <View style={f.fieldHead}>
              <View style={[f.fieldIcon, { backgroundColor: colors.primary + "1A" }]}>
                <Ionicons name="location" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[f.fieldLabel, { color: colors.text }]}>Điểm đến</Text>
                {selectedDestinations.length > 0 && tripDays > 0 && (
                  <Text
                    style={[
                      f.fieldHint,
                      {
                        color: destinationsTightSchedule
                          ? colors.warning
                          : totalAllocatedDays === tripDays
                            ? colors.success
                            : colors.textSecondary,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {destinationsTightSchedule
                      ? `Lịch trình khá gấp — ${selectedDestinations.length} điểm trong ${tripDays} ngày, cân nhắc đi day-trip`
                      : selectedDestinations.length === 1
                        ? `Toàn bộ ${tripDays} ngày ở ${selectedDestinations[0].name}`
                        : tripDays === selectedDestinations.length
                          ? `Mỗi điểm 1 ngày — vừa khít ${tripDays} ngày chuyến đi`
                          : `${totalAllocatedDays}/${tripDays} ngày đã phân bổ`}
                  </Text>
                )}
              </View>
            </View>

            {/* Selected destinations as chips with day stepper */}
            {selectedDestinations.length === 0 ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDestSuggestions(true);
                }}
                style={({ pressed }) => [
                  f.dateBox,
                  {
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[f.datePlaceholder, { color: colors.textTertiary, flex: 1 }]}>
                  Chọn 1 hoặc nhiều điểm đến
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </Pressable>
            ) : (
              <View style={{ gap: 8 }}>
                {selectedDestinations.map((dest, idx) => {
                  // Hide stepper when allocation either doesn't make sense or has
                  // no flexibility to change anything:
                  // - Only 1 destination (gets all days automatically)
                  // - Trip is 1 day total (nothing to allocate)
                  // - Tight schedule (N > tripDays — day-trip mode)
                  // - Exactly 1 day per dest (N === tripDays — no flexibility)
                  const hideStepper =
                    selectedDestinations.length === 1 ||
                    tripDays <= 1 ||
                    destinationsTightSchedule ||
                    tripDays === selectedDestinations.length;
                  return (
                    <View
                      key={dest.name}
                      style={[
                        f.destChip,
                        { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                      ]}
                    >
                      <View style={[f.destOrderDot, { backgroundColor: colors.primary }]}>
                        <Text style={f.destOrderText}>{idx + 1}</Text>
                      </View>
                      <Text style={[f.destChipName, { color: colors.text }]} numberOfLines={1}>
                        {dest.name}
                      </Text>
                      {/* Day stepper hidden when allocation isn't meaningful
                        (single dest / 1-day trip / day-trip tight schedule). */}
                      {!hideStepper && (
                        <View style={f.destDaysRow}>
                          <Pressable
                            onPress={() => updateDestinationDays(dest.name, dest.days - 1)}
                            disabled={dest.days <= 1}
                            hitSlop={4}
                            style={({ pressed }) => [
                              f.destDayBtn,
                              {
                                backgroundColor: colors.card,
                                borderColor: colors.cardBorder,
                                opacity: dest.days <= 1 ? 0.4 : pressed ? 0.7 : 1,
                              },
                            ]}
                          >
                            <Ionicons name="remove" size={14} color={colors.text} />
                          </Pressable>
                          <Text style={[f.destDayValue, { color: colors.text }]}>{dest.days}</Text>
                          <Text style={[f.destDayUnit, { color: colors.textTertiary }]}>ngày</Text>
                          {(() => {
                            const canIncrease = selectedDestinations.some(
                              (d) => d.name !== dest.name && d.days > 1,
                            );
                            return (
                              <Pressable
                                onPress={() => updateDestinationDays(dest.name, dest.days + 1)}
                                disabled={!canIncrease}
                                hitSlop={4}
                                style={({ pressed }) => [
                                  f.destDayBtn,
                                  {
                                    backgroundColor: colors.card,
                                    borderColor: colors.cardBorder,
                                    opacity: !canIncrease ? 0.4 : pressed ? 0.7 : 1,
                                  },
                                ]}
                              >
                                <Ionicons name="add" size={14} color={colors.text} />
                              </Pressable>
                            );
                          })()}
                        </View>
                      )}
                      <Pressable
                        onPress={() => removeDestination(dest.name)}
                        hitSlop={6}
                        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                      </Pressable>
                    </View>
                  );
                })}

                {/* Add more button */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowDestSuggestions(true);
                  }}
                  style={({ pressed }) => [
                    f.addMoreBtn,
                    { borderColor: colors.primary + "60", opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[f.addMoreBtnText, { color: colors.primary }]}>Thêm điểm đến</Text>
                </Pressable>
              </View>
            )}
            {errors.destination && (
              <Text style={[f.errorText, { color: colors.error }]}>{errors.destination}</Text>
            )}
          </View>

          {/* Date range card */}
          <Pressable
            onPress={openCalendar}
            style={({ pressed }) => [
              f.fieldCard,
              {
                backgroundColor: colors.card,
                borderColor:
                  errors.startDate || errors.endDate || errors.dateRange
                    ? colors.error
                    : colors.cardBorder,
                opacity: pressed ? 0.95 : 1,
              },
            ]}
          >
            <View style={f.fieldHead}>
              <View style={[f.fieldIcon, { backgroundColor: "#10B981" + "1A" }]}>
                <Ionicons name="calendar" size={16} color="#10B981" />
              </View>
              <Text style={[f.fieldLabel, { color: colors.text }]}>Thời gian chuyến đi</Text>
            </View>
            <View style={[f.dateBox, { backgroundColor: colors.inputBg }]}>
              {startDate && endDate ? (
                <View style={f.dateRowFilled}>
                  <View style={{ flex: 1 }}>
                    <Text style={[f.dateSubLabel, { color: colors.textTertiary }]}>BẮT ĐẦU</Text>
                    <Text style={[f.dateValue, { color: colors.text }]}>{startDate}</Text>
                  </View>
                  <View style={[f.dateArrow, { backgroundColor: colors.card }]}>
                    <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={[f.dateSubLabel, { color: colors.textTertiary }]}>KẾT THÚC</Text>
                    <Text style={[f.dateValue, { color: colors.text }]}>{endDate}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[f.datePlaceholder, { color: colors.textTertiary }]}>
                  {t().createTrip.selectDateRange}
                </Text>
              )}
            </View>
            {(errors.startDate || errors.endDate || errors.dateRange) && (
              <Text style={[f.errorText, { color: colors.error }]}>
                {errors.startDate || errors.endDate || errors.dateRange}
              </Text>
            )}
          </Pressable>

          {/* People card */}
          <View
            style={[
              f.fieldCard,
              {
                backgroundColor: colors.card,
                borderColor: errors.numPeople ? colors.error : colors.cardBorder,
              },
            ]}
          >
            <View style={f.fieldHead}>
              <View style={[f.fieldIcon, { backgroundColor: "#F97316" + "1A" }]}>
                <Ionicons name="people" size={16} color="#F97316" />
              </View>
              <Text style={[f.fieldLabel, { color: colors.text }]}>Số người</Text>
            </View>
            <View style={f.counterRowNew}>
              <Pressable
                onPress={() => {
                  const n = Math.max(1, (parseInt(numPeople) || 2) - 1);
                  setNumPeople(n.toString());
                  clearError("numPeople");
                  Haptics.selectionAsync();
                }}
                style={({ pressed }) => [
                  f.counterBtnNew,
                  { backgroundColor: colors.inputBg, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </Pressable>
              <Text style={[f.counterValueNew, { color: colors.text }]}>{numPeople}</Text>
              <Pressable
                onPress={() => {
                  const n = Math.min(50, (parseInt(numPeople) || 2) + 1);
                  setNumPeople(n.toString());
                  clearError("numPeople");
                  Haptics.selectionAsync();
                }}
                style={({ pressed }) => [
                  f.counterBtnNew,
                  { backgroundColor: colors.inputBg, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </Pressable>
            </View>
            {errors.numPeople && (
              <Text style={[f.errorText, { color: colors.error }]}>{errors.numPeople}</Text>
            )}
          </View>

          {/* Budget card — full width to fit "1.500.000.000 VND" comfortably */}
          <View
            style={[
              f.fieldCard,
              {
                backgroundColor: colors.card,
                borderColor: errors.budget ? colors.error : colors.cardBorder,
              },
            ]}
          >
            <View style={f.fieldHead}>
              <View style={[f.fieldIcon, { backgroundColor: "#8B5CF6" + "1A" }]}>
                <MaterialCommunityIcons name="wallet" size={16} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[f.fieldLabel, { color: colors.text }]}>Ngân sách</Text>
                {budgetNumber > 0 && (
                  <Text style={[f.fieldHint, { color: "#8B5CF6" }]} numberOfLines={1}>
                    {formatVND(budgetNumber)}
                  </Text>
                )}
              </View>
            </View>
            <View style={[f.inputRow, { backgroundColor: colors.inputBg }]}>
              <TextInput
                style={[f.input, { color: colors.text }]}
                placeholder={t().createTrip.budgetPlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={budgetText}
                onChangeText={handleBudgetChange}
                keyboardType="numeric"
              />
              <Text style={[f.unitText, { color: colors.textSecondary }]}>VND</Text>
            </View>
            {errors.budget && (
              <Text style={[f.errorText, { color: colors.error }]}>{errors.budget}</Text>
            )}
          </View>

          {/* Preferences — AI mode only */}
          {mode !== "manual" && preferences.length > 0 && (
            <View
              style={[
                f.fieldCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={f.fieldHead}>
                <View style={[f.fieldIcon, { backgroundColor: "#EC4899" + "1A" }]}>
                  <Ionicons name="heart" size={16} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[f.fieldLabel, { color: colors.text }]}>Sở thích du lịch</Text>
                  <Text style={[f.fieldHint, { color: colors.textTertiary }]}>
                    Để AI gợi ý phù hợp với bạn
                  </Text>
                </View>
                {selectedPrefs.length > 0 && (
                  <View style={[f.prefCounter, { backgroundColor: "#EC4899" + "20" }]}>
                    <Text style={[f.prefCounterText, { color: "#EC4899" }]}>
                      {selectedPrefs.length}/{preferences.length}
                    </Text>
                  </View>
                )}
              </View>
              <View style={f.chipGridNew}>
                {preferences.map((prefObj) => {
                  const pref = prefObj.preferenceName;
                  const isSelected = selectedPrefs.includes(pref);
                  const visual = getPrefVisual(pref);
                  return (
                    <Pressable
                      key={prefObj.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        togglePref(pref);
                      }}
                      style={({ pressed }) => [
                        f.prefChip,
                        {
                          backgroundColor: isSelected ? visual.color : colors.inputBg,
                          borderColor: isSelected ? visual.color : "transparent",
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={visual.icon}
                        size={15}
                        color={isSelected ? "#fff" : visual.color}
                      />
                      <Text style={[f.prefChipText, { color: isSelected ? "#fff" : colors.text }]}>
                        {pref}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={14} color="#fff" />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable
            onPress={mode === "manual" ? handleManualBuild : handleGenerate}
            disabled={loading || destinationsInfeasible}
            style={({ pressed }) => [
              styles.generateButton,
              {
                backgroundColor: mode === "manual" ? colors.accent : colors.primary,
                opacity: destinationsInfeasible ? 0.45 : pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={mode === "ai" ? "sparkles" : "brush"} size={20} color="#fff" />
                <Text style={styles.generateButtonText}>
                  {mode === "ai" ? t().createTrip.generate : "Bắt đầu thiết kế"}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* ═══════ STARTING POINT BOTTOM SHEET ═══════ */}
      <Modal
        visible={showStartingSuggestions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStartingSuggestions(false)}
        statusBarTranslucent
      >
        <Pressable style={destSheet.overlay} onPress={() => setShowStartingSuggestions(false)}>
          <Pressable
            style={[
              destSheet.sheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[destSheet.handle, { backgroundColor: colors.divider }]} />
            <View style={destSheet.header}>
              <Text style={[destSheet.title, { color: colors.text }]}>Chọn điểm xuất phát</Text>
              <Pressable
                onPress={() => setShowStartingSuggestions(false)}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
            <View
              style={[
                destSheet.searchBar,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={[destSheet.searchInput, { color: colors.text }]}
                placeholder="Tìm thành phố xuất phát..."
                placeholderTextColor={colors.textTertiary}
                value={startingPoint}
                onChangeText={setStartingPoint}
                autoFocus
              />
              {startingPoint.length > 0 && (
                <Pressable onPress={() => setStartingPoint("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {startingSuggestions.length === 0 ? (
                <View style={destSheet.empty}>
                  <Ionicons name="search" size={32} color={colors.textTertiary} />
                  <Text style={[destSheet.emptyText, { color: colors.textSecondary }]}>
                    Không tìm thấy
                  </Text>
                </View>
              ) : (
                startingSuggestions.map((name) => {
                  const isSelected = startingPoint === name;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => {
                        setStartingPoint(name);
                        setShowStartingSuggestions(false);
                        Haptics.selectionAsync();
                      }}
                      style={({ pressed }) => [
                        destSheet.item,
                        {
                          backgroundColor: isSelected
                            ? "#06B6D4" + "10"
                            : pressed
                              ? colors.inputBg
                              : "transparent",
                        },
                      ]}
                    >
                      <View style={[destSheet.thumbWrap, { backgroundColor: "#06B6D4" + "1A" }]}>
                        <Ionicons name="navigate" size={20} color="#06B6D4" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[destSheet.itemName, { color: colors.text }]}>{name}</Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#06B6D4" />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════ DESTINATION BOTTOM SHEET ═══════ */}
      <Modal
        visible={showDestSuggestions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDestSuggestions(false)}
        statusBarTranslucent
      >
        <Pressable
          style={destSheet.overlay}
          onPress={() => {
            setShowDestSuggestions(false);
            setDestSearch("");
          }}
        >
          <Pressable
            style={[
              destSheet.sheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[destSheet.handle, { backgroundColor: colors.divider }]} />
            <View style={destSheet.header}>
              <View>
                <Text style={[destSheet.title, { color: colors.text }]}>Chọn điểm đến</Text>
                {selectedDestinations.length > 0 && (
                  <View style={destSheet.countBadge}>
                    <Text style={[destSheet.countBadgeText, { color: colors.primary }]}>
                      Đã chọn {selectedDestinations.length} điểm
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => {
                  setShowDestSuggestions(false);
                  setDestSearch("");
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>
            <View
              style={[
                destSheet.searchBar,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={[destSheet.searchInput, { color: colors.text }]}
                placeholder="Tìm thành phố, điểm đến..."
                placeholderTextColor={colors.textTertiary}
                value={destSearch}
                onChangeText={setDestSearch}
                autoFocus
              />
              {destSearch.length > 0 && (
                <Pressable onPress={() => setDestSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {destSuggestions.length === 0 ? (
                <View style={destSheet.empty}>
                  <Ionicons name="search" size={32} color={colors.textTertiary} />
                  <Text style={[destSheet.emptyText, { color: colors.textSecondary }]}>
                    Không tìm thấy điểm đến
                  </Text>
                </View>
              ) : (
                destSuggestions.map((name) => {
                  const destObj = destinations.find((d) => d.name === name);
                  const isSelected = selectedDestinations.some((d) => d.name === name);
                  return (
                    <Pressable
                      key={name}
                      onPress={() => {
                        if (isSelected) removeDestination(name);
                        else addDestination(name);
                      }}
                      style={({ pressed }) => [
                        destSheet.item,
                        destSheet.itemMulti,
                        {
                          backgroundColor: isSelected
                            ? colors.primary + "1A"
                            : pressed
                              ? colors.inputBg
                              : "transparent",
                          borderColor: isSelected ? colors.primary + "60" : "transparent",
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      <View style={[destSheet.thumbWrap, { backgroundColor: colors.inputBg }]}>
                        {destObj?.images?.[0] ? (
                          <Image
                            source={{ uri: destObj.images[0] }}
                            style={destSheet.thumb}
                            contentFit="cover"
                          />
                        ) : (
                          <Ionicons name="location" size={20} color={colors.primary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            destSheet.itemName,
                            { color: isSelected ? colors.primary : colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        {destObj && (
                          <Text
                            style={[destSheet.itemSub, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {destObj.address || destObj.category}
                          </Text>
                        )}
                      </View>
                      {/* Selection indicator — rounded "+/✓" pill */}
                      <View
                        style={[
                          destSheet.pickBtn,
                          {
                            backgroundColor: isSelected ? colors.primary : "transparent",
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                      >
                        {isSelected ? (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        ) : (
                          <Ionicons name="add" size={16} color={colors.text} />
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
          <Pressable
            style={[styles.calendarModal, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={goToPrevMonth}
                disabled={isPrevDisabled}
                style={{ opacity: isPrevDisabled ? 0.3 : 1 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              <Pressable onPress={goToNextMonth}>
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={[styles.weekdayLabel, { color: colors.textTertiary }]}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={styles.dayCell} />;
                const isPast = day < today;
                const isStart = rangeStart ? isSameDay(day, rangeStart) : false;
                const isEnd = rangeEnd ? isSameDay(day, rangeEnd) : false;
                const inRange = isInRange(day, rangeStart, rangeEnd);
                const isToday = isSameDay(day, today);
                const isSelected = isStart || isEnd;

                return (
                  <Pressable
                    key={day.toISOString()}
                    onPress={() => !isPast && handleCalendarDayPress(day)}
                    disabled={isPast}
                    style={[
                      styles.dayCell,
                      inRange && { backgroundColor: colors.primary + "20" },
                      isStart && {
                        backgroundColor: colors.primary,
                        borderTopLeftRadius: 20,
                        borderBottomLeftRadius: 20,
                      },
                      isEnd && {
                        backgroundColor: colors.primary,
                        borderTopRightRadius: 20,
                        borderBottomRightRadius: 20,
                      },
                      isStart &&
                        !isEnd &&
                        rangeEnd && { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                      isEnd && !isStart && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: colors.text },
                        isPast && { color: colors.textTertiary, opacity: 0.4 },
                        isSelected && { color: "#fff", fontFamily: "Inter_700Bold" },
                        inRange && { color: colors.primary },
                        isToday &&
                          !isSelected && { color: colors.primary, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {(rangeStart || rangeEnd) && (
              <View style={styles.calendarSelectionInfo}>
                <Text style={[styles.calendarInfoText, { color: colors.textSecondary }]}>
                  {rangeStart &&
                    !rangeEnd &&
                    `${t().createTrip.startDate}: ${formatDateDDMMYYYY(rangeStart)} — ${t().createTrip.selectEndDate}`}
                  {rangeStart &&
                    rangeEnd &&
                    `${formatDateDDMMYYYY(rangeStart)}  →  ${formatDateDDMMYYYY(rangeEnd)} (${Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1} ${t().createTrip.days})`}
                </Text>
              </View>
            )}

            <View style={styles.calendarActions}>
              <Pressable
                onPress={() => setShowCalendar(false)}
                style={[styles.calendarBtn, { borderColor: colors.inputBorder, borderWidth: 1 }]}
              >
                <Text style={[styles.calendarBtnText, { color: colors.textSecondary }]}>
                  {t().common.cancel}
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmDateRange}
                disabled={!rangeStart || !rangeEnd}
                style={[
                  styles.calendarBtn,
                  { backgroundColor: colors.primary, opacity: rangeStart && rangeEnd ? 1 : 0.4 },
                ]}
              >
                <Text style={[styles.calendarBtnText, { color: "#fff" }]}>
                  {t().common.confirm}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        onRequestClose={() => {
          if (!saving) setShowPreview(false);
        }}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 },
            ]}
          >
            <Pressable
              onPress={() => {
                if (!saving) setShowPreview(false);
              }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Xem trước lịch trình</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* AI Badge */}
          <View style={[styles.previewAiBadge, { backgroundColor: colors.primary + "15" }]}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.previewAiBadgeText, { color: colors.primary }]}>
              Lịch trình được tạo bởi AI (Gemini)
            </Text>
          </View>

          {/* Summary Bar */}
          <View
            style={[
              styles.previewSummaryBar,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder || colors.inputBorder,
              },
            ]}
          >
            <View style={styles.previewSummaryItem}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={[styles.previewSummaryText, { color: colors.text }]} numberOfLines={1}>
                {destination}
              </Text>
            </View>
            <View style={styles.previewSummaryItem}>
              <Ionicons name="cash-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewSummaryText, { color: colors.text }]}>
                {formatVND(previewTotalCost)}
              </Text>
            </View>
            <View style={styles.previewSummaryItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewSummaryText, { color: colors.text }]}>
                {previewDays?.length || 0} ngày
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {previewDays?.map((day, dayIdx) => {
              const isExpanded = previewExpandedDay === dayIdx;
              const dayCost = day.activities.reduce((s, a) => s + (a.estimatedCost || 0), 0);
              return (
                <View key={dayIdx} style={{ marginBottom: 12 }}>
                  <Pressable
                    onPress={() => setPreviewExpandedDay(isExpanded ? null : dayIdx)}
                    style={[
                      styles.previewDayHeader,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder || colors.inputBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewDayTitle, { color: colors.text }]}>
                        {day.title}
                      </Text>
                      <Text style={[styles.previewDayCost, { color: colors.textSecondary }]}>
                        {day.activities.length} hoạt động • {formatVND(dayCost)}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </Pressable>

                  {isExpanded &&
                    day.activities.map((act, actIdx) => {
                      const typeIcons: Record<string, string> = {
                        food: "restaurant",
                        sightseeing: "eye",
                        transport: "car",
                        shopping: "bag",
                        other: "ellipse",
                      };
                      const iconName = typeIcons[act.activityType || "other"] || "ellipse";
                      const typeColors: Record<string, string> = {
                        food: "#FF6B6B",
                        sightseeing: "#4ECDC4",
                        transport: "#45B7D1",
                        shopping: "#FFA07A",
                        other: "#999",
                      };
                      const accentColor = typeColors[act.activityType || "other"] || colors.primary;

                      return (
                        <View
                          key={actIdx}
                          style={[
                            styles.previewActivityCard,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.cardBorder || colors.inputBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.previewActTimeBadge,
                              { backgroundColor: accentColor + "20" },
                            ]}
                          >
                            <Ionicons name={iconName as any} size={14} color={accentColor} />
                            <Text style={[styles.previewActTime, { color: accentColor }]}>
                              {act.time}
                            </Text>
                          </View>
                          <Text style={[styles.previewActTitle, { color: colors.text }]}>
                            {act.title}
                          </Text>
                          {act.rating ? (
                            <View style={styles.previewActMetaItem}>
                              <Ionicons name="star" size={12} color="#F5A623" />
                              <Text
                                style={[
                                  styles.previewActMetaText,
                                  { color: "#F5A623", fontFamily: "Inter_600SemiBold" },
                                ]}
                              >
                                {act.rating.toFixed(1)}
                              </Text>
                            </View>
                          ) : null}
                          {act.description ? (
                            <Text
                              style={[styles.previewActDesc, { color: colors.textSecondary }]}
                              numberOfLines={3}
                            >
                              {act.description}
                            </Text>
                          ) : null}
                          <View style={styles.previewActMeta}>
                            {act.duration ? (
                              <View style={styles.previewActMetaItem}>
                                <Ionicons
                                  name="time-outline"
                                  size={12}
                                  color={colors.textTertiary}
                                />
                                <Text
                                  style={[
                                    styles.previewActMetaText,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  {act.duration}
                                </Text>
                              </View>
                            ) : null}
                            {act.estimatedCost > 0 ? (
                              <View style={styles.previewActMetaItem}>
                                <Ionicons
                                  name="cash-outline"
                                  size={12}
                                  color={colors.textTertiary}
                                />
                                <Text
                                  style={[
                                    styles.previewActMetaText,
                                    { color: colors.textTertiary },
                                  ]}
                                >
                                  {formatVND(act.estimatedCost)}
                                </Text>
                              </View>
                            ) : null}
                            {act.address ? (
                              <View style={[styles.previewActMetaItem, { flex: 1 }]}>
                                <Ionicons
                                  name="location-outline"
                                  size={12}
                                  color={colors.textTertiary}
                                />
                                <Text
                                  style={[
                                    styles.previewActMetaText,
                                    { color: colors.textTertiary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {act.address}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View
            style={[
              styles.previewBottomBar,
              { backgroundColor: colors.background, borderTopColor: colors.inputBorder },
            ]}
          >
            <Pressable
              onPress={handleRegenerate}
              disabled={loading || saving}
              style={[
                styles.previewRegenBtn,
                { borderColor: colors.primary, opacity: loading || saving ? 0.5 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                  <Text style={[styles.previewRegenText, { color: colors.primary }]}>Tạo lại</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={handleSavePreview}
              disabled={loading || saving}
              style={[
                styles.previewSaveBtn,
                { backgroundColor: colors.primary, opacity: loading || saving ? 0.7 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.previewSaveText}>Lưu lịch trình</Text>
                </>
              )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 20 },
  section: { gap: 8 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 4 },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  counterValue: { fontSize: 20, fontFamily: "Inter_700Bold", minWidth: 30, textAlign: "center" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  budgetUnit: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  budgetPreview: { fontSize: 13, fontFamily: "Inter_500Medium", marginLeft: 4 },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  generateButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  suggestionList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 280,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggestionText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  dateDisplayText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarModal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  calendarSelectionInfo: {
    marginTop: 12,
    alignItems: "center",
  },
  calendarInfoText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  calendarActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  calendarBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  // Preview Modal styles
  previewAiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  previewAiBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  previewSummaryBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  previewSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  previewSummaryText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
  previewDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewDayTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  previewDayCost: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  previewActivityCard: {
    marginLeft: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  previewActTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewActTime: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  previewActTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  previewActDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  previewActMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  previewActMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  previewActMetaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  previewBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  previewRegenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
  },
  previewRegenText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  previewSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    flex: 2,
  },
  previewSaveText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  // AI Loading Modal Styles
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  loadingCard: {
    width: "100%",
    maxWidth: 280,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
      },
    }),
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 20,
  },
});

const modeClean = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  photoWrap: { position: "relative" },
  photo: { width: "100%", height: 160 },
  recommendBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#0F172A",
  },
  recommendText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  body: { padding: 16, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  body2: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 6,
  },
  ctaText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});

const destSheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    height: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", padding: 0 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    marginBottom: 4,
  },
  itemMulti: {
    borderWidth: 1.5,
    marginBottom: 6,
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  itemName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  itemSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  pickBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#0891B215",
  },
  countBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});

const f = StyleSheet.create({
  // Hero banner
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Field cards
  fieldCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  fieldHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Input row inside card
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", padding: 0 },
  unitText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  // Date display
  dateBox: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  datePlaceholder: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dateRowFilled: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateSubLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6, marginBottom: 3 },
  dateValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  dateArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // 2-column row
  twoCol: { flexDirection: "row", gap: 12 },
  counterRowNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 4,
  },
  counterBtnNew: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValueNew: { fontSize: 22, fontFamily: "Inter_700Bold", minWidth: 36, textAlign: "center" },
  budgetPreview: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: -2 },

  // Preferences chips (V2 — with icon + color per category)
  chipGridNew: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prefChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  prefChipText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  prefCounter: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  prefCounterText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  // Legacy alias (in case still referenced):
  chipNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipTextNew: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  errorText: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: -2 },

  // Multi-destination chips
  destChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  destOrderDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  destOrderText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  destChipName: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold" },
  destDaysRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  destDayBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  destDayValue: { fontSize: 13, fontFamily: "Inter_700Bold", minWidth: 16, textAlign: "center" },
  destDayUnit: { fontSize: 10, fontFamily: "Inter_500Medium" },

  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addMoreBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});

const modeCardStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
    overflow: "hidden",
    position: "relative",
  },
  gradientWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  gradientBg: { flex: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  recommendBadge: {
    backgroundColor: "#FBBF24",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  benefitList: { gap: 8, marginTop: 4 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
  },
  ctaBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
