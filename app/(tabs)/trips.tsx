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

const REVIEW_STATUS_COLORS = {
  pending: { bg: "#FFF7ED", text: "#EA580C" }, // light orange
  done: { bg: "#F0FDF4", text: "#16A34A" },    // light green
};

function TripCard({
  item,
  colors,
  onDelete,
  onReview,
  isJoined,
  isReviewed,
}: {
  item: Itinerary;
  colors: ReturnType<typeof useThemeColors>;
  onDelete: () => void;
  onReview: () => void;
  isJoined: boolean;
  isReviewed: boolean;
}) {
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
          {item.status === "completed" && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onReview();
              }}
              style={[
                styles.reviewBadge,
                { backgroundColor: isReviewed ? REVIEW_STATUS_COLORS.done.bg : REVIEW_STATUS_COLORS.pending.bg },
              ]}
            >
              <Text
                style={[
                  styles.reviewText,
                  { color: isReviewed ? REVIEW_STATUS_COLORS.done.text : REVIEW_STATUS_COLORS.pending.text },
                ]}
              >
                {isReviewed ? "Đã đánh giá" : "Đánh giá"}
              </Text>
            </Pressable>
          )}

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
  const { itineraries, deleteItinerary, updateItinerary, refreshData, reviews, addReview, destinations } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const [reviewModal, setReviewModal] = useState<Itinerary | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const myTrips = useMemo(() => {
    if (!user) return [];
    return itineraries
      .filter((i) => String(i.userId) === String(user.id) || (i.companions || []).some((c) => String(c.userId) === String(user.id)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [itineraries, user]);

  const handleDelete = (id: string) => {
    const trip = itineraries.find((i) => i.id === id);
    const isJoined = trip && user && String(trip.userId) !== String(user.id);
    if (isJoined) {
      const doLeave = () => {
        const updated = (trip.companions || []).filter((c) => String(c.userId) !== String(user.id));
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

  const handleReviewSubmit = async () => {
    if (!reviewModal || !user) return;
    if (!comment.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập nhận xét của bạn");
      return;
    }

    setIsSubmitting(true);
    try {
      // Find destination ID
      const dest = destinations.find(
        (d) =>
          d.name.toLowerCase() === reviewModal.destination.toLowerCase() ||
          reviewModal.destination.toLowerCase().includes(d.name.toLowerCase())
      );

      await addReview({
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
    } catch (error) {
      console.error("Review submit error:", error);
      Alert.alert("Lỗi", "Không thể gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <>
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
          renderItem={({ item }) => {
            const isReviewed = reviews.some((r) => r.userId === user?.id && r.itineraryId === item.id && !r.activityId);
            return (
              <TripCard
                item={item}
                colors={colors}
                onDelete={() => handleDelete(item.id)}
                onReview={() => {
                  if (isReviewed) {
                    const review = reviews.find((r) => r.userId === user?.id && r.itineraryId === item.id && !r.activityId);
                    if (review?.destinationId) {
                      router.push(`/destination/${review.destinationId}`);
                    }
                    return;
                  }
                  setRating(5);
                  setComment("");
                  setReviewModal(item);
                }}
                isJoined={!!user && String(item.userId) !== String(user.id)}
                isReviewed={isReviewed}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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

      <Modal visible={!!reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setReviewModal(null)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
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
                      <Ionicons name={star <= rating ? "star" : "star-outline"} size={32} color="#F59E0B" />
                    </Pressable>
                  ))}
                </View>

                <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
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
    </>
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
  reviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  reviewText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
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
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 20,
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
