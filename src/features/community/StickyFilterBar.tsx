import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";

interface Props {
  scrollY: Animated.Value;
  showAt: number; // px scroll threshold to start showing
  children: React.ReactNode;
}

/**
 * Floating sticky header that appears (slides down from top) when user scrolls
 * past `showAt` px. Used over FlatList where stickyHeaderIndices doesn't work
 * cleanly across multiple ListHeaderComponent children.
 */
export function StickyFilterBar({ scrollY, showAt, children }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const sub = scrollY.addListener(({ value }) => {
      setIsVisible(value > showAt);
    });
    return () => scrollY.removeListener(sub);
  }, [scrollY, showAt]);

  const opacity = scrollY.interpolate({
    inputRange: [showAt - 40, showAt],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const translateY = scrollY.interpolate({
    inputRange: [showAt - 40, showAt],
    outputRange: [-40, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      pointerEvents={isVisible ? "auto" : "none"}
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
          borderBottomColor: colors.divider,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
