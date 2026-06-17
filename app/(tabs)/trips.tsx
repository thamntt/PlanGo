import React, { useMemo, useState, useCallback, useRef } from "react";
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
  Animated,
  ActivityIndicator,
  Share,
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
import { useTabBar } from "@/contexts/TabBarContext";
import { useScrollToTop } from "@react-navigation/native";
import { SearchOverlay } from "@/features/community/SearchOverlay";
import { StickyFilterBar } from "@/features/community/StickyFilterBar";
import { useTrips, useUpdateTrip, useDeleteTrip } from "@/hooks/queries/use-trips";
import {
  useReceivedInvitations,
  useAcceptInvitation,
  useDeclineInvitation,
} from "@/hooks/queries/use-invitations";
import { SkeletonCard } from "@/components/Skeleton";
import { useDestinations } from "@/hooks/queries/use-destinations";
import { useReviews, useCreateReview } from "@/hooks/queries/use-reviews";
import { t } from "@/lib/i18n";
import { useConfirm } from "@/contexts/ConfirmContext";
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

// Format date for the card chip — accepts both "YYYY-MM-DD" (DB) and
// "DD-MM-YYYY" (legacy form input). Returns "DD/MM".
function formatDayMonth(d?: string): string {
  if (!d) return "—";
  // ISO yyyy-mm-dd
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}`;
  // dd-mm-yyyy
  const dmy = d.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (dmy) return `${dmy[1]}/${dmy[2]}`;
  return d.slice(0, 10);
}

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
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onMenu();
      }}
      delayLongPress={400}
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
        {/* Joined indicator top-right */}
        {isJoined && (
          <View style={cardStyles.topRightRow}>
            <View style={[cardStyles.joinedChip, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
              <Ionicons name="people" size={10} color="#0F172A" />
              <Text style={cardStyles.joinedText}>Đã tham gia</Text>
            </View>
          </View>
        )}

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
            {formatDayMonth(item.startDate)} → {formatDayMonth(item.endDate)}
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
  const tabBar = useTabBar();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef as any);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const tripsQuery = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const receivedInvitesQuery = useReceivedInvitations();
  const receivedInvitations = receivedInvitesQuery.data ?? [];
  const acceptInvitationMut = useAcceptInvitation();
  const declineInvitationMut = useDeclineInvitation();
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
  const [searchOpen, setSearchOpen] = useState(false);

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

  const handleDelete = async (id: string) => {
    const trip = itineraries.find((i) => i.id === id);
    const isJoinedTrip = trip && user && String(trip.userId) !== String(user.id);
    if (isJoinedTrip) {
      const ok = await confirm({
        title: t().itinerary.leaveTrip,
        message: t().itinerary.leaveTripMsg,
        destructive: true,
        confirmText: t().itinerary.leaveTrip,
        icon: "exit-outline",
      });
      if (!ok) return;
      const updated = (trip!.companions || []).filter(
        (c) => String(c.userId) !== String(user!.id),
      );
      updateTrip.mutate({ id, data: { companions: updated } });
    } else {
      const ok = await confirm({
        title: t().trips.deleteTitle,
        message: t().trips.deleteMessage,
        destructive: true,
        confirmText: t().common.delete,
      });
      if (ok) deleteTrip.mutate(id);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.FlatList
        ref={listRef}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: (e: any) => tabBar.onScroll(e),
        })}
        scrollEventThrottle={16}
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
              <Text style={[styles.heroTitle, { color: colors.text }]}>Chuyến đi của bạn</Text>
            </View>

            {/* Lời mời nhận được — only renders when there's at least one
                pending invitation. Each row has Accept/Decline so the user
                can act without leaving the Trips screen. */}
            {receivedInvitations.length > 0 && (
              <View style={inviteSectionStyles.wrap}>
                <View style={inviteSectionStyles.header}>
                  <Ionicons name="mail-unread" size={16} color={colors.primary} />
                  <Text
                    style={[
                      inviteSectionStyles.headerText,
                      { color: colors.primary },
                    ]}
                  >
                    LỜI MỜI NHẬN ĐƯỢC ({receivedInvitations.length})
                  </Text>
                </View>
                {receivedInvitations.map((inv) => {
                  const busy =
                    acceptInvitationMut.isPending ||
                    declineInvitationMut.isPending;
                  return (
                    <View
                      key={inv.id}
                      style={[
                        inviteSectionStyles.card,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={inviteSectionStyles.topRow}>
                        {inv.inviterAvatarUrl ? (
                          <Image
                            source={{ uri: inv.inviterAvatarUrl }}
                            style={inviteSectionStyles.avatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              inviteSectionStyles.avatar,
                              { backgroundColor: colors.primary },
                            ]}
                          >
                            <Text style={inviteSectionStyles.avatarText}>
                              {(inv.inviterName ||
                                inv.inviterUserName ||
                                "?")
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              inviteSectionStyles.title,
                              { color: colors.text },
                            ]}
                            numberOfLines={2}
                          >
                            <Text style={{ fontFamily: "Inter_700Bold" }}>
                              {inv.inviterName ||
                                inv.inviterUserName ||
                                "Ai đó"}
                            </Text>
                            {" mời bạn tham gia "}
                            <Text style={{ fontFamily: "Inter_700Bold" }}>
                              "{inv.tripTitle || "chuyến đi"}"
                            </Text>
                          </Text>
                          <Text
                            style={[
                              inviteSectionStyles.meta,
                              { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {inv.role === "editor"
                              ? "Vai trò: Chỉnh sửa"
                              : "Vai trò: Chỉ xem"}
                            {inv.tripStartDate && inv.tripEndDate
                              ? ` · ${inv.tripStartDate} → ${inv.tripEndDate}`
                              : ""}
                          </Text>
                        </View>
                      </View>
                      <View style={inviteSectionStyles.actions}>
                        <Pressable
                          onPress={() => declineInvitationMut.mutate(inv.id)}
                          disabled={busy}
                          style={({ pressed }) => [
                            inviteSectionStyles.btn,
                            {
                              backgroundColor: colors.inputBg,
                              opacity: pressed || busy ? 0.6 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              inviteSectionStyles.btnText,
                              { color: colors.text },
                            ]}
                          >
                            Từ chối
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            Haptics.notificationAsync(
                              Haptics.NotificationFeedbackType.Success,
                            );
                            acceptInvitationMut.mutate(inv.id);
                          }}
                          disabled={busy}
                          style={({ pressed }) => [
                            inviteSectionStyles.btn,
                            {
                              backgroundColor: colors.primary,
                              opacity: pressed || busy ? 0.6 : 1,
                              flex: 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#fff"
                          />
                          <Text
                            style={[
                              inviteSectionStyles.btnText,
                              { color: "#fff" },
                            ]}
                          >
                            Đồng ý tham gia
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Search bar (tap → overlay) */}
            <Pressable
              onPress={() => setSearchOpen(true)}
              style={({ pressed }) => [
                styles.searchBar,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <Text
                style={[
                  styles.searchInput,
                  {
                    color: search ? colors.text : colors.textTertiary,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                numberOfLines={1}
              >
                {search || "Tìm chuyến đi theo tên hoặc điểm đến..."}
              </Text>
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </Pressable>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
            >
              {FILTERS.map((f) => {
                const isActive = activeFilter === f.key;
                const count =
                  f.key === "all"
                    ? itineraries.length
                    : (stats as Record<string, number>)[f.key] || 0;
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
                      {f.label} ({count})
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
          tripsQuery.isLoading || tripsQuery.isPending ? (
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              <SkeletonCard height={132} />
              <SkeletonCard height={132} />
              <SkeletonCard height={132} />
            </View>
          ) : (
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
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      />

      {/* Sticky filter bar appears when scrolled past hero */}
      <StickyFilterBar scrollY={scrollY} showAt={260}>
        <View
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}
        >
          <Pressable
            onPress={() => setSearchOpen(true)}
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
            <Ionicons name="search" size={18} color={colors.text} />
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingRight: 16 }}
            style={{ flex: 1 }}
          >
            {(["all", "upcoming", "active", "completed"] as const).map((f) => {
              const labels: Record<string, string> = {
                all: "Tất cả",
                upcoming: "Sắp tới",
                active: "Đang đi",
                completed: "Đã đi",
              };
              const isActive = activeFilter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setActiveFilter(f)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 14,
                    borderWidth: 1,
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.cardBorder,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_700Bold",
                      color: isActive ? "#fff" : colors.text,
                    }}
                  >
                    {labels[f]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </StickyFilterBar>

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

      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSubmit={(q) => setSearch(q)}
        placeholder="Tìm chuyến đi theo tên hoặc điểm đến..."
        context="trip"
      />

      <Modal
        visible={!!menuTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuTarget(null)}
      >
        {menuTarget && (() => {
          const target = menuTarget;
          const isOwnerTrip = String(target.userId) === String(user?.id);
          // Editor members can mark status too — find the viewer's companion
          // record to read their role. Owner is always editor for this check.
          const viewerCompanion = (target.companions || []).find(
            (c: any) => String(c.userId) === String(user?.id),
          );
          const viewerRole = (viewerCompanion as any)?.role as
            | "owner"
            | "editor"
            | "viewer"
            | undefined;
          const canEditStatus = isOwnerTrip || viewerRole === "editor";
          const status = target.status as "draft" | "active" | "completed";
          const nextLabel =
            status === "draft"
              ? "Bắt đầu chuyến đi"
              : status === "active"
                ? "Đánh dấu đã hoàn thành"
                : "Khởi tạo lại";
          const nextIcon: keyof typeof Ionicons.glyphMap =
            status === "draft"
              ? "play-circle"
              : status === "active"
                ? "checkmark-circle"
                : "refresh-circle";
          const nextColor =
            status === "draft"
              ? colors.primary
              : status === "active"
                ? colors.success
                : "#6366F1";
          const nextStatus =
            status === "draft" ? "active" : status === "active" ? "completed" : "draft";
          return (
            <Pressable
              style={tripMenuStyles.overlay}
              onPress={() => setMenuTarget(null)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={[tripMenuStyles.sheet, { backgroundColor: colors.card }]}
              >
                <View style={tripMenuStyles.handle} />
                <View style={tripMenuStyles.header}>
                  <Text
                    style={[tripMenuStyles.title, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {target.title}
                  </Text>
                  <Text style={[tripMenuStyles.sub, { color: colors.textTertiary }]}>
                    {target.destination} · {target.startDate} → {target.endDate}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setMenuTarget(null);
                    // Open trip detail directly on the invite (share) modal
                    // — replaces the old native Share sheet which only sent a
                    // text message, not the actual invite flow.
                    router.push({
                      pathname: "/itinerary/[id]",
                      params: { id: target.id, action: "invite" },
                    });
                  }}
                  style={({ pressed }) => [
                    tripMenuStyles.item,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="person-add-outline" size={20} color={colors.text} />
                  <Text style={[tripMenuStyles.itemText, { color: colors.text }]}>
                    Mời bạn đồng hành
                  </Text>
                </Pressable>
                {canEditStatus && (
                  <Pressable
                    onPress={() => {
                      setMenuTarget(null);
                      router.push({
                        pathname: "/itinerary/[id]",
                        params: { id: target.id, autoStatus: nextStatus },
                      });
                    }}
                    style={({ pressed }) => [
                      tripMenuStyles.item,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name={nextIcon} size={20} color={nextColor} />
                    <Text style={[tripMenuStyles.itemText, { color: colors.text }]}>
                      {nextLabel}
                    </Text>
                  </Pressable>
                )}
                <View
                  style={[tripMenuStyles.divider, { backgroundColor: colors.cardBorder }]}
                />
                {isOwnerTrip ? (
                  <Pressable
                    onPress={() => {
                      const id = target.id;
                      setMenuTarget(null);
                      handleDelete(id);
                    }}
                    style={({ pressed }) => [
                      tripMenuStyles.item,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={[tripMenuStyles.itemText, { color: colors.error }]}>
                      Xoá chuyến đi
                    </Text>
                  </Pressable>
                ) : (
                  // Non-owner members get "Rời chuyến đi" — handleDelete
                  // already routes joined trips through the leave flow so we
                  // reuse it; the label/icon make the intent clear.
                  <Pressable
                    onPress={() => {
                      const id = target.id;
                      setMenuTarget(null);
                      handleDelete(id);
                    }}
                    style={({ pressed }) => [
                      tripMenuStyles.item,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Ionicons name="exit-outline" size={20} color={colors.error} />
                    <Text style={[tripMenuStyles.itemText, { color: colors.error }]}>
                      Rời chuyến đi
                    </Text>
                  </Pressable>
                )}
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
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
  heroTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },

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

const inviteSectionStyles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  title: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 19 },
  meta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  actions: { flexDirection: "row", gap: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});

const tripMenuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 8,
  },
  header: { paddingHorizontal: 4, paddingBottom: 8, gap: 2 },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  sub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  itemText: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
});
