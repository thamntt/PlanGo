import React, { useState } from "react";
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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { PREFERENCE_OPTIONS } from "@/lib/seed-data";
import { validateRequired, validateDate, validateDateRange, validateNumPeople } from "@/lib/validation";
import { formatVND } from "@/lib/storage";
import { t } from "@/lib/i18n";

interface FormErrors {
  destination?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: string;
  budget?: string;
  numPeople?: string;
  startingPoint?: string;
}

function formatBudgetInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function CreateTripScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { generateItinerary, itineraries, deleteItinerary } = useData();
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
    if (destErr) newErrors.destination = destErr;
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

  const handleGenerate = async () => {
    if (!validate()) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isEditing && editingItinerary) {
        await deleteItinerary(editingItinerary.id);
      }
      const itin = await generateItinerary({
        destination: destination.trim(),
        startDate,
        endDate,
        budget: formatVND(budgetNumber),
        totalBudget: budgetNumber,
        startingPoint: startingPoint.trim(),
        numPeople: parseInt(numPeople) || 2,
        preferences: selectedPrefs,
        userId: user!.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/itinerary/[id]", params: { id: itin.id } });
    } catch (e) {
      Alert.alert(t().common.error, t().createTrip.generateFailed);
    }
    setLoading(false);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()}>
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
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.startingPoint}</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Ionicons name="navigate-outline" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t().createTrip.startingPointPlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={startingPoint}
              onChangeText={(v) => { setStartingPoint(v); clearError("startingPoint"); }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.destination}</Text>
          <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: errors.destination ? colors.error : colors.inputBorder }]}>
            <Ionicons name="location-outline" size={20} color={errors.destination ? colors.error : colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t().createTrip.destPlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={destination}
              onChangeText={(v) => { setDestination(v); clearError("destination"); }}
            />
          </View>
          {errors.destination && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.destination}</Text>}
        </View>

        <View style={styles.rowSection}>
          <View style={[styles.halfSection, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.startDate}</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: errors.startDate ? colors.error : colors.inputBorder }]}>
              <Ionicons name="calendar-outline" size={18} color={errors.startDate ? colors.error : colors.textTertiary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t().createTrip.datePlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={startDate}
                onChangeText={(v) => { setStartDate(v); clearError("startDate"); clearError("dateRange"); }}
              />
            </View>
            {errors.startDate && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.startDate}</Text>}
          </View>
          <View style={[styles.halfSection, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>{t().createTrip.endDate}</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: errors.endDate ? colors.error : colors.inputBorder }]}>
              <Ionicons name="calendar-outline" size={18} color={errors.endDate ? colors.error : colors.textTertiary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t().createTrip.datePlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={endDate}
                onChangeText={(v) => { setEndDate(v); clearError("endDate"); clearError("dateRange"); }}
              />
            </View>
            {errors.endDate && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.endDate}</Text>}
          </View>
        </View>
        {errors.dateRange && <Text style={[styles.fieldError, { color: colors.error, marginTop: -12 }]}>{errors.dateRange}</Text>}

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
            {PREFERENCE_OPTIONS.map((pref) => {
              const isSelected = selectedPrefs.includes(pref);
              return (
                <Pressable
                  key={pref}
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
  rowSection: { flexDirection: "row", gap: 12 },
  halfSection: { gap: 8 },
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
});
