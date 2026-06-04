import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { useThemeColors } from "@/constants/colors";

interface StarRatingProps {
  rating: number;
  onRate?: (r: number) => void;
  size?: number;
  colors: ReturnType<typeof useThemeColors>;
  /** "half" renders half-stars for fractional values (Google Maps / TripAdvisor style). "full" rounds to integer. */
  mode?: "half" | "full";
  spacing?: number;
}

/**
 * Star icon row that supports half-star display.
 * mode="half" (default) — 4.4 → 4 full + 1 half empty, 4.6 → 4 full + 1 half filled, 4.75 → rounds to 5
 * Threshold: 0.25 → empty, 0.25-0.75 → half, > 0.75 → full
 */
export function StarRating({
  rating,
  onRate,
  size = 18,
  colors,
  mode = "half",
  spacing = 3,
}: StarRatingProps) {
  return (
    <View style={{ flexDirection: "row", gap: spacing }}>
      {[1, 2, 3, 4, 5].map((star) => {
        let iconName: "star" | "star-half" | "star-outline" = "star-outline";
        if (mode === "full") {
          iconName = star <= Math.round(rating) ? "star" : "star-outline";
        } else {
          const diff = rating - (star - 1);
          if (diff >= 0.75) iconName = "star";
          else if (diff >= 0.25) iconName = "star-half";
          else iconName = "star-outline";
        }
        return (
          <Pressable key={star} onPress={() => onRate?.(star)} disabled={!onRate} hitSlop={4}>
            <Ionicons name={iconName} size={size} color={colors.star} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Format rating to "X.Y" with exactly 1 decimal (4.0 → "4.0"). */
export function formatRating(rating: number): string {
  if (!Number.isFinite(rating) || rating <= 0) return "0.0";
  return (Math.round(rating * 10) / 10).toFixed(1);
}

/** "12 đánh giá từ 8 du khách" — TripAdvisor-style label. Hides "from X" when reviews == reviewers. */
export function formatReviewSummary(reviewCount: number, uniqueReviewers: number): string {
  if (reviewCount === 0) return "Chưa có đánh giá";
  if (reviewCount === 1) return "1 đánh giá";
  if (reviewCount === uniqueReviewers) return `${reviewCount} đánh giá`;
  return `${reviewCount} đánh giá từ ${uniqueReviewers} du khách`;
}

/** "Tháng 8/2025 · 4 người" — compact trip context label */
export function formatTripContext(
  tripTitle?: string,
  startDate?: string,
  numPeople?: number,
): string {
  const parts: string[] = [];
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) {
      parts.push(`Tháng ${d.getMonth() + 1}/${d.getFullYear()}`);
    }
  }
  if (typeof numPeople === "number" && numPeople > 0) {
    parts.push(numPeople === 1 ? "Solo" : `${numPeople} người`);
  }
  if (tripTitle) parts.push(tripTitle);
  return parts.join(" · ");
}
