import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useDestinations, useDestinationTypes } from "@/hooks/queries/use-destinations";
import { useNotifications } from "@/hooks/queries/use-notifications";
import { t } from "@/lib/i18n";
import type { Destination, DestinationType } from "@/types";
import { formatRating } from "@/features/reviews/components/StarRating";

// ──────────────────────────────────────────────────────────────
// Helpers — use MaterialCommunityIcons (consistent style across OS,
// no emoji rendering inconsistencies; standard travel-app pattern).
// ──────────────────────────────────────────────────────────────

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const CATEGORY_ICON: Record<string, IconName> = {
  "Thành phố": "city-variant-outline",
  "Biển đảo": "beach",
  "Núi non": "image-filter-hdr",
  "Nghỉ dưỡng": "palm-tree",
  "Nông thôn": "barn",
  "Di tích": "castle",
  Khác: "map-marker-outline",
};

function categoryIcon(name?: string | null): IconName {
  if (!name) return "map-marker-outline";
  return CATEGORY_ICON[name] || "map-marker-outline";
}

// Small inline icon for category chips/badges; size + color injected.
function CatIcon({ name, size, color }: { name?: string | null; size: number; color: string }) {
  return <MaterialCommunityIcons name={categoryIcon(name)} size={size} color={color} />;
}

// ──────────────────────────────────────────────────────────────
// Featured carousel card — big hero card for top-rated destinations
// ──────────────────────────────────────────────────────────────

function FeaturedCard({
  item,
  colors,
}: {
  item: Destination;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/destination/[id]", params: { id: item.id } });
      }}
      style={({ pressed }) => [
        styles.featuredCard,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Image source={{ uri: item.images[0] }} style={styles.featuredImage} contentFit="cover" />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.featuredGradient}
        pointerEvents="none"
      />
      <View style={styles.featuredOverlay}>
        <View style={styles.featuredCategoryChip}>
          <CatIcon name={item.category} size={13} color="#0F172A" />
          <Text style={styles.featuredCategoryText}>{item.category}</Text>
        </View>
        <Text style={styles.featuredName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.featuredMeta}>
          <Ionicons name="star" size={13} color="#FBBF24" />
          <Text style={styles.featuredMetaText}>
            {item.reviewCount > 0
              ? `${formatRating(item.rating)} · ${item.reviewCount} đánh giá`
              : "Mới ra mắt"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Main destination card — 1-column, modern, with overlay info
// ──────────────────────────────────────────────────────────────

function DestinationCard({
  item,
  colors,
}: {
  item: Destination;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/destination/[id]", params: { id: item.id } });
      }}
    >
      <View style={{ position: "relative" }}>
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
        {/* Top-right: category chip on the image */}
        <View style={styles.cardCategoryChip}>
          <CatIcon name={item.category} size={13} color="#0F172A" />
          <Text style={styles.cardCategoryText}>{item.category}</Text>
        </View>
        {/* Bottom-left: rating chip */}
        {item.reviewCount > 0 ? (
          <View style={styles.cardRatingChip}>
            <Ionicons name="star" size={12} color="#FBBF24" />
            <Text style={styles.cardRatingText}>{formatRating(item.rating)}</Text>
            <Text style={styles.cardRatingCount}>({item.reviewCount})</Text>
          </View>
        ) : (
          <View style={[styles.cardRatingChip, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Ionicons name="sparkles" size={11} color="#FBBF24" />
            <Text style={styles.cardRatingText}>Mới</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.cardLocationRow}>
          <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
          <Text style={[styles.cardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        {item.description ? (
          <Text style={[styles.cardDescription, { color: colors.textTertiary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Skeleton card while loading — instant render, no spinner
// ──────────────────────────────────────────────────────────────

function CardSkeleton({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.cardImage, { backgroundColor: colors.inputBg }]} />
      <View style={styles.cardContent}>
        <View
          style={{ height: 18, width: "60%", borderRadius: 4, backgroundColor: colors.inputBg }}
        />
        <View
          style={{
            height: 12,
            width: "75%",
            borderRadius: 4,
            backgroundColor: colors.inputBg,
            marginTop: 8,
          }}
        />
        <View
          style={{
            height: 12,
            width: "90%",
            borderRadius: 4,
            backgroundColor: colors.inputBg,
            marginTop: 6,
          }}
        />
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Screen
// ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const destinationsQuery = useDestinations(
    selectedCategory ? Number(selectedCategory) : undefined,
  );
  const { data: destinationTypes = [] } = useDestinationTypes();
  const { data: notifications = [] } = useNotifications(user?.id);

  const destinations = destinationsQuery.data ?? [];
  const isLoading = destinationsQuery.isLoading;

  // Search across name, address, tags
  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      if (!d.isActive) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        d.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [destinations, search]);

  // Featured = top-5 by rating, only shown when no search/filter
  const featuredDestinations = useMemo(() => {
    if (search || selectedCategory) return [];
    return [...destinations]
      .filter((d) => d.isActive && d.reviewCount > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }, [destinations, search, selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await destinationsQuery.refetch();
    setRefreshing(false);
  }, [destinationsQuery]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const firstName = user?.fullName?.split(" ").slice(-1)[0] || t().explore.traveler;
  const avatarInitial = (
    user?.fullName?.charAt(0) ||
    user?.username?.charAt(0) ||
    "?"
  ).toUpperCase();

  // ─── Header ───────────────────────────────────────────────
  const renderHeader = () => (
    <View style={[styles.topSection, { paddingTop: insets.top + webTopInset + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
        >
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
              ]}
            >
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]} numberOfLines={1}>
            {t().explore.hello}, {firstName} 👋
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Hôm nay đi đâu nhỉ?
          </Text>
        </View>
        {/* Notification only — Create Trip lives in the bottom-nav FAB (single
            CTA, less header clutter). */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/notifications");
          }}
          style={({ pressed }) => [
            styles.iconCircle,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search bar (elevated) */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            shadowColor: isDark ? "#000" : "#0F172A",
          },
        ]}
      >
        <Ionicons name="search" size={20} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Tìm điểm đến, thành phố, hoạt động..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Category chips with emojis */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[null as DestinationType | null, ...destinationTypes]}
        keyExtractor={(item) => item?.id || "all"}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => {
          const isSelected = item === null ? !selectedCategory : selectedCategory === item.id;
          const label = item === null ? t().common.all : item.typeName;
          const iconColor = isSelected ? "#fff" : colors.text;
          return (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategory(item?.id ?? null);
              }}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              {item === null ? (
                <MaterialCommunityIcons name="compass-outline" size={15} color={iconColor} />
              ) : (
                <CatIcon name={item.typeName} size={15} color={iconColor} />
              )}
              <Text style={[styles.categoryChipText, { color: isSelected ? "#fff" : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );

  // ─── Featured carousel ───────────────────────────────────
  const renderFeatured = () => {
    if (featuredDestinations.length === 0) return null;
    return (
      <View style={{ marginTop: 16 }}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <MaterialCommunityIcons name="star-four-points" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Điểm đến nổi bật</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 4 }}
        >
          {featuredDestinations.map((item) => (
            <FeaturedCard key={item.id} item={item} colors={colors} />
          ))}
        </ScrollView>
      </View>
    );
  };

  // ─── Main list section header ────────────────────────────
  const renderMainListHeader = () => {
    const label = selectedCategory
      ? `${destinationTypes.find((t) => t.id === selectedCategory)?.typeName ?? ""}`
      : search
        ? "Kết quả tìm kiếm"
        : "Tất cả điểm đến";
    return (
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <View style={styles.sectionHeaderLeft}>
          {search ? (
            <MaterialCommunityIcons name="magnify" size={18} color={colors.primary} />
          ) : selectedCategory ? (
            <CatIcon name={label} size={18} color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="earth" size={18} color={colors.primary} />
          )}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
        </View>
        {filteredDestinations.length > 0 && (
          <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
            {filteredDestinations.length} điểm
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={isLoading ? [] : filteredDestinations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DestinationCard item={item} colors={colors} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderFeatured()}
            {renderMainListHeader()}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <CardSkeleton key={i} colors={colors} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <Ionicons name="compass-outline" size={36} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t().explore.noResults}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {t().explore.noResultsHint}
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        style={{ paddingHorizontal: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ─── Top section ─────────────────────────────────────────
  topSection: { paddingHorizontal: 20, gap: 16, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold", marginTop: 2 },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  // ─── Search bar ──────────────────────────────────────────
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },

  // ─── Category chips ──────────────────────────────────────
  categoryList: { gap: 8, paddingVertical: 4, paddingRight: 20 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // ─── Section header ──────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionCount: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // ─── Featured card ───────────────────────────────────────
  featuredCard: {
    width: 260,
    height: 320,
    borderRadius: 20,
    overflow: "hidden",
  },
  featuredImage: { width: "100%", height: "100%" },
  featuredGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  featuredOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    gap: 6,
  },
  featuredCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  featuredCategoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  featuredName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.2 },
  featuredMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  featuredMetaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.92)",
  },

  // ─── Main destination card ───────────────────────────────
  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    marginHorizontal: 20,
  },
  cardImage: { width: "100%", height: 200 },
  cardCategoryChip: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cardCategoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  cardRatingChip: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  cardRatingText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  cardRatingCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.78)",
  },
  cardContent: { padding: 14, gap: 4 },
  cardTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  cardLocationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardLocation: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  cardDescription: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 4 },

  // ─── Empty / skeleton ────────────────────────────────────
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  skeletonList: { gap: 14, paddingTop: 4 },
});
