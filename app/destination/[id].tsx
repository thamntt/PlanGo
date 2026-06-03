import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
  Linking,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useDestination } from "@/hooks/queries/use-destinations";
import { useTrips } from "@/hooks/queries/use-trips";
import {
  useReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from "@/hooks/queries/use-reviews";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import {
  StarRating,
  formatRating,
  formatReviewSummary,
  formatTripContext,
} from "@/features/reviews/components/StarRating";
import { useBlogPosts } from "@/hooks/queries/use-blog";
import { useForumThreads } from "@/hooks/queries/use-forum";
import { useFavorites } from "@/hooks/useFavorites";
import { useVoteReview } from "@/hooks/queries/use-review-engagement";
import {
  ReviewerBadge,
  ReviewPhotos,
  HelpfulButton,
  ReportModal,
  ReplyThread,
} from "@/features/destination/components/ReviewEngagement";

type ThemeColors = ReturnType<typeof useThemeColors>;

// ──────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const destinationQuery = useDestination(id);
  const tripsQuery = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const reviewsQuery = useReviews({ destinationId: id ? Number(id) : undefined });
  const { isFavorite, toggleFavorite } = useFavorites();
  const createReview = useCreateReview();
  const updateReviewMut = useUpdateReview();
  const deleteReviewMut = useDeleteReview();
  const reviews = reviewsQuery.data ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const destination = destinationQuery.data;
  const [imageIndex, setImageIndex] = useState(0);
  const [showAllUserReviews, setShowAllUserReviews] = useState(false);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());
  const [reviewSort, setReviewSort] = useState<"relevant" | "newest" | "highest" | "lowest">(
    "relevant",
  );
  const [starFilters, setStarFilters] = useState<Set<number>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    contentType: "review" | "reply";
    contentRefId: string;
  } | null>(null);
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);
  const [tripTypeFilter, setTripTypeFilter] = useState<"any" | "solo" | "couple" | "family">("any");
  const [openReplyThreads, setOpenReplyThreads] = useState<Set<string>>(new Set());
  // Optimistic vote counts per (userId|tripId) key
  const [helpfulCounts, setHelpfulCounts] = useState<
    Record<string, { count: number; voted: boolean }>
  >({});
  const voteReviewMut = useVoteReview();

  const toggleHelpful = useCallback(
    async (reviewUserIdStr: string, reviewTripIdStr: string) => {
      const key = `${reviewUserIdStr}|${reviewTripIdStr}`;
      const current = helpfulCounts[key] || { count: 0, voted: false };
      const optimistic = current.voted
        ? { count: Math.max(0, current.count - 1), voted: false }
        : { count: current.count + 1, voted: true };
      setHelpfulCounts((prev) => ({ ...prev, [key]: optimistic }));
      try {
        if (current.voted) {
          // No-op: simple toggle UX without separate remove endpoint call
        } else {
          await voteReviewMut.mutateAsync({
            reviewUserId: Number(reviewUserIdStr),
            reviewTripId: Number(reviewTripIdStr),
            voteType: "helpful",
          });
        }
      } catch {
        setHelpfulCounts((prev) => ({ ...prev, [key]: current }));
      }
    },
    [helpfulCounts, voteReviewMut],
  );

  const toggleReplyThread = useCallback((key: string) => {
    setOpenReplyThreads((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─── Review form/edit ──
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  // Note: Google Maps reviews intentionally NOT fetched at destination (city)
  // level — Google returns irrelevant data for cities/provinces. Reserved for
  // POI detail screen (Phase 2) where each POI has a specific Place ID.

  // ─── User reviews aggregation ──
  const destUserReviews = useMemo(() => {
    if (!id) return [];
    return reviews
      .filter((r) => r.destinationId === id && !r.activityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews, id]);

  const myExistingReview = useMemo(() => {
    if (!user) return null;
    return destUserReviews.find((r) => r.userId === user.id) || null;
  }, [destUserReviews, user]);

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    destUserReviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) dist[5 - r.rating]++;
    });
    return dist;
  }, [destUserReviews]);

  const averageUserRating = useMemo(() => {
    if (destUserReviews.length === 0) return 0;
    const sum = destUserReviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / destUserReviews.length) * 10) / 10;
  }, [destUserReviews]);

  const reviewsByUser = useMemo(() => {
    const groups = new Map<string, typeof destUserReviews>();
    for (const r of destUserReviews) {
      if (!groups.has(r.userId)) groups.set(r.userId, []);
      groups.get(r.userId)!.push(r);
    }
    return Array.from(groups.entries())
      .map(([userId, list]) => ({
        userId,
        userName: list[0].userName,
        userAvatarUrl: list[0].userAvatarUrl,
        reviews: list,
        latestAt: new Date(list[0].createdAt).getTime(),
      }))
      .sort((a, b) => b.latestAt - a.latestAt);
  }, [destUserReviews]);

  const uniqueReviewers = reviewsByUser.length;

  const sortedReviewsByUser = useMemo(() => {
    const matchesTripType = (numPeople?: number) => {
      if (tripTypeFilter === "any") return true;
      if (!numPeople) return false;
      if (tripTypeFilter === "solo") return numPeople === 1;
      if (tripTypeFilter === "couple") return numPeople === 2;
      if (tripTypeFilter === "family") return numPeople >= 3;
      return true;
    };

    const filteredGroups = reviewsByUser
      .map((g) => ({
        ...g,
        reviews: g.reviews.filter((r) => {
          if (withPhotosOnly && (!r.photos || r.photos.length === 0)) return false;
          if (!matchesTripType(r.tripNumPeople)) return false;
          if (starFilters.size > 0 && !starFilters.has(Math.round(r.rating))) return false;
          return true;
        }),
      }))
      .filter((g) => g.reviews.length > 0);

    if (reviewSort === "highest") {
      return filteredGroups.sort(
        (a, b) =>
          Math.max(...b.reviews.map((r) => r.rating)) - Math.max(...a.reviews.map((r) => r.rating)),
      );
    }
    if (reviewSort === "lowest") {
      return filteredGroups.sort(
        (a, b) =>
          Math.min(...a.reviews.map((r) => r.rating)) - Math.min(...b.reviews.map((r) => r.rating)),
      );
    }
    if (reviewSort === "relevant") {
      // Relevance score = avg rating × 2 + reviewer level boost + recency boost
      const now = Date.now();
      const score = (g: (typeof filteredGroups)[0]) => {
        const avgRating = g.reviews.reduce((s, r) => s + r.rating, 0) / g.reviews.length;
        const lvl = g.reviews[0].userReviewerLevel;
        const lvlBoost = lvl === "legend" ? 1 : lvl === "top" ? 0.6 : lvl === "active" ? 0.3 : 0;
        const daysSince = (now - g.latestAt) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 1 - daysSince / 365);
        return avgRating * 2 + lvlBoost + recencyBoost;
      };
      return filteredGroups.sort((a, b) => score(b) - score(a));
    }
    return filteredGroups; // newest = default
  }, [reviewsByUser, reviewSort, withPhotosOnly, tripTypeFilter, starFilters]);

  // Mock AI summary derived from current reviews. Real impl: BE endpoint
  // /api/destinations/:id/review-summary using OpenAI with caching by review count.
  const aiSummary = useMemo(() => {
    if (destUserReviews.length < 3) return null;
    const total = destUserReviews.length;
    const positives = destUserReviews.filter((r) => r.rating >= 4).length;
    const neutrals = destUserReviews.filter((r) => r.rating === 3).length;
    const negatives = destUserReviews.filter((r) => r.rating <= 2).length;
    const positivePct = Math.round((positives / total) * 100);
    const neutralPct = Math.round((neutrals / total) * 100);
    const negativePct = Math.max(0, 100 - positivePct - neutralPct);

    let overall: "tích cực" | "trung lập" | "trái chiều";
    if (positivePct >= 70) overall = "tích cực";
    else if (negativePct >= 30) overall = "trái chiều";
    else overall = "trung lập";

    return {
      overall,
      positivePct,
      neutralPct,
      negativePct,
      highlightQuote:
        "Cảnh đẹp tuyệt vời, ẩm thực phong phú và người dân thân thiện. Một chuyến đi đáng nhớ!",
      highlights: [
        "Cảnh quan thiên nhiên hùng vĩ, phù hợp nghỉ dưỡng và check-in",
        "Ẩm thực địa phương đậm đà, nhiều món đặc sản hấp dẫn",
        "Người dân nhiệt tình, hiếu khách, sẵn sàng hỗ trợ du khách",
      ],
      concerns: ["Có thể quá đông vào dịp lễ, cuối tuần", "Giá dịch vụ tăng vào mùa cao điểm"],
      themes: [
        { label: "Cảnh đẹp", color: "#10B981", icon: "leaf" as const },
        { label: "Ẩm thực", color: "#F97316", icon: "restaurant" as const },
        { label: "Người dân", color: "#3B82F6", icon: "people" as const },
        { label: "Giá cả", color: "#8B5CF6", icon: "wallet" as const },
        { label: "An toàn", color: "#06B6D4", icon: "shield-checkmark" as const },
      ],
      basedOnCount: total,
    };
  }, [destUserReviews]);

  // Booking-style qualitative label based on average rating
  const ratingQuality = useMemo(() => {
    if (averageUserRating >= 4.5) return { label: "Tuyệt vời", color: "#10B981" };
    if (averageUserRating >= 4.0) return { label: "Rất tốt", color: "#22C55E" };
    if (averageUserRating >= 3.5) return { label: "Tốt", color: "#84CC16" };
    if (averageUserRating >= 3.0) return { label: "Khá", color: "#F59E0B" };
    if (averageUserRating >= 2.0) return { label: "Trung bình", color: "#F97316" };
    return { label: "Cần cải thiện", color: "#EF4444" };
  }, [averageUserRating]);

  const STAR_BAR_COLORS = ["#10B981", "#84CC16", "#F59E0B", "#F97316", "#EF4444"];

  // ─── Real community content from BE ──
  const destNumId = id ? Number(id) : undefined;
  const blogQuery = useBlogPosts(
    destNumId ? { destinationId: destNumId, limit: 8, sort: "popular" } : {},
  );
  const forumQuery = useForumThreads(
    destNumId ? { destinationId: destNumId, limit: 5, sort: "latest" } : {},
  );
  const blogPosts = useMemo(
    () => (destNumId ? blogQuery.data || [] : []),
    [destNumId, blogQuery.data],
  );
  const qaThreads = useMemo(
    () => (destNumId ? forumQuery.data || [] : []),
    [destNumId, forumQuery.data],
  );

  // ─── Handlers ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([destinationQuery.refetch(), reviewsQuery.refetch()]);
    setRefreshing(false);
  }, [destinationQuery, reviewsQuery]);

  const toggleExpandUser = useCallback((uid: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const handleSubmitReview = useCallback(async () => {
    if (!user || userRating === 0) {
      if (Platform.OS === "web") alert("Vui lòng chọn số sao");
      else Alert.alert("Lỗi", "Vui lòng chọn số sao");
      return;
    }
    if (!userComment.trim()) {
      if (Platform.OS === "web") alert(t().destination.pleaseComment);
      else Alert.alert("Lỗi", t().destination.pleaseComment);
      return;
    }
    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        const existing = reviews.find((r) => r.id === editingReviewId);
        await updateReviewMut.mutateAsync({
          id: editingReviewId,
          data: {
            userId: user.id,
            rating: userRating,
            comment: userComment.trim(),
            itineraryId: existing?.itineraryId,
            type: "trip",
          },
        });
      } else {
        await createReview.mutateAsync({
          userId: user.id,
          userName: user.fullName || user.username,
          destinationId: id!,
          rating: userRating,
          comment: userComment.trim(),
        });
      }
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUserRating(0);
      setUserComment("");
      setEditingReviewId(null);
    } catch {
      if (Platform.OS === "web") alert("Không thể gửi đánh giá");
      else Alert.alert("Lỗi", "Không thể gửi đánh giá");
    } finally {
      setSubmittingReview(false);
    }
  }, [user, userRating, userComment, editingReviewId, id, createReview, updateReviewMut, reviews]);

  const handleEditReview = useCallback((review: (typeof destUserReviews)[0]) => {
    setEditingReviewId(review.id);
    setUserRating(review.rating);
    setUserComment(review.comment);
  }, []);

  const handleDeleteReview = useCallback(
    async (reviewId: string) => {
      if (!user) return;
      const doDelete = async () => {
        try {
          await deleteReviewMut.mutateAsync({ id: reviewId, userId: user.id, type: "trip" });
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (editingReviewId === reviewId) {
            setEditingReviewId(null);
            setUserRating(0);
            setUserComment("");
          }
        } catch {}
      };
      if (Platform.OS === "web") {
        if (confirm(t().itinerary.deleteReviewConfirm)) await doDelete();
      } else {
        Alert.alert(t().itinerary.deleteReview, t().itinerary.deleteReviewConfirm, [
          { text: t().common.cancel, style: "cancel" },
          { text: t().common.delete, style: "destructive", onPress: doDelete },
        ]);
      }
    },
    [deleteReviewMut, editingReviewId, user],
  );

  const cancelEdit = useCallback(() => {
    setEditingReviewId(null);
    setUserRating(0);
    setUserComment("");
  }, []);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // ─── Loading / error / not-found ──
  // Skeleton: any time data not yet available + a fetch is happening.
  if (
    destinationQuery.isPending ||
    destinationQuery.isLoading ||
    (destinationQuery.isFetching && !destination)
  ) {
    return <DestinationSkeleton colors={colors} insets={insets} webTopInset={webTopInset} />;
  }
  // Error: fetch failed (network/BE error). Show retry button — much better
  // than the dead-end "not found" the user used to see on flaky networks.
  if (destinationQuery.isError) {
    return (
      <View style={[styles.notFoundWrap, { backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={[
            styles.floatBackBtn,
            { top: insets.top + webTopInset + 8, backgroundColor: colors.inputBg },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textTertiary} />
        <Text
          style={[
            styles.notFoundText,
            { color: colors.text, fontFamily: "Inter_700Bold", marginTop: 12 },
          ]}
        >
          Không tải được điểm đến
        </Text>
        <Text
          style={[
            styles.notFoundText,
            {
              color: colors.textTertiary,
              fontSize: 13,
              marginTop: 4,
              textAlign: "center",
              paddingHorizontal: 32,
            },
          ]}
        >
          Kiểm tra kết nối mạng hoặc thử lại
        </Text>
        <Pressable
          onPress={() => destinationQuery.refetch()}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.primary,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 14,
              marginTop: 20,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }
  if (!destination) {
    return (
      <View style={[styles.notFoundWrap, { backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={[
            styles.floatBackBtn,
            { top: insets.top + webTopInset + 8, backgroundColor: colors.inputBg },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Ionicons name="map-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
          {t().destination.notFound}
        </Text>
      </View>
    );
  }

  const fav = isFavorite(destination.id);
  const isShortAddress = (a: string) => a.split(",").slice(-2, -1)[0]?.trim() || a;

  const openGoogleMaps = () => {
    const q = [destination.name, destination.address].filter(Boolean).join(", ");
    if (destination.googlePlaceId && q) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&destination_place_id=${destination.googlePlaceId}`,
      );
    } else if (q) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,
      );
    } else {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`,
      );
    }
  };

  const openGrab = () => {
    const url =
      Platform.OS === "ios"
        ? `grab://open?screenType=BOOKING&dropOffLatitude=${destination.latitude}&dropOffLongitude=${destination.longitude}`
        : `https://grab.onelink.me/2695613898?af_dp=grab%3A%2F%2Fopen%3FscreenType%3DBOOKING%26dropOffLatitude%3D${destination.latitude}%26dropOffLongitude%3D${destination.longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`,
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ══════════ HERO ══════════ */}
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: destination.images[imageIndex] }}
            style={styles.heroImage}
            contentFit="cover"
          />
          {/* Dark gradient for legibility of overlay text */}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent", "transparent", "rgba(0,0,0,0.85)"]}
            locations={[0, 0.3, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Floating buttons */}
          <View style={[styles.heroTopRow, { top: insets.top + webTopInset + 8 }]}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
              style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const message = `Khám phá ${destination.name} trên PlanGo!\n${destination.address}`;
                  try {
                    if (Platform.OS === "web") {
                      const nav = (typeof navigator !== "undefined" ? navigator : null) as any;
                      if (nav?.share) {
                        await nav.share({ title: destination.name, text: message });
                      } else if (nav?.clipboard?.writeText) {
                        await nav.clipboard.writeText(message);
                        alert("Đã copy thông tin điểm đến");
                      }
                    } else {
                      await Share.share({ title: destination.name, message });
                    }
                  } catch {
                    /* user cancelled — no-op */
                  }
                }}
                style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => toggleFavorite(destination.id)}
                style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons
                  name={fav ? "heart" : "heart-outline"}
                  size={22}
                  color={fav ? "#EF4444" : "#fff"}
                />
              </Pressable>
            </View>
          </View>

          {/* Hero overlay info */}
          <View style={styles.heroInfoOverlay}>
            <View style={styles.heroChipRow}>
              <View style={styles.heroCategoryChip}>
                <MaterialCommunityIcons name="map-marker" size={11} color="#0F172A" />
                <Text style={styles.heroCategoryText}>
                  {t().categories[destination.category] || destination.category}
                </Text>
              </View>
              {destination.reviewCount > 0 && (
                <View style={styles.heroRatingChip}>
                  <Ionicons name="star" size={11} color="#FBBF24" />
                  <Text style={styles.heroRatingText}>{formatRating(destination.rating)}</Text>
                  <Text style={styles.heroRatingCount}>({destination.reviewCount})</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {destination.name}
            </Text>
            <View style={styles.heroLocRow}>
              <Ionicons name="location" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroLocText} numberOfLines={1}>
                {destination.address}
              </Text>
            </View>
          </View>

          {/* Image dots */}
          {destination.images.length > 1 && (
            <View style={styles.imageDots}>
              {destination.images.map((_, i) => (
                <Pressable key={i} onPress={() => setImageIndex(i)} hitSlop={4}>
                  <View style={[styles.dot, i === imageIndex && styles.dotActive]} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ══════════ QUICK ACTIONS ══════════ */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={openGoogleMaps}
            style={({ pressed }) => [
              styles.quickAction,
              { backgroundColor: "#4285F4", opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="map" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Mở Maps</Text>
          </Pressable>
          <Pressable
            onPress={openGrab}
            style={({ pressed }) => [
              styles.quickAction,
              { backgroundColor: "#00B14F", opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="car" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Đặt Grab</Text>
          </Pressable>
        </View>

        {/* ══════════ ABOUT ══════════ */}
        <SectionWrap>
          <SectionTitle
            icon="text-box-outline"
            iconColor={colors.primary}
            title="Mô tả"
            colors={colors}
          />
          <View
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Text style={[styles.descText, { color: colors.textSecondary }]}>
              {destination.description}
            </Text>
          </View>
        </SectionWrap>

        {/* ══════════ BEST TIME + HIGHLIGHTS + TIPS ══════════ */}
        {destination.bestTimeToVisit ? (
          <SectionWrap>
            <View
              style={[
                styles.infoCard,
                { backgroundColor: colors.primary + "0F", borderColor: colors.primary + "30" },
              ]}
            >
              <View style={[styles.infoCardIcon, { backgroundColor: colors.primary + "1A" }]}>
                <Ionicons name="sunny" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>
                  Thời điểm đẹp nhất
                </Text>
                <Text style={[styles.infoCardValue, { color: colors.text }]}>
                  {destination.bestTimeToVisit}
                </Text>
              </View>
            </View>
          </SectionWrap>
        ) : null}

        {destination.highlights && destination.highlights.length > 0 ? (
          <SectionWrap>
            <SectionTitle
              icon="star-four-points"
              iconColor={colors.accent}
              title="Điểm nổi bật"
              colors={colors}
            />
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, gap: 10 },
              ]}
            >
              {destination.highlights.map((h, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={[styles.listBullet, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.listText, { color: colors.text }]}>{h}</Text>
                </View>
              ))}
            </View>
          </SectionWrap>
        ) : null}

        {destination.tips && destination.tips.length > 0 ? (
          <SectionWrap>
            <SectionTitle
              icon="lightbulb-on-outline"
              iconColor="#F59E0B"
              title="Mẹo hay"
              colors={colors}
            />
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, gap: 10 },
              ]}
            >
              {destination.tips.map((tip, i) => (
                <View key={i} style={styles.listRow}>
                  <Ionicons name="bulb" size={14} color="#F59E0B" style={{ marginTop: 3 }} />
                  <Text style={[styles.listText, { color: colors.text }]}>{tip}</Text>
                </View>
              ))}
            </View>
          </SectionWrap>
        ) : null}

        {/* ══════════ BLOG POSTS — real data from BE ══════════ */}
        {blogPosts.length > 0 && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View
                  style={[styles.sectionHeaderIcon, { backgroundColor: colors.primary + "1A" }]}
                >
                  <MaterialCommunityIcons
                    name="book-open-page-variant"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitleText, { color: colors.text }]}>
                    Bài viết cộng đồng
                  </Text>
                  <Text style={[styles.sectionTitleSub, { color: colors.textTertiary }]}>
                    {blogPosts.length} bài chia sẻ về {destination.name}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => router.push("/(tabs)/community")} hitSlop={6}>
                <Text style={[styles.sectionRightLink, { color: colors.primary }]}>
                  Xem tất cả →
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}
            >
              {blogPosts.map((post) => (
                <Pressable
                  key={post.postId}
                  onPress={() =>
                    router.push({
                      pathname: "/community/blog/[id]",
                      params: { id: String(post.postId) },
                    })
                  }
                  style={({ pressed }) => [
                    {
                      width: 260,
                      borderRadius: 16,
                      borderWidth: 1,
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      overflow: "hidden",
                      opacity: pressed ? 0.95 : 1,
                    },
                  ]}
                >
                  {post.coverImage && (
                    <Image
                      source={{ uri: post.coverImage }}
                      style={{ width: "100%", height: 140 }}
                      contentFit="cover"
                    />
                  )}
                  <View style={{ padding: 12, gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter_700Bold",
                        lineHeight: 18,
                        color: colors.text,
                      }}
                      numberOfLines={2}
                    >
                      {post.title}
                    </Text>
                    {post.excerpt && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_400Regular",
                          lineHeight: 16,
                          color: colors.textSecondary,
                        }}
                        numberOfLines={2}
                      >
                        {post.excerpt}
                      </Text>
                    )}
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: "Inter_600SemiBold",
                          color: colors.text,
                        }}
                        numberOfLines={1}
                      >
                        {post.authorName}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <Ionicons name="heart" size={11} color="#EF4444" />
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: "Inter_500Medium",
                          color: colors.textTertiary,
                        }}
                      >
                        {post.likeCount}
                      </Text>
                      <Ionicons name="chatbubble-ellipses" size={11} color={colors.textTertiary} />
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: "Inter_500Medium",
                          color: colors.textTertiary,
                        }}
                      >
                        {post.commentCount}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ══════════ FORUM Q&A — real data from BE ══════════ */}
        {qaThreads.length > 0 && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionHeaderIcon, { backgroundColor: "#8B5CF6" + "1A" }]}>
                  <MaterialCommunityIcons name="forum" size={18} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitleText, { color: colors.text }]}>
                    Hỏi đáp cộng đồng
                  </Text>
                  <Text style={[styles.sectionTitleSub, { color: colors.textTertiary }]}>
                    {qaThreads.length} câu hỏi về {destination.name}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => router.push("/(tabs)/community")} hitSlop={6}>
                <Text style={[styles.sectionRightLink, { color: colors.primary }]}>
                  Xem tất cả →
                </Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {qaThreads.map((q) => {
                const isSolved = q.status === "solved";
                return (
                  <Pressable
                    key={q.threadId}
                    onPress={() =>
                      router.push({
                        pathname: "/community/forum/[id]",
                        params: { id: String(q.threadId) },
                      })
                    }
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        gap: 12,
                        padding: 14,
                        borderRadius: 14,
                        borderWidth: 1,
                        backgroundColor: colors.card,
                        borderColor: isSolved ? "#10B98140" : colors.cardBorder,
                        opacity: pressed ? 0.95 : 1,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.primary + "1A",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="comment-question"
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: "Inter_700Bold",
                          lineHeight: 19,
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {q.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_400Regular",
                          lineHeight: 16,
                          color: colors.textSecondary,
                        }}
                        numberOfLines={1}
                      >
                        {q.body}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_500Medium",
                            color: colors.textTertiary,
                            maxWidth: 100,
                          }}
                          numberOfLines={1}
                        >
                          {q.authorName}
                        </Text>
                        <View
                          style={{
                            width: 2,
                            height: 2,
                            borderRadius: 1,
                            backgroundColor: "#94A3B8",
                          }}
                        />
                        <MaterialCommunityIcons
                          name="message-outline"
                          size={12}
                          color={colors.textTertiary}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_500Medium",
                            color: colors.textTertiary,
                          }}
                        >
                          {q.replyCount} trả lời
                        </Text>
                        {isSolved && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 8,
                              backgroundColor: colors.success + "20",
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={10} color={colors.success} />
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: "Inter_700Bold",
                                color: colors.success,
                              }}
                            >
                              Đã giải đáp
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Google reviews — moved to POI detail screen (Phase 2). City/province
            level returns irrelevant Maps data so it lives where it's useful. */}

        {/* ══════════ PLANGO USER REVIEWS ══════════ */}
        <View>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: colors.success + "1A" }]}>
                <MaterialCommunityIcons name="account-group" size={18} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitleText, { color: colors.text }]}>
                  Đánh giá từ cộng đồng
                </Text>
                <Text style={[styles.sectionTitleSub, { color: colors.textTertiary }]}>
                  {formatReviewSummary(destUserReviews.length, uniqueReviewers)}
                </Text>
              </View>
            </View>
          </View>

          {destUserReviews.length > 0 ? (
            <View style={{ paddingHorizontal: 20 }}>
              {/* ── Premium rating summary card (Booking-style) ── */}
              <View
                style={[
                  styles.ratingSummaryV2,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <View style={styles.ratingSummaryTop}>
                  <View style={styles.ratingSummaryScore}>
                    <View
                      style={[styles.ratingScoreBadge, { backgroundColor: ratingQuality.color }]}
                    >
                      <Text style={styles.ratingScoreNumber}>
                        {formatRating(averageUserRating)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ratingQualityLabel, { color: colors.text }]}>
                        {ratingQuality.label}
                      </Text>
                      <View
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}
                      >
                        <StarRating rating={averageUserRating} size={13} colors={colors} />
                        <Text style={[styles.ratingMetaText, { color: colors.textSecondary }]}>
                          · {formatReviewSummary(destUserReviews.length, uniqueReviewers)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />

                <Text style={[styles.summaryDistTitle, { color: colors.textSecondary }]}>
                  Phân bố đánh giá
                </Text>
                <View style={{ gap: 6 }}>
                  {[5, 4, 3, 2, 1].map((star, idx) => {
                    const count = ratingDistribution[idx];
                    const pct =
                      destUserReviews.length > 0 ? (count / destUserReviews.length) * 100 : 0;
                    return (
                      <View key={star} style={styles.summaryBarRowV2}>
                        <View style={styles.summaryBarLabelGroup}>
                          <Text style={[styles.summaryBarLabelV2, { color: colors.text }]}>
                            {star}
                          </Text>
                          <Ionicons name="star" size={11} color="#FBBF24" />
                        </View>
                        <View
                          style={[styles.summaryBarTrackV2, { backgroundColor: colors.inputBg }]}
                        >
                          <View
                            style={[
                              styles.summaryBarFillV2,
                              {
                                width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                                backgroundColor: STAR_BAR_COLORS[idx],
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.summaryBarCountV2, { color: colors.textSecondary }]}>
                          {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* ── AI Review Summary ── */}
              {aiSummary && (
                <View
                  style={[
                    styles.aiSummaryCard,
                    { backgroundColor: colors.primary + "0E", borderColor: colors.primary + "30" },
                  ]}
                >
                  <View style={styles.aiSummaryHeader}>
                    <LinearGradient
                      colors={[colors.primary, "#8B5CF6"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.aiSummaryIconWrap}
                    >
                      <MaterialCommunityIcons name="creation" size={16} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.aiSummaryTitle, { color: colors.text }]}>
                        AI tóm tắt đánh giá
                      </Text>
                      <Text style={[styles.aiSummaryMeta, { color: colors.textTertiary }]}>
                        Dựa trên {aiSummary.basedOnCount} đánh giá · Tổng quan {aiSummary.overall}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.aiSummaryBody}>
                    <View>
                      <Text style={[styles.aiSummarySection, { color: "#10B981" }]}>
                        ✓ Điểm nổi bật
                      </Text>
                      {aiSummary.highlights.map((h, i) => (
                        <Text key={i} style={[styles.aiSummaryItem, { color: colors.text }]}>
                          • {h}
                        </Text>
                      ))}
                    </View>
                    {aiSummary.concerns.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[styles.aiSummarySection, { color: "#F59E0B" }]}>
                          ! Cần lưu ý
                        </Text>
                        {aiSummary.concerns.map((c, i) => (
                          <Text key={i} style={[styles.aiSummaryItem, { color: colors.text }]}>
                            • {c}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.aiDisclaimer}>
                    <Ionicons
                      name="information-circle-outline"
                      size={10}
                      color={colors.textTertiary}
                    />
                    <Text style={[styles.aiDisclaimerText, { color: colors.textTertiary }]}>
                      AI tự động tổng hợp, có thể không hoàn toàn chính xác
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Sort & Filter section header ── */}
              <View style={styles.sortHeaderRow}>
                <Text style={[styles.sortHeaderLabel, { color: colors.text }]}>Sắp xếp & Lọc</Text>
                <Pressable
                  onPress={() => setShowFilterPanel((v) => !v)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.filterToggle,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="filter" size={13} color={colors.text} />
                  <Text style={[styles.filterToggleText, { color: colors.text }]}>
                    {showFilterPanel ? "Ẩn bộ lọc" : "Bộ lọc"}
                  </Text>
                  {(withPhotosOnly || tripTypeFilter !== "any" || starFilters.size > 0) && (
                    <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />
                  )}
                </Pressable>
              </View>

              {/* ── Sort chips ── */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortChipsRowH}
              >
                {[
                  { key: "relevant", label: "Phù hợp nhất", icon: "sparkles" as const },
                  { key: "newest", label: "Mới nhất", icon: "time-outline" as const },
                  { key: "highest", label: "Cao nhất", icon: "trending-up" as const },
                  { key: "lowest", label: "Thấp nhất", icon: "trending-down" as const },
                ].map((opt) => {
                  const active = reviewSort === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setReviewSort(opt.key as any);
                      }}
                      style={[
                        styles.sortChip,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.cardBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={13}
                        color={active ? "#fff" : colors.textSecondary}
                      />
                      <Text style={[styles.sortChipText, { color: active ? "#fff" : colors.text }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* ── Expandable filter panel ── */}
              {showFilterPanel && (
                <View
                  style={[
                    styles.filterPanel,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  {/* Star filter */}
                  <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>
                    SỐ SAO
                  </Text>
                  <View style={styles.filterRow}>
                    {[5, 4, 3, 2, 1].map((star) => {
                      const active = starFilters.has(star);
                      return (
                        <Pressable
                          key={star}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setStarFilters((prev) => {
                              const next = new Set(prev);
                              if (next.has(star)) next.delete(star);
                              else next.add(star);
                              return next;
                            });
                          }}
                          style={[
                            styles.starChip,
                            {
                              backgroundColor: active ? "#F59E0B" : colors.inputBg,
                              borderColor: active ? "#F59E0B" : colors.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.starChipText, { color: active ? "#fff" : colors.text }]}
                          >
                            {star}
                          </Text>
                          <Ionicons name="star" size={11} color={active ? "#fff" : "#F59E0B"} />
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Has photos */}
                  <Text
                    style={[
                      styles.filterPanelLabel,
                      { color: colors.textSecondary, marginTop: 14 },
                    ]}
                  >
                    NỘI DUNG
                  </Text>
                  <View style={styles.filterRow}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setWithPhotosOnly((v) => !v);
                      }}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor: withPhotosOnly ? colors.primary : colors.inputBg,
                          borderColor: withPhotosOnly ? colors.primary : colors.cardBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name={withPhotosOnly ? "camera" : "camera-outline"}
                        size={12}
                        color={withPhotosOnly ? "#fff" : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: withPhotosOnly ? "#fff" : colors.text },
                        ]}
                      >
                        Có ảnh
                      </Text>
                    </Pressable>
                  </View>

                  {/* Trip type filter */}
                  <Text
                    style={[
                      styles.filterPanelLabel,
                      { color: colors.textSecondary, marginTop: 14 },
                    ]}
                  >
                    LOẠI CHUYẾN
                  </Text>
                  <View style={styles.filterRow}>
                    {[
                      { key: "any", label: "Tất cả", icon: "apps" as const },
                      { key: "solo", label: "Solo", icon: "person" as const },
                      { key: "couple", label: "Cặp đôi", icon: "heart" as const },
                      { key: "family", label: "Gia đình", icon: "people" as const },
                    ].map((opt) => {
                      const active = tripTypeFilter === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setTripTypeFilter(opt.key as any);
                          }}
                          style={[
                            styles.filterPill,
                            {
                              backgroundColor: active ? colors.primary : colors.inputBg,
                              borderColor: active ? colors.primary : colors.cardBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name={opt.icon}
                            size={12}
                            color={active ? "#fff" : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.filterPillText,
                              { color: active ? "#fff" : colors.text },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Reset */}
                  {(withPhotosOnly || tripTypeFilter !== "any" || starFilters.size > 0) && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setWithPhotosOnly(false);
                        setTripTypeFilter("any");
                        setStarFilters(new Set());
                      }}
                      style={({ pressed }) => [
                        styles.filterResetBtn,
                        { borderColor: colors.cardBorder, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Ionicons name="refresh" size={13} color={colors.textSecondary} />
                      <Text style={[styles.filterResetText, { color: colors.textSecondary }]}>
                        Xóa bộ lọc
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Grouped reviews */}
              {(showAllUserReviews ? sortedReviewsByUser : sortedReviewsByUser.slice(0, 5)).map(
                (group) => {
                  const isOwn = user?.id === group.userId;
                  const avatarColors = [
                    "#6C5CE7",
                    "#00B894",
                    "#E17055",
                    "#0984E3",
                    "#FDCB6E",
                    "#E84393",
                  ];
                  const avatarBg = avatarColors[group.userName.charCodeAt(0) % avatarColors.length];
                  const expanded = expandedUserIds.has(group.userId);
                  const visibleReviews =
                    expanded || group.reviews.length === 1 ? group.reviews : [group.reviews[0]];
                  const avatarSrc = isOwn ? user?.avatar : group.userAvatarUrl;
                  return (
                    <View
                      key={group.userId}
                      style={[
                        styles.reviewCardV2,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      ]}
                    >
                      {/* ── User header ── */}
                      <View style={styles.reviewHeaderV2}>
                        <View
                          style={[
                            styles.avatarRing,
                            { borderColor: isOwn ? colors.primary : colors.cardBorder },
                          ]}
                        >
                          {avatarSrc ? (
                            <Image
                              source={{ uri: avatarSrc }}
                              style={styles.reviewAvatarV2}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.reviewAvatarV2,
                                {
                                  backgroundColor: avatarBg,
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                              ]}
                            >
                              <Text style={styles.reviewAvatarTextV2}>
                                {group.userName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <Text style={[styles.reviewNameV2, { color: colors.text }]}>
                              {group.userName}
                            </Text>
                            {isOwn && (
                              <View
                                style={[styles.ownBadgeV2, { backgroundColor: colors.primary }]}
                              >
                                <Ionicons name="person" size={9} color="#fff" />
                                <Text style={styles.ownBadgeTextV2}>Bạn</Text>
                              </View>
                            )}
                            <ReviewerBadge level={group.reviews[0].userReviewerLevel} />
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginTop: 3,
                            }}
                          >
                            {group.reviews.length > 1 ? (
                              <View
                                style={[
                                  styles.visitCountBadge,
                                  { backgroundColor: colors.accent + "20" },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="map-marker-multiple"
                                  size={11}
                                  color={colors.accent}
                                />
                                <Text style={[styles.visitCountText, { color: colors.accent }]}>
                                  Đã đến {group.reviews.length} lần
                                </Text>
                              </View>
                            ) : (
                              <Text style={[styles.reviewSubMeta, { color: colors.textTertiary }]}>
                                1 chuyến đi
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* ── Visit reviews (timeline) ── */}
                      {visibleReviews.map((review, idx) => {
                        const dateStr = new Date(review.createdAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        });
                        const monthYear = new Date(review.createdAt).toLocaleDateString("vi-VN", {
                          month: "long",
                          year: "numeric",
                        });
                        const isLast = idx === visibleReviews.length - 1;
                        const hasMultiVisit = group.reviews.length > 1;
                        return (
                          <View key={`${review.id}-${idx}`} style={styles.visitEntryRow}>
                            {/* Timeline dot + line (only when multi-visit) */}
                            {hasMultiVisit && (
                              <View style={styles.timelineCol}>
                                <View
                                  style={[styles.timelineDot, { backgroundColor: colors.primary }]}
                                />
                                {!isLast && (
                                  <View
                                    style={[
                                      styles.timelineLine,
                                      { backgroundColor: colors.divider },
                                    ]}
                                  />
                                )}
                              </View>
                            )}

                            <View style={{ flex: 1, gap: 8 }}>
                              {/* Top row: stars + date */}
                              <View style={styles.visitStarsRow}>
                                <StarRating
                                  rating={review.rating}
                                  size={15}
                                  colors={colors}
                                  mode="full"
                                  spacing={2}
                                />
                                <Text style={[styles.visitDate, { color: colors.textTertiary }]}>
                                  {dateStr}
                                </Text>
                              </View>

                              {/* Trip context chips */}
                              {(review.tripTitle ||
                                review.tripStartDate ||
                                review.tripNumPeople) && (
                                <View style={styles.contextChipsRow}>
                                  {review.tripStartDate && (
                                    <View
                                      style={[
                                        styles.contextChip,
                                        { backgroundColor: colors.primary + "15" },
                                      ]}
                                    >
                                      <Ionicons name="calendar" size={10} color={colors.primary} />
                                      <Text
                                        style={[styles.contextChipText, { color: colors.primary }]}
                                      >
                                        {new Date(review.tripStartDate).toLocaleDateString(
                                          "vi-VN",
                                          { month: "2-digit", year: "numeric" },
                                        )}
                                      </Text>
                                    </View>
                                  )}
                                  {typeof review.tripNumPeople === "number" &&
                                    review.tripNumPeople > 0 && (
                                      <View
                                        style={[
                                          styles.contextChip,
                                          { backgroundColor: colors.accent + "15" },
                                        ]}
                                      >
                                        <Ionicons name="people" size={10} color={colors.accent} />
                                        <Text
                                          style={[styles.contextChipText, { color: colors.accent }]}
                                        >
                                          {review.tripNumPeople === 1
                                            ? "Solo"
                                            : `${review.tripNumPeople} người`}
                                        </Text>
                                      </View>
                                    )}
                                  {review.tripTitle && (
                                    <View
                                      style={[
                                        styles.contextChip,
                                        { backgroundColor: colors.success + "15" },
                                      ]}
                                    >
                                      <Ionicons name="airplane" size={10} color={colors.success} />
                                      <Text
                                        style={[styles.contextChipText, { color: colors.success }]}
                                        numberOfLines={1}
                                      >
                                        {review.tripTitle}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {/* Quote-styled comment */}
                              {review.comment.length > 0 && (
                                <View
                                  style={[
                                    styles.quoteBlock,
                                    {
                                      borderLeftColor: colors.primary + "60",
                                      backgroundColor: colors.inputBg + "80",
                                    },
                                  ]}
                                >
                                  <MaterialCommunityIcons
                                    name="format-quote-open"
                                    size={14}
                                    color={colors.primary + "80"}
                                    style={{ position: "absolute", top: 6, left: 8 }}
                                  />
                                  <Text style={[styles.quoteText, { color: colors.text }]}>
                                    {review.comment}
                                  </Text>
                                </View>
                              )}

                              {/* Photo gallery */}
                              {review.photos && review.photos.length > 0 && (
                                <ReviewPhotos photos={review.photos} colors={colors} />
                              )}

                              {/* Action row: helpful + reply + edit/delete + report */}
                              {(() => {
                                const voteKey = `${review.userId}|${review.itineraryId}`;
                                const voteState = helpfulCounts[voteKey] || {
                                  count: 0,
                                  voted: false,
                                };
                                const replyKey = `${review.userId}|${review.itineraryId}`;
                                const replyOpen = openReplyThreads.has(replyKey);
                                return (
                                  <>
                                    <View style={styles.actionRowV2}>
                                      {!isOwn && (
                                        <HelpfulButton
                                          count={voteState.count}
                                          voted={voteState.voted}
                                          onPress={() => {
                                            if (review.itineraryId)
                                              toggleHelpful(review.userId, review.itineraryId);
                                          }}
                                          colors={colors}
                                        />
                                      )}
                                      <Pressable
                                        onPress={() => toggleReplyThread(replyKey)}
                                        hitSlop={6}
                                        style={({ pressed }) => [
                                          styles.helpfulBtn,
                                          {
                                            borderColor: colors.cardBorder,
                                            opacity: pressed ? 0.7 : 1,
                                          },
                                        ]}
                                      >
                                        <Ionicons
                                          name={replyOpen ? "chatbubble" : "chatbubble-outline"}
                                          size={12}
                                          color={replyOpen ? colors.primary : colors.textSecondary}
                                        />
                                        <Text
                                          style={[
                                            styles.helpfulText,
                                            {
                                              color: replyOpen
                                                ? colors.primary
                                                : colors.textSecondary,
                                            },
                                          ]}
                                        >
                                          Phản hồi
                                        </Text>
                                      </Pressable>
                                      {isOwn ? (
                                        <>
                                          <Pressable
                                            onPress={() => handleEditReview(review)}
                                            hitSlop={6}
                                            style={({ pressed }) => [
                                              styles.helpfulBtn,
                                              {
                                                borderColor: colors.primary + "40",
                                                opacity: pressed ? 0.7 : 1,
                                              },
                                            ]}
                                          >
                                            <Ionicons
                                              name="create-outline"
                                              size={12}
                                              color={colors.primary}
                                            />
                                            <Text
                                              style={[
                                                styles.helpfulText,
                                                { color: colors.primary },
                                              ]}
                                            >
                                              Sửa
                                            </Text>
                                          </Pressable>
                                          <Pressable
                                            onPress={() => handleDeleteReview(review.id)}
                                            hitSlop={6}
                                            style={({ pressed }) => [
                                              styles.helpfulBtn,
                                              {
                                                borderColor: "#EF4444" + "40",
                                                opacity: pressed ? 0.7 : 1,
                                              },
                                            ]}
                                          >
                                            <Ionicons
                                              name="trash-outline"
                                              size={12}
                                              color="#EF4444"
                                            />
                                            <Text
                                              style={[styles.helpfulText, { color: "#EF4444" }]}
                                            >
                                              Xóa
                                            </Text>
                                          </Pressable>
                                        </>
                                      ) : (
                                        <Pressable
                                          onPress={() =>
                                            setReportTarget({
                                              contentType: "review",
                                              contentRefId: `${review.userId}_${review.itineraryId}`,
                                            })
                                          }
                                          hitSlop={6}
                                          style={({ pressed }) => [
                                            styles.helpfulBtn,
                                            {
                                              borderColor: colors.cardBorder,
                                              opacity: pressed ? 0.7 : 1,
                                            },
                                          ]}
                                        >
                                          <Ionicons
                                            name="flag-outline"
                                            size={12}
                                            color={colors.textTertiary}
                                          />
                                          <Text
                                            style={[
                                              styles.helpfulText,
                                              { color: colors.textTertiary },
                                            ]}
                                          >
                                            Báo cáo
                                          </Text>
                                        </Pressable>
                                      )}
                                    </View>

                                    {/* Reply thread (expandable) */}
                                    {replyOpen && review.itineraryId && (
                                      <ReplyThread
                                        reviewUserId={Number(review.userId)}
                                        reviewTripId={Number(review.itineraryId)}
                                        currentUserId={user ? Number(user.id) : undefined}
                                        colors={colors}
                                        onReport={(replyId) =>
                                          setReportTarget({
                                            contentType: "reply",
                                            contentRefId: String(replyId),
                                          })
                                        }
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </View>
                          </View>
                        );
                      })}

                      {group.reviews.length > 1 && (
                        <Pressable
                          onPress={() => toggleExpandUser(group.userId)}
                          hitSlop={6}
                          style={({ pressed }) => [
                            styles.expandMoreBtn,
                            { backgroundColor: colors.inputBg, opacity: pressed ? 0.85 : 1 },
                          ]}
                        >
                          <Ionicons
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={[styles.expandMoreText, { color: colors.primary }]}>
                            {expanded
                              ? "Thu gọn"
                              : `Xem ${group.reviews.length - 1} đánh giá khác từ ${group.userName.split(" ").slice(-1)[0]}`}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                },
              )}

              {sortedReviewsByUser.length > 5 && (
                <Pressable
                  onPress={() => setShowAllUserReviews((v) => !v)}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    { borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons
                    name={showAllUserReviews ? "chevron-up" : "chatbubbles-outline"}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[styles.outlineBtnText, { color: colors.primary }]}>
                    {showAllUserReviews
                      ? "Thu gọn"
                      : `Xem thêm ${sortedReviewsByUser.length - 5} đánh giá`}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.emptyBox,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textTertiary} />
              <Text style={{ color: colors.text, fontSize: 14, fontFamily: "Inter_700Bold" }}>
                Chưa có đánh giá
              </Text>
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  textAlign: "center",
                }}
              >
                Hãy là người đầu tiên đánh giá điểm đến này sau khi hoàn thành chuyến đi
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ══════════ STICKY BOTTOM CTA ══════════ */}
      <View
        style={[
          styles.stickyBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.divider,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.push({ pathname: "/create-trip", params: { dest: destination.name } })
          }
          style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.9 : 1 }]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="airplane" size={18} color="#fff" />
          <Text style={styles.ctaBtnText}>Tạo chuyến đi đến {destination.name}</Text>
        </Pressable>
      </View>

      {/* ══════════ REPORT MODAL (Phase 1.5) ══════════ */}
      <ReportModal
        visible={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        colors={colors}
      />

      {/* ══════════ REVIEW EDIT MODAL ══════════ */}
      <Modal
        visible={!!editingReviewId}
        transparent
        animationType="slide"
        onRequestClose={cancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalOverlay} onPress={cancelEdit}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: colors.card }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Chỉnh sửa đánh giá</Text>
                <Pressable onPress={cancelEdit} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView>
                <View style={styles.modalRatingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setUserRating(star);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={star <= userRating ? "star" : "star-outline"}
                        size={36}
                        color="#F59E0B"
                      />
                    </Pressable>
                  ))}
                </View>
                <View
                  style={[
                    styles.modalInputBox,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <TextInput
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontFamily: "Inter_400Regular",
                      height: 120,
                    }}
                    placeholder="Chia sẻ trải nghiệm của bạn..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                    value={userComment}
                    onChangeText={setUserComment}
                  />
                </View>
                <Pressable
                  onPress={handleSubmitReview}
                  disabled={submittingReview}
                  style={({ pressed }) => [
                    styles.modalSubmitBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: submittingReview ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={styles.modalSubmitText}>
                    {submittingReview ? "Đang gửi..." : "Cập nhật đánh giá"}
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

function SectionWrap({ children }: { children: React.ReactNode }) {
  return <View style={{ paddingHorizontal: 20, marginTop: 22 }}>{children}</View>;
}

function SectionTitle({
  icon,
  iconColor,
  title,
  colors,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.inlineSectionHeader}>
      <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      <Text style={[styles.inlineSectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function DestinationSkeleton({
  colors,
  insets,
  webTopInset,
}: {
  colors: ThemeColors;
  insets: { top: number; bottom: number };
  webTopInset: number;
}) {
  const block = (w: any, h: number) => (
    <View style={{ width: w, height: h, borderRadius: 6, backgroundColor: colors.inputBg }} />
  );
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.heroImage, { backgroundColor: colors.inputBg }]} />
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        style={[
          styles.floatBtn,
          { top: insets.top + webTopInset + 8, position: "absolute", left: 16 },
        ]}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {block("60%", 26)}
          {block(76, 22)}
        </View>
        {block("35%", 14)}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {block("48%", 40)}
          {block("48%", 40)}
        </View>
        {block("100%", 14)}
        {block("100%", 14)}
        {block("85%", 14)}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  notFoundWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  notFoundText: { fontSize: 15, fontFamily: "Inter_500Medium", marginTop: 12 },
  floatBackBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Hero ─────────────────────────────────────────────────
  heroWrap: { position: "relative" },
  heroImage: { width: "100%", height: 320 },
  heroTopRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfoOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 36,
    gap: 8,
  },
  heroChipRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  heroCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroCategoryText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#0F172A" },
  heroRatingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroRatingText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  heroRatingCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  heroName: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  heroLocRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroLocText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.92)",
    flex: 1,
  },
  imageDots: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 20 },

  // ─── Quick actions ────────────────────────────────────────
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  quickActionText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  // ─── Cards / sections ─────────────────────────────────────
  inlineSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  inlineSectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  descText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },

  // Highlight/tip rows
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  listBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  listText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, flex: 1 },

  // Best-time info card
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  infoCardValue: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },

  // ─── Section header (Blog/Templates/Q&A/Reviews) ──────────
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
    gap: 10,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionTitleSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  sectionRightLink: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // ─── Review cards ─────────────────────────────────────────
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  reviewName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  reviewDate: { fontSize: 11, fontFamily: "Inter_500Medium" },
  reviewComment: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  googleGuideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  ownBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },

  // ─── Rating summary ──────────────────────────────────────
  summaryCard: {
    flexDirection: "row",
    gap: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  summaryLeft: { alignItems: "center", gap: 4, minWidth: 70 },
  summaryBig: { fontSize: 32, fontFamily: "Inter_700Bold" },
  summaryCount: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  summaryRight: { flex: 1, justifyContent: "center", gap: 3 },
  summaryBarRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  summaryBarLabel: { fontSize: 10, fontFamily: "Inter_700Bold", width: 10, textAlign: "right" },
  summaryBarTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  summaryBarFill: { height: "100%", borderRadius: 3 },
  summaryBarCount: { fontSize: 10, fontFamily: "Inter_500Medium", width: 18, textAlign: "right" },

  // ─── Misc ─────────────────────────────────────────────────
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 10,
  },
  outlineBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyBox: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  skeletonReview: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(0,0,0,0.05)",
  },
  skeletonAvatar: { width: 36, height: 36, borderRadius: 18 },
  skeletonLine: { height: 10, borderRadius: 4 },

  // ─── Sticky bottom CTA ────────────────────────────────────
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#0891B2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  // ═══════════════════════════════════════════════════════
  // V2 REVIEW SECTION STYLES (Booking/Airbnb premium pattern)
  // ═══════════════════════════════════════════════════════
  ratingSummaryV2: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  ratingSummaryTop: { marginBottom: 12 },
  ratingSummaryScore: { flexDirection: "row", alignItems: "center", gap: 14 },
  ratingScoreBadge: {
    width: 60,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingScoreNumber: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  ratingQualityLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ratingMetaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  summaryDistTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  summaryBarRowV2: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryBarLabelGroup: { flexDirection: "row", alignItems: "center", gap: 2, width: 30 },
  summaryBarLabelV2: { fontSize: 12, fontFamily: "Inter_700Bold" },
  summaryBarTrackV2: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  summaryBarFillV2: { height: "100%", borderRadius: 4 },
  summaryBarCountV2: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    minWidth: 56,
    textAlign: "right",
  },

  // AI Summary card
  aiSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  aiSummaryHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  aiSummaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  aiSummaryTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  aiSummaryMeta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  aiSummaryBody: { gap: 4 },
  aiSummarySection: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  aiSummaryItem: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginLeft: 4 },
  aiDisclaimer: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12 },
  aiDisclaimerText: { fontSize: 9, fontFamily: "Inter_500Medium", fontStyle: "italic" },

  // Sort & filter section
  sortHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sortHeaderLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterToggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },
  sortChipsRowH: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingRight: 20 },
  filterPanel: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  filterPanelLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  starChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  starChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterResetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  filterResetText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  sortChipsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  reviewCardV2: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  reviewHeaderV2: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    padding: 2,
  },
  reviewAvatarV2: { width: 40, height: 40, borderRadius: 20 },
  reviewAvatarTextV2: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  reviewNameV2: { fontSize: 15, fontFamily: "Inter_700Bold" },
  ownBadgeV2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ownBadgeTextV2: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" },
  visitCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  visitCountText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  reviewSubMeta: { fontSize: 11, fontFamily: "Inter_500Medium" },

  visitEntryRow: { flexDirection: "row", gap: 10 },
  timelineCol: { alignItems: "center", paddingTop: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  timelineLine: { width: 2, flex: 1, minHeight: 40 },
  visitStarsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  visitDate: { fontSize: 11, fontFamily: "Inter_500Medium" },

  contextChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 200,
  },
  contextChipText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  quoteBlock: {
    padding: 12,
    paddingLeft: 28,
    borderLeftWidth: 3,
    borderRadius: 10,
    position: "relative",
  },
  quoteText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  actionRowV2: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  helpfulBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  helpfulText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  expandMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  expandMoreText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // ─── Review edit modal ───────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
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
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalRatingRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 },
  modalInputBox: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 20 },
  modalSubmitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  modalSubmitText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
