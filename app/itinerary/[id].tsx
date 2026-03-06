import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";

function getStatusLabel(status: string): string {
  const labels = t().trips;
  if (status === "draft") return labels.statusDraft;
  if (status === "active") return labels.statusActive;
  if (status === "completed") return labels.statusCompleted;
  return status;
}

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { itineraries, updateItinerary, deleteItinerary } = useData();

  const itinerary = itineraries.find((i) => i.id === id);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);

  if (!itinerary) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_500Medium" }}>{t().itinerary.notFound}</Text>
      </View>
    );
  }

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const daysSummary = itinerary.days.map((d) => `Day ${d.day}: ${d.title}\n${d.activities.map((a) => `  ${a.time} - ${a.title}`).join("\n")}`).join("\n\n");
    const message = `${itinerary.title}\n${itinerary.destination}\n${itinerary.startDate} - ${itinerary.endDate}\n${t().itinerary.budget}: ${itinerary.budget}\n\n${daysSummary}`;
    try {
      await Share.share({ message, title: itinerary.title });
      await updateItinerary(itinerary.id, { isShared: true });
    } catch (e) {
      console.log(e);
    }
  };

  const handleStatusChange = () => {
    const nextStatus = itinerary.status === "draft" ? "active" : itinerary.status === "active" ? "completed" : "draft";
    Alert.alert(t().itinerary.changeStatus, t().itinerary.confirmStatus(nextStatus), [
      { text: t().common.cancel, style: "cancel" },
      {
        text: t().common.confirm,
        onPress: () => {
          updateItinerary(itinerary.id, { status: nextStatus });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(t().itinerary.deleteTrip, t().itinerary.deleteConfirm, [
      { text: t().common.cancel, style: "cancel" },
      {
        text: t().common.delete,
        style: "destructive",
        onPress: () => {
          deleteItinerary(itinerary.id);
          router.back();
        },
      },
    ]);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

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
          <Pressable onPress={handleShare} hitSlop={8}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t().itinerary.destination}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{itinerary.destination}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="cash-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t().itinerary.budget}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{itinerary.budget}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t().itinerary.dates}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {itinerary.startDate} - {itinerary.endDate}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t().itinerary.travelers}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{itinerary.numPeople}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Pressable
            onPress={handleStatusChange}
            style={({ pressed }) => [
              styles.statusButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons
              name={itinerary.status === "draft" ? "play" : itinerary.status === "active" ? "checkmark-circle" : "refresh"}
              size={18}
              color="#fff"
            />
            <Text style={styles.statusButtonText}>
              {itinerary.status === "draft" ? t().itinerary.startTrip : itinerary.status === "active" ? t().itinerary.complete : t().itinerary.reset}
            </Text>
          </Pressable>
        </View>

        {itinerary.preferences.length > 0 && (
          <View style={styles.prefRow}>
            {itinerary.preferences.map((p) => (
              <View key={p} style={[styles.prefChip, { backgroundColor: colors.tagBg }]}>
                <Text style={[styles.prefChipText, { color: colors.tagText }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t().itinerary.itinerary}</Text>

        {itinerary.days.map((day) => (
          <Pressable
            key={day.day}
            onPress={() => {
              Haptics.selectionAsync();
              setExpandedDay(expandedDay === day.day - 1 ? null : day.day - 1);
            }}
          >
            <View style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.dayHeader}>
                <View style={[styles.dayBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.dayBadgeText}>{day.day}</Text>
                </View>
                <Text style={[styles.dayTitle, { color: colors.text }]}>{day.title}</Text>
                <Ionicons
                  name={expandedDay === day.day - 1 ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textTertiary}
                />
              </View>

              {expandedDay === day.day - 1 && (
                <View style={styles.activitiesList}>
                  {day.activities.map((activity, idx) => (
                    <View key={activity.id} style={styles.activityRow}>
                      <View style={styles.timelineCol}>
                        <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                        {idx < day.activities.length - 1 && (
                          <View style={[styles.timelineLine, { backgroundColor: colors.divider }]} />
                        )}
                      </View>
                      <View style={[styles.activityContent, { backgroundColor: colors.inputBg }]}>
                        <Text style={[styles.activityTime, { color: colors.primary }]}>{activity.time}</Text>
                        <Text style={[styles.activityTitle, { color: colors.text }]}>{activity.title}</Text>
                        <Text style={[styles.activityDesc, { color: colors.textSecondary }]}>{activity.description}</Text>
                        <Text style={[styles.activityDuration, { color: colors.textTertiary }]}>{activity.duration}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
  statusRow: { flexDirection: "row" },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  prefRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  prefChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  prefChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  dayCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dayBadgeText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  dayTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  activitiesList: { gap: 0, marginTop: 4 },
  activityRow: { flexDirection: "row", gap: 12, minHeight: 80 },
  timelineCol: { alignItems: "center", width: 20 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  activityContent: { flex: 1, borderRadius: 12, padding: 12, gap: 4, marginBottom: 8 },
  activityTime: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activityDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  activityDuration: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
