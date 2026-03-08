import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { formatVND } from "@/lib/storage";
import { t } from "@/lib/i18n";

export default function JoinTripScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { itineraries, updateItinerary } = useData();
  const [status, setStatus] = useState<"loading" | "found" | "invalid" | "joined" | "already">("loading");

  const itinerary = itineraries.find((i) => i.shareCode === code);
  const txt = t().itinerary;

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }
    if (!itinerary) {
      setStatus("invalid");
      return;
    }
    if (!user) {
      setStatus("invalid");
      return;
    }
    if (itinerary.userId === user.id) {
      setStatus("already");
      return;
    }
    const companions = itinerary.companions || [];
    if (companions.some((c) => c.userId === user.id)) {
      setStatus("already");
      return;
    }
    setStatus("found");
  }, [code, itinerary, user]);

  const handleJoin = async () => {
    if (!itinerary || !user || status !== "found") return;
    setStatus("loading");
    const existing = itinerary.companions || [];
    if (existing.some((c) => c.userId === user.id)) {
      setStatus("already");
      return;
    }
    const role = itinerary.sharePermission || "viewer";
    const updated = [...existing, {
      userId: user.id,
      userName: user.fullName,
      role,
      joinedAt: new Date().toISOString(),
    }];
    await updateItinerary(itinerary.id, { companions: updated });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStatus("joined");
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.replace("/(tabs)/trips")}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{txt.joinTrip}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {status === "loading" && (
          <ActivityIndicator size="large" color={colors.primary} />
        )}

        {status === "invalid" && (
          <View style={styles.centerContent}>
            <Ionicons name="warning-outline" size={64} color={colors.error} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{txt.invalidCode}</Text>
            <Pressable
              onPress={() => router.replace("/(tabs)/trips")}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.actionBtnText}>{t().common.back}</Text>
            </Pressable>
          </View>
        )}

        {status === "already" && (
          <View style={styles.centerContent}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{txt.alreadyJoined}</Text>
            <Pressable
              onPress={() => {
                if (itinerary) router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
                else router.replace("/(tabs)/trips");
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.actionBtnText}>{t().common.view || "Xem"}</Text>
            </Pressable>
          </View>
        )}

        {status === "found" && itinerary && (
          <View style={styles.centerContent}>
            <Ionicons name="airplane-outline" size={64} color={colors.primary} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{txt.joinTrip}</Text>
            <View style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.tripTitle, { color: colors.text }]}>{itinerary.title}</Text>
              <View style={styles.tripInfo}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.tripInfoText, { color: colors.textSecondary }]}>{itinerary.destination}</Text>
              </View>
              <View style={styles.tripInfo}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.tripInfoText, { color: colors.textSecondary }]}>{itinerary.startDate} - {itinerary.endDate}</Text>
              </View>
              <View style={styles.tripInfo}>
                <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.tripInfoText, { color: colors.textSecondary }]}>{itinerary.numPeople} người</Text>
              </View>
              <View style={styles.tripInfo}>
                <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.tripInfoText, { color: colors.textSecondary }]}>
                  {txt.sharePermission}: {itinerary.sharePermission === "editor" ? txt.canEdit : txt.viewOnly}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleJoin}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="enter-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{txt.joinTrip}</Text>
            </Pressable>
          </View>
        )}

        {status === "joined" && (
          <View style={styles.centerContent}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{txt.joinSuccess}</Text>
            <Pressable
              onPress={() => {
                if (itinerary) router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
                else router.replace("/(tabs)/trips");
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.actionBtnText}>{t().common.view || "Xem chuyến đi"}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  centerContent: { alignItems: "center", gap: 16, width: "100%", maxWidth: 360 },
  statusTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  tripCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  tripTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  tripInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  tripInfoText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
  },
  actionBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
