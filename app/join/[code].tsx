import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import type { Itinerary } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";
import { queryKeys } from "@/hooks/queries/keys";
import { setPendingRedirect } from "@/app/_layout";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

export default function JoinTripScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user, isLoading } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"loading" | "found" | "invalid" | "joined" | "already" | "error">("loading");
  const [sharedTrip, setSharedTrip] = useState<Itinerary | null>(null);
  const [joinError, setJoinError] = useState("");

  const txt = t().itinerary;

  // Look up the trip server-side using the share code.
  useEffect(() => {
    if (status === "joined" || status === "error") return;

    if (isLoading) {
      setStatus("loading");
      return;
    }
    if (!code) {
      setStatus("invalid");
      return;
    }
    if (!user) {
      setPendingRedirect(`/join/${code}`);
      router.replace({ pathname: "/(auth)/login", params: { redirect: `/join/${code}` } });
      return;
    }

    (async () => {
      try {
        const res = await apiRequest("GET", `/api/share/${code}`);
        const trip = await unwrap<any>(res);
        setSharedTrip(trip);
        if (String(trip.userId) === String(user.id)) {
          setStatus("already");
        } else if ((trip.companions || []).some((c: any) => String(c.userId) === String(user.id))) {
          setStatus("already");
        } else {
          setStatus("found");
        }
      } catch {
        setStatus("invalid");
      }
    })();
  }, [code, user, isLoading, status]);

  const handleJoin = async () => {
    if (!sharedTrip || !user || status !== "found") return;
    setStatus("loading");

    try {
      const role = sharedTrip.sharePermission || "viewer";
      const res = await apiRequest("POST", "/api/share/join", {
        shareCode: code,
        userId: user.id,
        role,
      });
      const joinData = await unwrap<any>(res);

      if (joinData.alreadyJoined) {
        setStatus("already");
        return;
      }

      await qc.invalidateQueries({ queryKey: queryKeys.trips() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus("joined");
    } catch (err: any) {
      console.error("Join trip error:", err);
      setJoinError(err?.message || "Không thể tham gia chuyến đi. Vui lòng thử lại.");
      setStatus("error");
    }
  };

  const itinerary = sharedTrip;
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

        {status === "error" && (
          <View style={styles.centerContent}>
            <Ionicons name="close-circle-outline" size={64} color={colors.error} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>Lỗi tham gia</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center" }}>
              {joinError}
            </Text>
            <Pressable
              onPress={() => { setStatus("found"); setJoinError(""); }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.actionBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        )}

        {status === "already" && (
          <View style={styles.centerContent}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{txt.alreadyJoined}</Text>
            <Pressable
              onPress={() => {
                if (itinerary?.id) router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
                else router.replace("/(tabs)/trips");
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.actionBtnText}>{"Xem"}</Text>
            </Pressable>
          </View>
        )}

        {status === "found" && itinerary && (
          <View style={styles.centerContent}>
            {itinerary.status === "completed" ? (
              <>
                <Ionicons name="lock-closed-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.statusTitle, { color: colors.text }]}>Chuyến đi đã hoàn thành</Text>
                <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.textSecondary, textAlign: "center" }}>
                  Không thể tham gia chuyến đi đã kết thúc.
                </Text>
                <Pressable
                  onPress={() => router.replace("/(tabs)/trips")}
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.actionBtnText}>{t().common.back}</Text>
                </Pressable>
              </>
            ) : (
              <>
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
              </>
            )}
          </View>
        )}

        {status === "joined" && (
          <View style={styles.centerContent}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{txt.joinSuccess}</Text>
            <Pressable
              onPress={() => {
                if (itinerary?.id) router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
                else router.replace("/(tabs)/trips");
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.actionBtnText}>{"Xem chuyến đi"}</Text>
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
