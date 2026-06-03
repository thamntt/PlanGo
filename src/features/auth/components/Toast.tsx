import React, { useEffect } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";

export type ToastVariant = "info" | "success" | "error" | "warning";

interface Props {
  message: string;
  variant?: ToastVariant;
  onClose: () => void;
  duration?: number;
}

const VARIANT_ICON: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  info: "information-circle",
  success: "checkmark-circle",
  error: "alert-circle",
  warning: "warning",
};

/**
 * Slide-down toast for transient messages (validation errors, network status).
 * Auto-dismisses after `duration`ms. Replaces `Alert.alert` for non-blocking UX.
 */
export function Toast({ message, variant = "info", onClose, duration = 3000 }: Props) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const translateY = React.useRef(new Animated.Value(-80)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  const tint =
    variant === "success"
      ? colors.success
      : variant === "error"
        ? colors.error
        : variant === "warning"
          ? colors.warning
          : colors.primary;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onClose());
    }, duration);

    return () => clearTimeout(timer);
  }, [translateY, opacity, duration, onClose]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: colors.card,
          borderColor: tint + "60",
        },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: tint + "20" }]}>
        <Ionicons name={VARIANT_ICON[variant]} size={18} color={tint} />
      </View>
      <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 9999,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
