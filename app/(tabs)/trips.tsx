import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
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
import { useTrips, useUpdateTrip, useDeleteTrip } from "@/hooks/queries/use-trips";
import { useDestinations } from "@/hooks/queries/use-destinations";
import { useReviews, useCreateReview } from "@/hooks/queries/use-reviews";
import { t } from "@/lib/i18n";
import type { Itinerary, Destination } from "@/types";

type ThemeColors = ReturnType<typeof useThemeColors>;
type FilterKey = "all" | "upcoming" | "active" | "completed" | "draft";

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "Tất cả", icon: "albums-outline" },
  { key: "draft", label: "Nháp", icon: "create-outline" },
  { key: "upcoming", label: "Sắp tới", icon: "time-outline" },
  { key: "active", label: "Đang đi", icon: "airplane" },
  { key: "completed", label: "Đã đi", icon: "checkmark-done-circle-outline" },
];

const STATUS_META: Record<
  string,
  { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  draft: { label: "Bản nháp", bg: "#FEF3C7", fg: "#92400E", icon: "create" },
  upcoming: { label: "Sắp tới", bg: "#DBEAFE", fg: "#1E40AF", icon: "time" },
  active: { label: "Đang đi", bg: "#D1FAE5", fg: "#065F46", icon: "airplane" },
  completed: {
    label: "Đã hoàn thành",
    bg: "#E0E7FF",
    fg: "#3730A3",
    icon: "checkmark-done-circle",
  },
};

// Distinguish "upcoming" (active but startDate > today) vs "active" (in-progress)
function getDisplayStatus(item: Itinerary): "draft" | "upcoming" | "active" | "completed" {
  if (item.status === "draft") return "draft";
  if (item.status === "completed") return "completed";
  // active status: check if upcoming or in-progress
  try {
    const parse = (d: string) => {
      // dd-mm-yyyy
      const [dd, mm, yyyy] = d.split("-").map(Number);
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = parse(item.startDate);
    if (start && start > today) return "upcoming";
  } catch {}
  return "active";
}

function findDestination(name: string, all: Destination[]): Destination | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  return (
    all.find((d) => d.name.toLowerCase() === lower) ||
    all.find((d) => d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase()))
  );
}

// ──────────────────────────────────────────────────────────────
// TripCard — premium image-based card
// ──────────────────────────────────────────────────────────────

function TripCard({
  item,
  colors,
  destination,
  onPress,
  onMenu,
  isJoined,
  isReviewed,
}: {
  item: Itinerary;
  colors: ThemeColors;
  destination?: Destination;
  onPress: () => void;
  onMenu: () => void;
  isJoined: boolean;
  isReviewed: boolean;
}) {
  const status = getDisplayStatus(item);
  const meta = STATUS_META[status];
  const cover = destination?.images?.[0];
  const dayCount = item.days?.length || 0;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        cardStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {/* Hero image with gradient overlay */}
      <View style={cardStyles.imageWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={cardStyles.image} contentFit="cover" />
        ) : (
          <View
            style={[
              cardStyles.image,
              { backgroundColor: colors.inputBg, alignItems: "center", justifyContent: "center" },
            ]}
          >
            <MaterialCommunityIcons name="image-outline" size={36} color={colors.textTertiary} />
          </View>
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.25)", "transparent", "rgba(0,0,0,0.7)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Status badge top-left */}
        <View style={[cardStyles.statusBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={11} color={meta.fg} />
          <Text style={[cardStyles.statusText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
        {/* Joined indicator + menu top-right */}
        <View style={cardStyles.topRightRow}>
          {isJoined && (
            <View style={[cardStyles.joinedChip, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
              <Ionicons name="people" size={10} color="#0F172A" />
              <Text style={cardStyles.joinedText}>Đã tham gia</Text>
            </View>
          )}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onMenu();
            }}
            hitSlop={6}
            style={({ pressed }) => [cardStyles.menuBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Title + destination overlay on image */}
        <View style={cardStyles.imageInfo}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={cardStyles.locRow}>
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={cardStyles.locText} numberOfLines={1}>
              {item.destination}
            </Text>
          </View>
        </View>
      </View>

      {/* Card stats row */}
      <View style={cardStyles.statsRow}>
        <View style={cardStyles.stat}>
          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
          <Text style={[cardStyles.statText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.startDate?.slice(0, 5)} → {item.endDate?.slice(0, 5)}
          </Text>
        </View>
        <View style={[cardStyles.statDivider, { backgroundColor: colors.divider }]} />
        <View style={cardStyles.stat}>
          <MaterialCommunityIcons
            name="calendar-clock-outline"
            size={13}
            color={colors.textSecondary}
          />
          <Text style={[cardStyles.statText, { color: colors.textSecondary }]}>
            {dayCount} ngày
          </Text>
        </View>
        <View style={[cardStyles.statDivider, { backgroundColor: colors.divider }]} />
        <View style={cardStyles.stat}>
          <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
          <Text style={[cardStyles.statText, { color: colors.textSecondary }]}>
            {item.numPeople}
          </Text>
        </View>
      </View>

      {/* Budget + review hint */}
      <View style={cardStyles.footer}>
        <View style={cardStyles.budgetRow}>
          <MaterialCommunityIcons name="wallet-outline" size={14} color={colors.primary} />
          <Text style={[cardStyles.budgetText, { color: colors.primary }]} numberOfLines={1}>
            {item.budget}
          </Text>
        </View>
        {status === "completed" && (
          <View
            style={[
              cardStyles.reviewHint,
              {
                backgroundColor: isReviewed ? "#10B98115" : "#F59E0B15",
                borderColor: isReviewed ? "#10B98140" : "#F59E0B40",
              },
            ]}
          >
            <Ionicons
              name={isReviewed ? "checkmark-circle" : "star"}
              size={11}
              color={isReviewed ? "#10B981" : "#F59E0B"}
            />
            <Text
              style={[cardStyles.reviewHintText, { color: isReviewed ? "#10B981" : "#F59E0B" }]}
            >
              {isReviewed ? "Đã đánh giá" : "Cần đánh giá"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Screen
// ──────────────────────────────────────────────────────────────

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const tripsQuery = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const { data: destinations = [] } = useDestinations();
  const { data: reviews = [] } = useReviews();
  const createReview = useCreateReview();

  const [refreshing, setRefreshing] = useState(false);
  const [reviewModal, setReviewModal] = useState<Itinerary | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [menuTarget, setMenuTarget] = useState<Itinerary | null>(null);
  const [search, setSearch] = useState("");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await tripsQuery.refetch();
    setRefreshing(false);
  }, [tripsQuery]);

  const itineraries = tripsQuery.data ?? [];

  // Group stats for hero
  const stats = useMemo(() => {
    const totals = { upcoming: 0, active: 0, completed: 0, draft: 0 };
    for (const it of itineraries) {
      const s = getDisplayStatus(it);
      totals[s] += 1;
    }
    return totals;
  }, [itineraries]);

  // Filtered list
  const filtered = useMemo(() => {
    const sorted = [...itineraries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const byFilter =
      activeFilter === "all"
        ? sorted
        : sorted.filter((it) => getDisplayStatus(it) === activeFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter(
      (it) => it.title.toLowerCase().includes(q) || it.destination.toLowerCase().includes(q),
    );
  }, [itineraries, activeFilter, search]);

  const handleDelete = (id: string) => {
    const trip = itineraries.find((i) => i.id === id);
    const isJoinedTrip = trip && user && String(trip.userId) !== String(user.id);
    if (isJoinedTrip) {
      const doLeave = () => {
        const updated = (trip.companions || []).filter(
          (c) => String(c.userId) !== String(user!.id),
        );
        updateTrip.mutate({ id, data: { companions: updated } });
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
      const doDelete = () => deleteTrip.mutate(id);
      if (Platform.OS === "web") {
        if (window.confirm(t().trips.deleteMessage)) doDelete();
      } else {
        Alert.alert(t().trips.deleteTitle, t().trips.deleteMessage, [
          { text: t().common.cancel, style: "cancel" },
          { text: t().common.delete, style: "destructive", onPress: doDelete },
        ]);
      }
    }
  };

  const handleReviewSubmit = async () => {
    if (!reviewModal || !user) return;
    if (!comment.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập nhận xét của bạn");
      return;
    }
    setIsSubmitting(true);
    try {
      const dest = findDestination(reviewModal.destination, destinations);
      await createReview.mutateAsync({
        userId: user.id,
        userName: user.fullName,
        itineraryId: reviewModal.id,
        destinationId: dest?.id || "",
        rating,
        comment,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReviewModal(null);
      setRating(5);
      setComment("");
    } catch {
      Alert.alert("Lỗi", "Không thể gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const firstName = user?.fullName?.split(" ").slice(-1)[0] || "bạn";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isReviewed = reviews.some(
            (r) => r.userId === user?.id && r.itineraryId === item.id && !r.activityId,
          );
          const destObj = findDestination(item.destination, destinations);
          return (
            <TripCard
              item={item}
              destination={destObj}
              colors={colors}
              onPress={() => router.push({ pathname: "/itinerary/[id]", params: { id: item.id } })}
              onMenu={() => setMenuTarget(item)}
              isJoined={!!user && String(item.userId) !== String(user.id)}
              isReviewed={isReviewed}
            />
          );
        }}
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
          <View>
            {/* Hero */}
            <View style={[styles.hero, { paddingTop: insets.top + webTopInset + 12 }]}>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                Xin chào, {firstName}
              </Text>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Chuyến đi của bạn</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatTile
                icon="time"
                label="Sắp tới"
                value={stats.upcoming}
                color="#3B82F6"
                colors={colors}
                active={activeFilter === "upcoming"}
                onPress={() => setActiveFilter(activeFilter === "upcoming" ? "all" : "upcoming")}
              />
              <StatTile
                icon="airplane"
                label="Đang đi"
                value={stats.active}
                color="#10B981"
                colors={colors}
                active={activeFilter === "active"}
                onPress={() => setActiveFilter(activeFilter === "active" ? "all" : "active")}
              />
              <StatTile
                icon="checkmark-done-circle"
                label="Đã đi"
                value={stats.completed}
                color="#8B5CF6"
                colors={colors}
                active={activeFilter === "completed"}
                onPress={() => setActiveFilter(activeFilter === "completed" ? "all" : "completed")}
              />
            </View>

            {/* Search bar */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Tìm chuyến đi theo tên hoặc điểm đến..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {FILTERS.map((f) => {
                const isActive = activeFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveFilter(f.key);
                    }}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.card,
                        borderColor: isActive ? colors.primary : colors.cardBorder,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={f.icon}
                      size={13}
                      color={isActive ? "#fff" : colors.textSecondary}
                    />
                    <Text style={[styles.filterText, { color: isActive ? "#fff" : colors.text }]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Results count */}
            {filtered.length > 0 && (
              <Text style={[styles.countText, { color: colors.textTertiary }]}>
                {filtered.length} chuyến đi
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15" }]}>
              <MaterialCommunityIcons
                name="bag-suitcase-outline"
                size={44}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeFilter === "all" ? "Chưa có chuyến đi nào" : "Không có chuyến đi"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {activeFilter === "all"
                ? "Hãy bắt đầu hành trình đầu tiên của bạn"
                : "Thử filter khác hoặc tạo chuyến đi mới"}
            </Text>
            <Pressable
              onPress={() => router.push("/create-trip")}
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCtaText}>Tạo chuyến đi mới</Text>
            </Pressable>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      />

      {/* ─── Menu action sheet ─── */}
      <Modal
        visible={!!menuTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuTarget(null)}>
          <Pressable
            style={[
              styles.menuSheet,
              { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.menuHandle, { backgroundColor: colors.divider }]} />
            <Text style={[styles.menuTitle, { color: colors.text }]} numberOfLines={1}>
              {menuTarget?.title}
            </Text>
            <MenuItem
              icon="open-outline"
              label="Mở chi tiết"
              colors={colors}
              onPress={() => {
                const id = menuTarget!.id;
                setMenuTarget(null);
                router.push({ pathname: "/itinerary/[id]", params: { id } });
              }}
            />
            {menuTarget && getDisplayStatus(menuTarget) === "completed" && (
              <MenuItem
                icon="star-outline"
                label={
                  reviews.some(
                    (r) =>
                      r.userId === user?.id && r.itineraryId === menuTarget.id && !r.activityId,
                  )
                    ? "Xem đánh giá"
                    : "Viết đánh giá"
                }
                color="#F59E0B"
                colors={colors}
                onPress={() => {
                  if (!menuTarget) return;
                  const isRev = reviews.some(
                    (r) =>
                      r.userId === user?.id && r.itineraryId === menuTarget.id && !r.activityId,
                  );
                  if (isRev) {
                    const rev = reviews.find(
                      (r) =>
                        r.userId === user?.id && r.itineraryId === menuTarget.id && !r.activityId,
                    );
                    setMenuTarget(null);
                    if (rev?.destinationId) router.push(`/destination/${rev.destinationId}`);
                  } else {
                    setRating(5);
                    setComment("");
                    setReviewModal(menuTarget);
                    setMenuTarget(null);
                  }
                }}
              />
            )}
            <MenuItem
              icon={
                user && menuTarget && String(menuTarget.userId) !== String(user.id)
                  ? "log-out-outline"
                  : "trash-outline"
              }
              label={
                user && menuTarget && String(menuTarget.userId) !== String(user.id)
                  ? "Rời chuyến đi"
                  : "Xóa chuyến đi"
              }
              color="#EF4444"
              colors={colors}
              onPress={() => {
                if (!menuTarget) return;
                const id = menuTarget.id;
                setMenuTarget(null);
                handleDelete(id);
              }}
              isLast
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Review modal (preserved from original) ─── */}
      <Modal
        visible={!!reviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setReviewModal(null)}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: colors.card }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Đánh giá chuyến đi</Text>
                <Pressable onPress={() => setReviewModal(null)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {reviewModal?.title}
                </Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRating(star);
                      }}
                      style={styles.starBtn}
                    >
                      <Ionicons
                        name={star <= rating ? "star" : "star-outline"}
                        size={32}
                        color="#F59E0B"
                      />
                    </Pressable>
                  ))}
                </View>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <TextInput
                    style={[styles.textInput, { color: colors.text, height: 120 }]}
                    placeholder="Chia sẻ trải nghiệm của bạn về chuyến đi này..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                    value={comment}
                    onChangeText={setComment}
                  />
                </View>
                <Pressable
                  onPress={handleReviewSubmit}
                  disabled={isSubmitting}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    { backgroundColor: colors.primary, opacity: pressed || isSubmitting ? 0.8 : 1 },
                  ]}
                >
                  <Text style={styles.submitBtnText}>
                    {isSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                  </Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  color,
  colors,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  colors: ThemeColors;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statTile,
        {
          backgroundColor: colors.card,
          borderColor: active ? color : colors.cardBorder,
          borderWidth: active ? 2 : 1,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </Pressable>
  );
}

function MenuItem({
  icon,
  label,
  color,
  colors,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  colors: ThemeColors;
  onPress: () => void;
  isLast?: boolean;
}) {
  const fg = color || colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.menuItemText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_500Medium" },
  heroTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.4, marginTop: 2 },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  statTile: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 16,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },

  filtersRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  countText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  emptyCtaText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  // Menu action sheet
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  menuSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  menuTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  menuItemText: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },

  // Review modal (preserved)
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 20,
  },
  ratingContainer: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  starBtn: { padding: 4 },
  inputContainer: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 20 },
  textInput: { fontSize: 14, fontFamily: "Inter_400Regular" },
  submitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

const cardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageWrap: { position: "relative" },
  image: { width: "100%", height: 180 },
  statusBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  topRightRow: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  joinedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  joinedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#0F172A" },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageInfo: { position: "absolute", left: 16, right: 16, bottom: 14, gap: 4 },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.2,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.92)",
    flex: 1,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  statText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 4 },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
  },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  budgetText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  reviewHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  reviewHintText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
