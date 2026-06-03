import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useDestination } from "@/hooks/queries/use-destinations";
import { useTrips } from "@/hooks/queries/use-trips";
import { useReviews, useCreateReview, useUpdateReview, useDeleteReview } from "@/hooks/queries/use-reviews";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { formatVND } from "@/lib/storage";
import { t } from "@/lib/i18n";
import { getApiUrl, getApiHeaders } from "@/lib/query-client";

function StarRating({
  rating,
  onRate,
  size = 24,
  colors,
}: {
  rating: number;
  onRate?: (r: number) => void;
  size?: number;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onRate?.(star)} disabled={!onRate} hitSlop={4}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={colors.star}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function DestinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const destinationQuery = useDestination(id);
  const tripsQuery = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const reviewsQuery = useReviews({ destinationId: id ? Number(id) : undefined });
  const createReview = useCreateReview();
  const updateReviewMut = useUpdateReview();
  const deleteReviewMut = useDeleteReview();
  const itineraries = tripsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([destinationQuery.refetch(), reviewsQuery.refetch()]);
    setRefreshing(false);
  }, [destinationQuery, reviewsQuery]);

  const destination = destinationQuery.data;


  const [imageIndex, setImageIndex] = useState(0);

  // ─── User review form state ─────────────────────
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [showAllUserReviews, setShowAllUserReviews] = useState(false);

  // SerpAPI reviews state — must be declared before any early returns
  const [serpReviews, setSerpReviews] = useState<any[]>([]);
  const [serpNextToken, setSerpNextToken] = useState<string | null>(null);
  const [serpLoading, setSerpLoading] = useState(false);
  const [serpError, setSerpError] = useState(false);
  const [serpPlaceInfo, setSerpPlaceInfo] = useState<any>(null);
  const [expandedSerpIds, setExpandedSerpIds] = useState<Set<string>>(new Set());

  const fetchSerpReviews = async (placeId?: string, query?: string, nextToken?: string) => {
    if (!placeId && !query) return;
    setSerpLoading(true);
    setSerpError(false);
    try {
      const baseUrl = getApiUrl().replace(/\/$/, "");
      const params = new URLSearchParams();
      if (placeId) params.set("place_id", placeId);
      if (query) params.set(placeId ? "fallback_q" : "q", query);
      if (nextToken) params.set("next_page_token", nextToken);
      
      const res = await fetch(`${baseUrl}/api/places/reviews?${params.toString()}`, { headers: getApiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (nextToken) {
        setSerpReviews((prev) => [...prev, ...(data.reviews || [])]);
      } else {
        setSerpReviews(data.reviews || []);
        setSerpPlaceInfo(data.placeInfo || null);
      }
      setSerpNextToken(data.nextPageToken || null);
    } catch (err) {
      console.warn("SerpAPI reviews error:", err);
      setSerpError(true);
    } finally {
      setSerpLoading(false);
    }
  };

  // Auto-fetch reviews when destination has info
  useEffect(() => {
    const q = [destination?.name, destination?.address].filter(Boolean).join(", ");
    fetchSerpReviews(destination?.googlePlaceId, q);
  }, [destination?.id, destination?.googlePlaceId]);

  // ─── User reviews for this destination ──────────
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

  // Rating distribution (5→1)
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]; // index 0→5star, 1→4star, etc.
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

  // Submit / update review
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
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUserRating(0);
      setUserComment("");
      setEditingReviewId(null);
    } catch (err) {
      console.warn("Review submit error:", err);
      if (Platform.OS === "web") alert("Không thể gửi đánh giá");
      else Alert.alert("Lỗi", "Không thể gửi đánh giá");
    } finally {
      setSubmittingReview(false);
    }
  }, [user, userRating, userComment, editingReviewId, id, createReview, updateReviewMut, reviews]);

  const handleEditReview = useCallback((review: typeof destUserReviews[0]) => {
    setEditingReviewId(review.id);
    setUserRating(review.rating);
    setUserComment(review.comment);
  }, []);

  const handleDeleteReview = useCallback(async (reviewId: string) => {
    if (!user) return; // Guard for TypeScript

    const doDelete = async () => {
      try {
        await deleteReviewMut.mutateAsync({ id: reviewId, userId: user.id, type: "trip" });
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (editingReviewId === reviewId) {
          setEditingReviewId(null);
          setUserRating(0);
          setUserComment("");
        }
      } catch (err) {
        console.warn("Delete review error:", err);
      }
    };
    if (Platform.OS === "web") {
      if (confirm(t().itinerary.deleteReviewConfirm)) await doDelete();
    } else {
      Alert.alert(t().itinerary.deleteReview, t().itinerary.deleteReviewConfirm, [
        { text: t().common.cancel, style: "cancel" },
        { text: t().common.delete, style: "destructive", onPress: doDelete },
      ]);
    }
  }, [deleteReviewMut, editingReviewId]);

  const cancelEdit = useCallback(() => {
    setEditingReviewId(null);
    setUserRating(0);
    setUserComment("");
  }, []);

  if (!destination) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>{t().destination.notFound}</Text>
      </View>
    );
  }


  const openGoogleMaps = () => {
    const destinationQuery = [destination.name, destination.address].filter(Boolean).join(", ");
    if (destination.googlePlaceId && destinationQuery) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&destination_place_id=${destination.googlePlaceId}`);
    } else if (destinationQuery) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`);
    }
  };

  const openGrab = () => {
    const url = Platform.OS === "ios"
      ? `grab://open?screenType=BOOKING&dropOffLatitude=${destination.latitude}&dropOffLongitude=${destination.longitude}`
      : `https://grab.onelink.me/2695613898?af_dp=grab%3A%2F%2Fopen%3FscreenType%3DBOOKING%26dropOffLatitude%3D${destination.latitude}%26dropOffLongitude%3D${destination.longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`);
    });
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const txt = t().destination;
  const itxt = t().itinerary;


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={{ position: "relative" }}>
          <Image source={{ uri: destination.images[imageIndex] }} style={styles.heroImage} contentFit="cover" />
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            style={[styles.backBtn, { top: insets.top + webTopInset + 8 }]}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          {destination.images.length > 1 && (
            <View style={styles.imageDots}>
              {destination.images.map((_, i) => (
                <Pressable key={i} onPress={() => setImageIndex(i)}>
                  <View style={[styles.dot, i === imageIndex && styles.dotActive]} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>{destination.name}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: colors.tagBg }]}>
              <Text style={[styles.categoryText, { color: colors.tagText }]}>{t().categories[destination.category] || destination.category}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="star" size={16} color={colors.star} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {destination.rating} ({destination.reviewCount})
              </Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>{destination.address}</Text>
          </View>

          <View style={styles.deepLinkRow}>
            <Pressable
              onPress={openGoogleMaps}
              style={({ pressed }) => [styles.deepLinkBtn, { backgroundColor: "#4285F4", opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="map" size={18} color="#fff" />
              <Text style={styles.deepLinkText}>{txt.openMaps}</Text>
            </Pressable>
            <Pressable
              onPress={openGrab}
              style={({ pressed }) => [styles.deepLinkBtn, { backgroundColor: "#00B14F", opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="car" size={18} color="#fff" />
              <Text style={styles.deepLinkText}>{txt.bookGrab}</Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{txt.about}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{destination.description}</Text>

          {destination.bestTimeToVisit && (
            <View style={[styles.bestTimeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.bestTimeRow}>
                <Ionicons name="sunny-outline" size={20} color={colors.accent} />
                <Text style={[styles.bestTimeLabel, { color: colors.text }]}>{txt.bestTime}</Text>
              </View>
              <Text style={[styles.bestTimeValue, { color: colors.primary }]}>{destination.bestTimeToVisit}</Text>
            </View>
          )}

          {destination.highlights && destination.highlights.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{txt.highlights}</Text>
              <View style={styles.listContainer}>
                {destination.highlights.map((h, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Ionicons name="star" size={14} color={colors.accent} />
                    <Text style={[styles.listText, { color: colors.textSecondary }]}>{h}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {destination.tips && destination.tips.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{txt.tips}</Text>
              <View style={styles.listContainer}>
                {destination.tips.map((tip, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Ionicons name="bulb-outline" size={14} color={colors.primary} />
                    <Text style={[styles.listText, { color: colors.textSecondary }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={[styles.coordCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.coordRow}>
              <View style={[styles.coordItem, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>{txt.lat}</Text>
                <Text style={[styles.coordValue, { color: colors.text }]}>{destination.latitude.toFixed(4)}</Text>
              </View>
              <View style={[styles.coordItem, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>{txt.lng}</Text>
                <Text style={[styles.coordValue, { color: colors.text }]}>{destination.longitude.toFixed(4)}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => router.push({ pathname: "/create-trip", params: { dest: destination.name } })}
            style={({ pressed }) => [
              styles.planButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="airplane-outline" size={20} color="#fff" />
            <Text style={styles.planButtonText}>{txt.planTrip}</Text>
          </Pressable>

          {/* SerpAPI Google Maps Reviews */}
          {(destination.googlePlaceId || destination.name) ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{itxt.serpReviews}</Text>

              {serpLoading && serpReviews.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textTertiary, marginTop: 8 }}>{itxt.serpReviewsLoading}</Text>
                </View>
              )}

              {serpError && serpReviews.length === 0 && (
                <View style={styles.emptyReviews}>
                  <Ionicons name="alert-circle-outline" size={28} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{itxt.serpReviewsError}</Text>
                </View>
              )}

              {serpReviews.map((review: any, idx: number) => {
                const SNIPPET_LIMIT = 150;
                const snippet = review.snippet || "";
                const isLong = snippet.length > SNIPPET_LIMIT;
                const isExpanded = expandedSerpIds.has(`serp_${idx}`);
                const displaySnippet = isLong && !isExpanded ? snippet.slice(0, SNIPPET_LIMIT).trimEnd() + "..." : snippet;

                return (
                  <View key={review.reviewId || idx} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderLeftWidth: 3, borderLeftColor: "#4285F4" }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewAvatar, { backgroundColor: "#4285F4" }]}>
                        <Text style={styles.reviewAvatarText}>{review.author.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={[styles.reviewName, { color: colors.text }]}>{review.author}</Text>
                          {review.isLocalGuide && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#4285F4" + "18", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 }}>
                              <Ionicons name="shield-checkmark" size={10} color="#4285F4" />
                              <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#4285F4" }}>{itxt.serpLocalGuide}</Text>
                            </View>
                          )}
                        </View>
                        {review.date && (
                          <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>{review.date}</Text>
                        )}
                      </View>
                      <StarRating rating={review.rating} size={14} colors={colors} />
                    </View>
                    {displaySnippet.length > 0 && (
                      <View>
                        <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{displaySnippet}</Text>
                        {isLong && (
                          <Pressable
                            onPress={() => {
                              setExpandedSerpIds((prev) => {
                                const next = new Set(prev);
                                const key = `serp_${idx}`;
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              });
                            }}
                            hitSlop={6}
                          >
                            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary, marginTop: 4 }}>
                              {isExpanded ? t().itinerary.seeLess : t().itinerary.seeMore}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                    {review.likes > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Ionicons name="thumbs-up-outline" size={12} color={colors.textTertiary} />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.textTertiary }}>{itxt.serpReviewLikes(review.likes)}</Text>
                      </View>
                    )}
                    {review.response && (
                      <View style={{ marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.textTertiary + "40" }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.textSecondary }}>Phản hồi:</Text>
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textTertiary, marginTop: 2 }}>{review.response.snippet}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {serpNextToken && (
                <Pressable
                  onPress={() => {
                    if (destination.googlePlaceId && !serpLoading) {
                      fetchSerpReviews(destination.googlePlaceId, serpNextToken);
                    }
                  }}
                  style={({ pressed }) => [styles.seeMoreGoogleBtn, { backgroundColor: colors.inputBg, opacity: pressed ? 0.8 : 1 }]}
                >
                  {serpLoading ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <>
                      <Ionicons name="chatbubbles-outline" size={16} color="#4285F4" />
                      <Text style={[styles.seeMoreGoogleText, { color: "#4285F4" }]}>{itxt.serpReviewsLoadMore}</Text>
                      <Ionicons name="chevron-down" size={16} color="#4285F4" />
                    </>
                  )}
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  const searchQuery = [destination.name, destination.address].filter(Boolean).join(", ");
                  const query = encodeURIComponent(searchQuery);
                  const placeIdParam = destination.googlePlaceId ? `&query_place_id=${destination.googlePlaceId}` : "";
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}${placeIdParam}`);
                }}
                style={({ pressed }) => [styles.seeMoreGoogleBtn, { backgroundColor: "#4285F4", opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="logo-google" size={18} color="#fff" />
                <Text style={styles.seeMoreGoogleText}>{txt.seeMoreOnGoogle}</Text>
              </Pressable>
            </>
          ) : null}

          {/* ═══════ User Reviews Section ═══════ */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t().destination.userReviews}</Text>

            {/* Rating Summary */}
            {destUserReviews.length > 0 && (
              <View style={[styles.ratingSummaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.ratingSummaryLeft}>
                  <Text style={[styles.ratingSummaryBig, { color: colors.text }]}>{averageUserRating}</Text>
                  <StarRating rating={Math.round(averageUserRating)} size={18} colors={colors} />
                  <Text style={[styles.ratingSummaryCount, { color: colors.textTertiary }]}>
                    {destUserReviews.length} {t().itinerary.activityReviewCount}
                  </Text>
                </View>
                <View style={styles.ratingSummaryRight}>
                  {[5, 4, 3, 2, 1].map((star, idx) => {
                    const count = ratingDistribution[idx];
                    const pct = destUserReviews.length > 0 ? (count / destUserReviews.length) * 100 : 0;
                    return (
                      <View key={star} style={styles.ratingBarRow}>
                        <Text style={[styles.ratingBarLabel, { color: colors.textTertiary }]}>{star}</Text>
                        <Ionicons name="star" size={10} color={colors.star} />
                        <View style={[styles.ratingBarTrack, { backgroundColor: colors.inputBg }]}>
                          <View style={[styles.ratingBarFill, { width: `${pct}%`, backgroundColor: colors.star }]} />
                        </View>
                        <Text style={[styles.ratingBarCount, { color: colors.textTertiary }]}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}



            {/* User Reviews List */}
            {destUserReviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t().destination.noReviews}</Text>
              </View>
            ) : (
              <>
                {(showAllUserReviews ? destUserReviews : destUserReviews.slice(0, 3)).map((review, idx) => {
                  const isOwn = user?.id === review.userId;
                  const dateStr = new Date(review.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
                  const avatarColors = ["#6C5CE7", "#00B894", "#E17055", "#0984E3", "#FDCB6E", "#E84393"];
                  const avatarBg = avatarColors[review.userName.charCodeAt(0) % avatarColors.length];
                  return (
                    <View key={`${review.id}-${idx}`} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderLeftWidth: 3, borderLeftColor: isOwn ? colors.primary : colors.accent }]}>
                      <View style={styles.reviewHeader}>
                        <View style={[styles.reviewAvatar, { backgroundColor: avatarBg }]}>
                          <Text style={styles.reviewAvatarText}>{review.userName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.reviewName, { color: colors.text }]}>{review.userName}</Text>
                            {isOwn && (
                              <View style={{ backgroundColor: colors.primary + "18", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 }}>
                                <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: colors.primary }}>{t().itinerary.you}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>{dateStr}</Text>
                        </View>
                        <StarRating rating={review.rating} size={14} colors={colors} />
                      </View>
                      {review.comment.length > 0 && (
                        <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>
                      )}
                      {isOwn && (
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                          <Pressable onPress={() => handleEditReview(review)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="create-outline" size={14} color={colors.primary} />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.primary }}>{t().itinerary.editReview}</Text>
                          </Pressable>
                          <Pressable onPress={() => handleDeleteReview(review.id)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="trash-outline" size={14} color="#E17055" />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#E17055" }}>{t().itinerary.deleteReview}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}

                {destUserReviews.length > 3 && (
                  <Pressable
                    onPress={() => setShowAllUserReviews((v) => !v)}
                    style={({ pressed }) => [styles.seeMoreGoogleBtn, { backgroundColor: colors.inputBg, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Ionicons name={showAllUserReviews ? "chevron-up" : "chatbubbles-outline"} size={16} color={colors.primary} />
                    <Text style={[styles.seeMoreGoogleText, { color: colors.primary }]}>
                      {showAllUserReviews ? t().itinerary.seeLess : t().itinerary.moreReviews(destUserReviews.length - 3)}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

        </View>
      </ScrollView>

      {/* Review Edit Modal */}
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
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t().itinerary.editReview}
                </Text>
                <Pressable onPress={cancelEdit} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setUserRating(star);
                      }}
                      style={styles.starBtn}
                    >
                      <Ionicons
                        name={star <= userRating ? "star" : "star-outline"}
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
                    styles.submitBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed || submittingReview ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={styles.submitBtnText}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroImage: { width: "100%", height: 280 },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageDots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 20 },
  content: { padding: 20, gap: 12, paddingBottom: 100 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", flex: 1 },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginLeft: 8 },
  categoryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  infoRow: { flexDirection: "row", gap: 20 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  addressText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  costBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  costBadgeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  deepLinkRow: { flexDirection: "row", gap: 10 },
  deepLinkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deepLinkText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  bestTimeCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  bestTimeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bestTimeLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  bestTimeValue: { fontSize: 15, fontFamily: "Inter_700Bold", marginLeft: 28 },
  listContainer: { gap: 8 },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  listText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, flex: 1 },
  planButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  planButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  seeMoreGoogleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  seeMoreGoogleText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  coordCard: { borderRadius: 14, borderWidth: 1, padding: 12 },
  coordRow: { flexDirection: "row", gap: 12 },
  coordItem: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", gap: 2 },
  coordLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  coordValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  reviewsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewForm: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  reviewInput: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  submitButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyReviews: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  reviewName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reviewDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  reviewComment: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-start", marginTop: 2 },
  sourceText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  notFound: { fontSize: 16, fontFamily: "Inter_500Medium" },
  ratingSummaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", gap: 16, marginBottom: 8 },
  ratingSummaryLeft: { alignItems: "center", justifyContent: "center", minWidth: 70, gap: 4 },
  ratingSummaryBig: { fontSize: 36, fontFamily: "Inter_700Bold" },
  ratingSummaryCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  ratingSummaryRight: { flex: 1, justifyContent: "center", gap: 3 },
  ratingBarRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingBarLabel: { fontSize: 11, fontFamily: "Inter_500Medium", width: 12, textAlign: "right" },
  ratingBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  ratingBarFill: { height: "100%", borderRadius: 3 },
  ratingBarCount: { fontSize: 11, fontFamily: "Inter_500Medium", width: 18, textAlign: "right" },
  reviewFormTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  starBtn: {
    padding: 4,
  },
  inputContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 24,
  },
  textInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
