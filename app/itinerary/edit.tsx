import React from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

export default function EditItineraryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="construct-outline" size={48} color={colors.textTertiary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        Edit itinerary from the detail screen
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  text: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
});
