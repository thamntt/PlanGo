import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ItineraryActivity } from "@/types";
import { t } from "@/lib/i18n";
import { getTravelInfo } from "../lib/utils";

interface Props {
  from: ItineraryActivity;
  to: ItineraryActivity;
  colors: any;
}

export function TravelConnector({ from, to, colors: c }: Props) {
  const [expanded, setExpanded] = useState(false);
  const travel = getTravelInfo(from, to);
  const txt = t().itinerary;
  if (!travel) return null;

  const defaultTime =
    travel.defaultMode === "walking" ? travel.walkingMinutes : travel.drivingMinutes;
  const defaultIcon = travel.defaultMode === "walking" ? "walk-outline" : "car-outline";

  return (
    <View style={styles.container}>
      <View style={styles.lineWrapper}>
        <View style={[styles.line, { backgroundColor: c.textTertiary + "40" }]} />
      </View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={[styles.badge, { backgroundColor: c.inputBg, borderColor: c.cardBorder }]}
      >
        <Ionicons name={defaultIcon as any} size={14} color={c.textSecondary} />
        <Text style={[styles.badgeText, { color: c.textSecondary }]}>
          {defaultTime} {txt.travelMinutes} {txt.toDestination}{" "}
          {to.title.length > 20 ? to.title.substring(0, 20) + "..." : to.title} •{" "}
          {travel.distanceKm} {txt.travelKm}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={12}
          color={c.textTertiary}
        />
      </Pressable>
      {expanded && (
        <View style={[styles.modeList, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.modeTitle, { color: c.text }]}>{txt.travelMode}</Text>
          <View style={styles.modeRow}>
            <Ionicons name="car-outline" size={16} color={c.textSecondary} />
            <Text style={[styles.modeLabel, { color: c.text }]}>{txt.driving}</Text>
            <Text style={[styles.modeValue, { color: c.textSecondary }]}>
              {travel.drivingMinutes} {txt.travelMinutes} • {travel.distanceKm} {txt.travelKm}
            </Text>
          </View>
          <View style={styles.modeRow}>
            <Ionicons name="bicycle-outline" size={16} color={c.textSecondary} />
            <Text style={[styles.modeLabel, { color: c.text }]}>{txt.motorbike}</Text>
            <Text style={[styles.modeValue, { color: c.textSecondary }]}>
              {travel.motorbikeMinutes} {txt.travelMinutes} • {travel.distanceKm} {txt.travelKm}
            </Text>
          </View>
          <View style={styles.modeRow}>
            <Ionicons name="walk-outline" size={16} color={c.textSecondary} />
            <Text style={[styles.modeLabel, { color: c.text }]}>{txt.walking}</Text>
            <Text style={[styles.modeValue, { color: c.textSecondary }]}>
              {travel.walkingMinutes} {txt.travelMinutes} • {travel.distanceKm} {txt.travelKm}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingLeft: 12 },
  lineWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 27,
    width: 1,
  },
  line: { flex: 1, width: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 0,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginLeft: 32,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  modeList: {
    marginTop: 4,
    marginLeft: 32,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 6,
    alignSelf: "stretch",
  },
  modeTitle: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 2 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeLabel: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  modeValue: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
