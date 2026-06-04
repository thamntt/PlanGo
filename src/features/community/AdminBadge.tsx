import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Props {
  role?: string | null;
  size?: "tiny" | "small" | "medium";
  showLabel?: boolean;
}

/**
 * Small visual badge to mark official PlanGo team / admin accounts.
 * Reddit/Discord/Stack Overflow pattern — instantly recognizable so users
 * can trust admin posts + can't impersonate.
 */
export function AdminBadge({ role, size = "small", showLabel = true }: Props) {
  if (role !== "admin") return null;
  const dim = size === "tiny" ? 10 : size === "small" ? 11 : 13;
  const fontSize = size === "tiny" ? 8 : size === "small" ? 9 : 10;
  const padH = size === "tiny" ? 4 : 6;
  const padV = size === "tiny" ? 1 : 2;

  return (
    <View
      style={[
        styles.badge,
        { paddingHorizontal: padH, paddingVertical: padV, gap: showLabel ? 3 : 0 },
      ]}
    >
      <MaterialCommunityIcons name="shield-crown" size={dim} color={ADMIN_FG} />
      {showLabel && <Text style={[styles.text, { fontSize }]}>PlanGo</Text>}
    </View>
  );
}

// Match the amber theme used on profile screen's admin badge
const ADMIN_BG = "rgba(251, 191, 36, 0.18)"; // #FBBF24 @ 18% opacity
const ADMIN_FG = "#D97706";

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ADMIN_BG,
    borderRadius: 6,
  },
  text: {
    color: ADMIN_FG,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
