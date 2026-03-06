import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useThemeColors } from "@/constants/colors";
import type { Itinerary } from "@/lib/storage";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#FEF3C7", text: "#92400E" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  completed: { bg: "#DBEAFE", text: "#1E40AF" },
};

function TripCard({ item, colors, onDelete }: { item: Itinerary; colors: ReturnType<typeof useThemeColors>; onDelete: () => void }) {
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
          <Text style={[styles.statusText, { color: statusColor.text }]}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {new Date(item.startDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "short" })} - {new Date(item.endDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "short" })}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{dayCount} days</Text>
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
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete();
            }}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { itineraries, deleteItinerary } = useData();

  const myTrips = useMemo(() => {
    if (!user) return [];
    return itineraries
      .filter((i) => i.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [itineraries, user]);

  const handleDelete = (id: string) => {
    Alert.alert("Delete Trip", "Are you sure you want to delete this trip?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteItinerary(id),
      },
    ]);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Trips</Text>
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
        renderItem={({ item }) => <TripCard item={item} colors={colors} onDelete={() => handleDelete(item.id)} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No trips yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Create your first trip to get started</Text>
            <Pressable
              onPress={() => router.push("/create-trip")}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Plan a Trip</Text>
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
