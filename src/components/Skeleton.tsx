import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";

/**
 * Skeleton placeholder with a pulsing opacity animation. Use to fill space
 * while data loads instead of a centered spinner — matches the IG/Threads/
 * Wanderlog loading pattern (perceived speed: page feels populated even
 * before the data arrives).
 */
export function Skeleton({
  width,
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: (width as any) ?? "100%",
          height,
          borderRadius: radius,
          backgroundColor: colors.inputBg,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonRow({ count = 3, gap = 12 }: { count?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} />
      ))}
    </View>
  );
}

/**
 * Card-shaped skeleton used in trip / blog / forum list screens. Mimics the
 * shape of a real card (cover, title line, meta line) so the skeleton ≈ the
 * final layout — minimizes layout shift when data arrives.
 */
export function SkeletonCard({ height = 132 }: { height?: number }) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <Skeleton height={height} radius={12} />
      <View style={{ gap: 8, marginTop: 12 }}>
        <Skeleton height={16} width="70%" />
        <Skeleton height={12} width="50%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
