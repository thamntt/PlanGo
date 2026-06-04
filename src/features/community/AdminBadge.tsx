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
      <MaterialCommunityIcons name="shield-check" size={dim} color="#fff" />
      {showLabel && <Text style={[styles.text, { fontSize }]}>PlanGo</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0891B2",
    borderRadius: 6,
  },
  text: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
