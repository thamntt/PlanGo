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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { validateRequired, validateDate, validateDateRange, validateNumPeople } from "@/lib/validation";
import { parseDDMMYYYY } from "@/lib/validation";
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

const VIETNAM_CITIES = [
  "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
  "Huế", "Nha Trang", "Đà Lạt", "Vũng Tàu", "Quy Nhơn",
  "Buôn Ma Thuột", "Vinh", "Thanh Hóa", "Thái Nguyên", "Nam Định",
  "Hạ Long", "Biên Hòa", "Mỹ Tho", "Long Xuyên", "Rạch Giá",
  "Phan Thiết", "Cam Ranh", "Pleiku", "Kon Tum", "Lào Cai",
];

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

  const [destination, setDestination] = useState(editingItinerary?.destination || params.dest || "");
  const [startingPoint, setStartingPoint] = useState(editingItinerary?.startingPoint || "");
  const [startDate, setStartDate] = useState(editingItinerary?.startDate || "");
  const [endDate, setEndDate] = useState(editingItinerary?.endDate || "");
  const [budgetText, setBudgetText] = useState(
    editingItinerary?.totalBudget ? formatBudgetInput(editingItinerary.totalBudget.toString()) : ""
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

  const [showStartingSuggestions, setShowStartingSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
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
    if (!startingPoint.trim()) return allLocationNames.slice(0, 8);
    const q = startingPoint.toLowerCase().trim();
    return allLocationNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [startingPoint, allLocationNames]);

  const sortedDestinationNames = useMemo(() => {
    return [...destinationNames].sort((a, b) => a.localeCompare(b, "vi"));
  }, [destinationNames]);

  const destSuggestions = useMemo(() => {
    if (!destination.trim()) return sortedDestinationNames.slice(0, 20);
    const q = destination.toLowerCase().trim();
    return sortedDestinationNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 20);
  }, [destination, sortedDestinationNames]);

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const budgetNumber = parseInt(budgetText.replace(/\./g, ""), 10) || 0;

  const handleBudgetChange = (text: string) => {
    const formatted = formatBudgetInput(text);
    setBudgetText(formatted);
    clearError("budget");
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const destErr = validateRequired(destination, t().createTrip.destination);
    if (destErr) {
      newErrors.destination = destErr;
    } else if (!destinationNames.some((n) => n.toLowerCase() === destination.trim().toLowerCase())) {
      newErrors.destination = "Vui lòng chọn điểm đến có trong hệ thống";
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
      const data = await generateItineraryMut.mutateAsync({
        destination: destination.trim(),
        startDate,
        endDate,
        budget: formatVND(budgetNumber),
        totalBudget: budgetNumber,
        startingPoint: startingPoint.trim(),
        numPeople: parseInt(numPeople) || 2,
        preferences: selectedPrefs,
      });
      if (data?.days && Array.isArray(data.days)) {
        return data.days as ItineraryDay[];
      }
      return null;
    } catch (e) {
      console.log("AI generation error:", e);
      return null;
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
    return previewDays.reduce((sum, day) =>
      sum + day.activities.reduce((s, a) => s + (a.estimatedCost || 0), 0), 0);
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

  const handleCalendarDayPress = useCallback((day: Date) => {
    Haptics.selectionAsync();
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
    } else {
      if (day < rangeStart) {
        setRangeStart(day);
        setRangeEnd(null);
      } else {
        const diffDays = Math.ceil((day.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 30) {
          Alert.alert(t().common.error, t().validation.maxTripDuration);
          return;
        }
        setRangeEnd(day);
      }
    }
  }, [rangeStart, rangeEnd]);

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
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];

  const isPrevDisabled = calendarYear === today.getFullYear() && calendarMonth <= today.getMonth();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Simplified AI Loading Modal */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              AI đang phân tích và tạo chuyến đi của bạn, vui lòng chờ...
            </Text>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{isEditing ? t().itinerary.editTrip : t().createTrip.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >


        <View style={[styles.section, { zIndex: 10 }]}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.destination}</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: errors.destination ? colors.error : colors.inputBorder }]}>
            <Ionicons name="location-outline" size={20} color={errors.destination ? colors.error : colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t().createTrip.destPlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={destination}
              onChangeText={(v) => { setDestination(v); clearError("destination"); setShowDestSuggestions(true); }}
              onFocus={() => setShowDestSuggestions(true)}
              onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
            />
            {destination.length > 0 && (
              <Pressable onPress={() => { setDestination(""); setShowDestSuggestions(true); }}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {showDestSuggestions && destSuggestions.length > 0 && (
            <View style={[styles.suggestionList, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
              <ScrollView
                style={{ maxHeight: 280 }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {destSuggestions.map((name) => (
                  <Pressable
                    key={name}
                    style={({ pressed }) => [styles.suggestionItem, { backgroundColor: pressed ? colors.inputBg : "transparent" }]}
                    onPress={() => {
                      setDestination(name);
                      setShowDestSuggestions(false);
                      clearError("destination");
                      Haptics.selectionAsync();
                    }}
                  >
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={[styles.suggestionText, { color: colors.text }]}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {errors.destination && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.destination}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.startDate} - {t().createTrip.endDate}</Text>
          <Pressable
            onPress={openCalendar}
            style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: (errors.startDate || errors.endDate || errors.dateRange) ? colors.error : colors.inputBorder }]}
          >
            <Ionicons name="calendar-outline" size={20} color={(errors.startDate || errors.endDate) ? colors.error : colors.textTertiary} />
            <Text style={[styles.dateDisplayText, { color: (startDate && endDate) ? colors.text : colors.textTertiary }]}>
              {(startDate && endDate) ? `${startDate}  →  ${endDate}` : t().createTrip.selectDateRange}
            </Text>
          </Pressable>
          {(errors.startDate || errors.endDate || errors.dateRange) && (
            <Text style={[styles.fieldError, { color: colors.error }]}>{errors.startDate || errors.endDate || errors.dateRange}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.numTravelers}</Text>
          <View style={styles.counterRow}>
            <Pressable
              onPress={() => {
                const n = Math.max(1, (parseInt(numPeople) || 2) - 1);
                setNumPeople(n.toString());
                clearError("numPeople");
                Haptics.selectionAsync();
              }}
              style={[styles.counterBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.counterValue, { color: colors.text }]}>{numPeople}</Text>
            <Pressable
              onPress={() => {
                const n = Math.min(50, (parseInt(numPeople) || 2) + 1);
                setNumPeople(n.toString());
                clearError("numPeople");
                Haptics.selectionAsync();
              }}
              style={[styles.counterBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>
          {errors.numPeople && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.numPeople}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.budget}</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: errors.budget ? colors.error : colors.inputBorder }]}>
            <Ionicons name="cash-outline" size={20} color={errors.budget ? colors.error : colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t().createTrip.budgetPlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={budgetText}
              onChangeText={handleBudgetChange}
              keyboardType="numeric"
            />
            <Text style={[styles.budgetUnit, { color: colors.textSecondary }]}>{t().createTrip.budgetUnit}</Text>
          </View>
          {budgetNumber > 0 && (
            <Text style={[styles.budgetPreview, { color: colors.primary }]}>{formatVND(budgetNumber)}</Text>
          )}
          {errors.budget && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.budget}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.preferences}</Text>
          <View style={styles.chipGrid}>
            {preferences.map((prefObj) => {
              const pref = prefObj.preferenceName;
              const isSelected = selectedPrefs.includes(pref);
              return (
                <Pressable
                  key={prefObj.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    togglePref(pref);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.inputBg,
                      borderColor: isSelected ? colors.primary : colors.inputBorder,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? "#fff" : colors.textSecondary }]}>
                    {pref}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={handleGenerate}
          disabled={loading}
          style={({ pressed }) => [
            styles.generateButton,
            { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.generateButtonText}>{t().createTrip.generate}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
          <Pressable style={[styles.calendarModal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={goToPrevMonth} disabled={isPrevDisabled} style={{ opacity: isPrevDisabled ? 0.3 : 1 }}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.calendarTitle, { color: colors.text }]}>{monthNames[calendarMonth]} {calendarYear}</Text>
              <Pressable onPress={goToNextMonth}>
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={[styles.weekdayLabel, { color: colors.textTertiary }]}>{label}</Text>
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
                      isStart && { backgroundColor: colors.primary, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
                      isEnd && { backgroundColor: colors.primary, borderTopRightRadius: 20, borderBottomRightRadius: 20 },
                      (isStart && !isEnd && rangeEnd) && { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                      (isEnd && !isStart) && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: colors.text },
                      isPast && { color: colors.textTertiary, opacity: 0.4 },
                      isSelected && { color: "#fff", fontFamily: "Inter_700Bold" },
                      inRange && { color: colors.primary },
                      isToday && !isSelected && { color: colors.primary, fontFamily: "Inter_700Bold" },
                    ]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {(rangeStart || rangeEnd) && (
              <View style={styles.calendarSelectionInfo}>
                <Text style={[styles.calendarInfoText, { color: colors.textSecondary }]}>
                  {rangeStart && !rangeEnd && `${t().createTrip.startDate}: ${formatDateDDMMYYYY(rangeStart)} — ${t().createTrip.selectEndDate}`}
                  {rangeStart && rangeEnd && `${formatDateDDMMYYYY(rangeStart)}  →  ${formatDateDDMMYYYY(rangeEnd)} (${Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1} ${t().createTrip.days})`}
                </Text>
              </View>
            )}

            <View style={styles.calendarActions}>
              <Pressable
                onPress={() => setShowCalendar(false)}
                style={[styles.calendarBtn, { borderColor: colors.inputBorder, borderWidth: 1 }]}
              >
                <Text style={[styles.calendarBtnText, { color: colors.textSecondary }]}>{t().common.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={confirmDateRange}
                disabled={!rangeStart || !rangeEnd}
                style={[styles.calendarBtn, { backgroundColor: colors.primary, opacity: (rangeStart && rangeEnd) ? 1 : 0.4 }]}
              >
                <Text style={[styles.calendarBtnText, { color: "#fff" }]}>{t().common.confirm}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI Preview Modal */}
      <Modal visible={showPreview} animationType="slide" onRequestClose={() => { if (!saving) setShowPreview(false); }}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]}>
            <Pressable onPress={() => { if (!saving) setShowPreview(false); }}>
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
          <View style={[styles.previewSummaryBar, { backgroundColor: colors.card, borderColor: colors.cardBorder || colors.inputBorder }]}>
            <View style={styles.previewSummaryItem}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={[styles.previewSummaryText, { color: colors.text }]} numberOfLines={1}>{destination}</Text>
            </View>
            <View style={styles.previewSummaryItem}>
              <Ionicons name="cash-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewSummaryText, { color: colors.text }]}>
                {formatVND(previewTotalCost)}
              </Text>
            </View>
            <View style={styles.previewSummaryItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewSummaryText, { color: colors.text }]}>{previewDays?.length || 0} ngày</Text>
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
                    style={[styles.previewDayHeader, { backgroundColor: colors.card, borderColor: colors.cardBorder || colors.inputBorder }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewDayTitle, { color: colors.text }]}>{day.title}</Text>
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

                  {isExpanded && day.activities.map((act, actIdx) => {
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
                        style={[styles.previewActivityCard, { backgroundColor: colors.card, borderColor: colors.cardBorder || colors.inputBorder }]}
                      >
                        <View style={[styles.previewActTimeBadge, { backgroundColor: accentColor + "20" }]}>
                          <Ionicons name={iconName as any} size={14} color={accentColor} />
                          <Text style={[styles.previewActTime, { color: accentColor }]}>{act.time}</Text>
                        </View>
                        <Text style={[styles.previewActTitle, { color: colors.text }]}>{act.title}</Text>
                        {act.rating ? (
                          <View style={styles.previewActMetaItem}>
                            <Ionicons name="star" size={12} color="#F5A623" />
                            <Text style={[styles.previewActMetaText, { color: "#F5A623", fontFamily: "Inter_600SemiBold" }]}>{act.rating.toFixed(1)}</Text>
                          </View>
                        ) : null}
                        {act.description ? (
                          <Text style={[styles.previewActDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                            {act.description}
                          </Text>
                        ) : null}
                        <View style={styles.previewActMeta}>
                          {act.duration ? (
                            <View style={styles.previewActMetaItem}>
                              <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.previewActMetaText, { color: colors.textTertiary }]}>{act.duration}</Text>
                            </View>
                          ) : null}
                          {act.estimatedCost > 0 ? (
                            <View style={styles.previewActMetaItem}>
                              <Ionicons name="cash-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.previewActMetaText, { color: colors.textTertiary }]}>{formatVND(act.estimatedCost)}</Text>
                            </View>
                          ) : null}
                          {act.address ? (
                            <View style={[styles.previewActMetaItem, { flex: 1 }]}>
                              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                              <Text style={[styles.previewActMetaText, { color: colors.textTertiary }]} numberOfLines={1}>{act.address}</Text>
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
          <View style={[styles.previewBottomBar, { backgroundColor: colors.background, borderTopColor: colors.inputBorder }]}>
            <Pressable
              onPress={handleRegenerate}
              disabled={loading || saving}
              style={[styles.previewRegenBtn, { borderColor: colors.primary, opacity: (loading || saving) ? 0.5 : 1 }]}
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
              style={[styles.previewSaveBtn, { backgroundColor: colors.primary, opacity: (loading || saving) ? 0.7 : 1 }]}
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
