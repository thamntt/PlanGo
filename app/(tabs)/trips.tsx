import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import type { Itinerary } from "@/lib/storage";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#FEF3C7", text: "#92400E" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  completed: { bg: "#DBEAFE", text: "#1E40AF" },
};

function TripCard({ item, colors, onDelete, isJoined }: { item: Itinerary; colors: ReturnType<typeof useThemeColors>; onDelete: () => void; isJoined: boolean }) {
  const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.draft;
  const dayCount = item.days.length;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.95 : 1 },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/itinerary/[id]", params: { id: item.id } });
      }}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.cardLocation, { color: colors.textSecondary }]}>{item.destination}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {item.status === "draft" ? t().trips.statusDraft : item.status === "active" ? t().trips.statusActive : t().trips.statusCompleted}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {item.startDate} - {item.endDate}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{dayCount} {t().trips.days}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.numPeople}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={[styles.budgetText, { color: colors.primary }]}>{item.budget}</Text>
        <View style={styles.cardActions}>
          {item.isShared && <Ionicons name="share-social-outline" size={18} color={colors.primary} />}
          {isJoined && (
            <View style={[styles.joinedBadge, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="people" size={12} color={colors.primary} />
            </View>
          )}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete();
            }}
            hitSlop={8}
          >
            <Ionicons name={isJoined ? "log-out-outline" : "trash-outline"} size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { itineraries, deleteItinerary, updateItinerary } = useData();

  const myTrips = useMemo(() => {
    if (!user) return [];
    return itineraries
      .filter((i) => i.userId === user.id || (i.companions || []).some((c) => c.userId === user.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [itineraries, user]);

  const handleDelete = (id: string) => {
    const trip = itineraries.find((i) => i.id === id);
    const isJoined = trip && user && trip.userId !== user.id;
    if (isJoined) {
      const doLeave = () => {
        const updated = (trip.companions || []).filter((c) => c.userId !== user.id);
        updateItinerary(id, { companions: updated });
      };
      if (Platform.OS === "web") {
        if (window.confirm(t().itinerary.leaveTripMsg)) doLeave();
      } else {
        Alert.alert(t().itinerary.leaveTrip, t().itinerary.leaveTripMsg, [
          { text: t().common.cancel, style: "cancel" },
          { text: t().itinerary.leaveTrip, style: "destructive", onPress: doLeave },
        ]);
      }
    } else {
      if (Platform.OS === "web") {
        if (window.confirm(t().trips.deleteMessage)) deleteItinerary(id);
      } else {
        Alert.alert(t().trips.deleteTitle, t().trips.deleteMessage, [
          { text: t().common.cancel, style: "cancel" },
          { text: t().common.delete, style: "destructive", onPress: () => deleteItinerary(id) },
        ]);
      }
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t().trips.title}</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/create-trip");
          }}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={myTrips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TripCard item={item} colors={colors} onDelete={() => handleDelete(item.id)} isJoined={!!user && item.userId !== user.id} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t().trips.emptyTitle}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>{t().trips.emptySubtitle}</Text>
            <Pressable
              onPress={() => router.push("/create-trip")}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>{t().trips.planTrip}</Text>
            </Pressable>
          </View>
        }
      />
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
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  cardLocationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardLocation: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
  cardDetails: { flexDirection: "row", gap: 16 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  joinedBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  createButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
