import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useThemeColors } from "@/constants/colors";

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { destinations, reviews, addReview } = useData();

  const destination = destinations.find((d) => d.id === id);
  const destReviews = useMemo(() => reviews.filter((r) => r.destinationId === id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [reviews, id]);

  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  if (!destination) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Destination not found</Text>
      </View>
    );
  }

  const handleSubmitReview = async () => {
    if (!newComment.trim()) {
      Alert.alert("Error", "Please write a comment");
      return;
    }
    await addReview({
      userId: user!.id,
      userName: user!.fullName,
      destinationId: destination.id,
      rating: newRating,
      comment: newComment.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewComment("");
    setNewRating(5);
    setShowReviewForm(false);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ position: "relative" }}>
          <Image source={{ uri: destination.images[imageIndex] }} style={styles.heroImage} contentFit="cover" />
          <Pressable
            onPress={() => router.back()}
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
              <Text style={[styles.categoryText, { color: colors.tagText }]}>{destination.category}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="star" size={16} color={colors.star} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {destination.rating} ({destination.reviewCount})
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="cash-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{destination.priceRange}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>{destination.address}</Text>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>{destination.openHours}</Text>
          </View>

          <View style={styles.tagRow}>
            {destination.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.tagBg }]}>
                <Text style={[styles.tagText, { color: colors.tagText }]}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{destination.description}</Text>

          <View style={[styles.coordCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.coordRow}>
              <View style={[styles.coordItem, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>Lat</Text>
                <Text style={[styles.coordValue, { color: colors.text }]}>{destination.latitude.toFixed(4)}</Text>
              </View>
              <View style={[styles.coordItem, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.coordLabel, { color: colors.textTertiary }]}>Lng</Text>
                <Text style={[styles.coordValue, { color: colors.text }]}>{destination.longitude.toFixed(4)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewsHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Reviews ({destReviews.length})
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowReviewForm(!showReviewForm);
              }}
            >
              <Ionicons name={showReviewForm ? "close" : "add-circle-outline"} size={24} color={colors.primary} />
            </Pressable>
          </View>

          {showReviewForm && (
            <View style={[styles.reviewForm, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <StarRating rating={newRating} onRate={setNewRating} colors={colors} />
              <TextInput
                style={[styles.reviewInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                placeholder="Write your review..."
                placeholderTextColor={colors.textTertiary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                numberOfLines={3}
              />
              <Pressable
                onPress={handleSubmitReview}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={styles.submitButtonText}>Submit Review</Text>
              </Pressable>
            </View>
          )}

          {destReviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No reviews yet. Be the first!</Text>
            </View>
          ) : (
            destReviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.reviewAvatarText}>{review.userName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reviewName, { color: colors.text }]}>{review.userName}</Text>
                    <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>
                      {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                    </Text>
                  </View>
                  <StarRating rating={review.rating} size={14} colors={colors} />
                </View>
                <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
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
  notFound: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
