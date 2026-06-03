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

  const defaultTime = travel.defaultMode === "walking" ? travel.walkingMinutes : travel.drivingMinutes;
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
          {defaultTime} {txt.travelMinutes} {txt.toDestination} {to.title.length > 20 ? to.title.substring(0, 20) + "..." : to.title} • {travel.distanceKm} {txt.travelKm}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={12} color={c.textTertiary} />
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
  container: { alignItems: "center", paddingVertical: 2 },
  lineWrapper: { position: "absolute", top: 0, bottom: 0, left: 20, width: 2, alignItems: "center" },
  line: { width: 2, height: "100%", borderRadius: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginLeft: 12,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium", flexShrink: 1 },
  modeList: {
    marginTop: 6,
    marginLeft: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    alignSelf: "stretch",
  },
  modeTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  modeValue: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
