import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useDestinations, usePois } from "@/hooks/queries";
import { formatVND } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { Itinerary } from "@/types";
import { apiRequest } from "@/lib/api/query-client";
import { queryKeys } from "@/hooks/queries/keys";
import { setPendingRedirect } from "../_layout";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "status" in json) return json.data as T;
  return json as T;
}

type Status = "loading" | "found" | "invalid" | "joined" | "already" | "error";

export default function JoinTripScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user, isLoading } = useAuth();
  const qc = useQueryClient();
  const { data: destinations = [] } = useDestinations();
  const { data: pois = [] } = usePois();
  const [status, setStatus] = useState<Status>("loading");
  const [coverIdx, setCoverIdx] = useState(0);
  const [sharedTrip, setSharedTrip] = useState<Itinerary | null>(null);
  const [joinError, setJoinError] = useState("");
  // Guard against double-fire of the lookup effect AND double-tap of Join.
  const lookupRanRef = useRef<string | null>(null);
  const joinInFlightRef = useRef(false);

  const txt = t().itinerary;

  // Look up the trip server-side using the share code.
  // CRITICAL: do NOT depend on `status` here — that creates a loop where the
  // user taps Join → status flips to "loading" → effect re-runs → re-fetches
  // → setStatus("found") → button reappears → user thinks first tap was lost
  // and taps again. Lock the lookup by code+userId via the ref.
  useEffect(() => {
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
    const lockKey = `${code}|${user.id}`;
    if (lookupRanRef.current === lockKey) return;
    lookupRanRef.current = lockKey;

    (async () => {
      try {
        const res = await apiRequest("GET", `/api/share/${code}`);
        const trip = await unwrap<any>(res);
        setSharedTrip(trip);
        if (String(trip.userId) === String(user.id)) {
          setStatus("already");
        } else if (
          (trip.companions || []).some((c: any) => String(c.userId) === String(user.id))
        ) {
          setStatus("already");
        } else {
          setStatus("found");
        }
      } catch {
        setStatus("invalid");
      }
    })();
  }, [code, user, isLoading]);

  const handleJoin = async () => {
    if (!sharedTrip || !user) return;
    if (joinInFlightRef.current) return; // hard guard against double-tap
    if (status !== "found") return;
    joinInFlightRef.current = true;
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

      // Invalidate ALL trip-scoped caches AND wait for the refetch so when
      // the joiner taps "Xem chuyến đi" the detail screen already has data
      // and doesn't spin on an empty list cache for 10+s.
      await Promise.all([
        qc.refetchQueries({ queryKey: queryKeys.trips() }),
        qc.refetchQueries({ queryKey: ["trips", "list"] }),
        qc.refetchQueries({ queryKey: queryKeys.tripDetail(sharedTrip.id) }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus("joined");
    } catch (err: any) {
      console.error("Join trip error:", err);
      setJoinError(err?.message || "Không thể tham gia chuyến đi. Vui lòng thử lại.");
      setStatus("error");
    } finally {
      joinInFlightRef.current = false;
    }
  };

  const itinerary = sharedTrip;
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // Cover carousel — collect 3 images per linked destination, matching the
  // trip-detail hero behavior so the join page feels continuous with the trip.
  const coverImages = (() => {
    if (!itinerary) return [] as string[];
    const out: string[] = [];
    const seen = new Set<string>();
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]/g, "");
    const push = (url?: string | null) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push(url);
    };
    const tripDestNames = (itinerary.destination || "")
      .split(/[,→\->|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of tripDestNames) {
      const match = destinations.find((d) => norm(d.name) === norm(name));
      if (match?.images?.length) match.images.slice(0, 3).forEach(push);
    }
    if (out.length === 0) {
      for (const day of itinerary.days || []) {
        for (const act of day.activities || []) {
          if ((act as any).thumbnail) push((act as any).thumbnail);
          if (act.poiId) {
            const poi = pois.find((p) => p.id === act.poiId);
            poi?.images?.slice(0, 3).forEach(push);
          }
          if (out.length >= 6) break;
        }
        if (out.length >= 6) break;
      }
    }
    return out;
  })();
  const coverImage =
    coverImages.length > 0 ? coverImages[coverIdx % coverImages.length] : null;

  useEffect(() => {
    if (coverImages.length < 2) {
      setCoverIdx(0);
      return;
    }
    setCoverIdx(0);
    const id = setInterval(() => {
      setCoverIdx((i) => (i + 1) % coverImages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [coverImages.length]);

  const gradientFallback: [string, string] = ["#3B82F6", "#8B5CF6"];

  // ─────────────────────── Layouts ───────────────────────
  const renderEmptyState = (
    icon: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    title: string,
    subtitle: string | null,
    primaryLabel: string,
    onPrimary: () => void,
  ) => (
    <View style={styles.centerWrap}>
      <View style={[styles.emptyIconWrap, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon} size={48} color={iconColor} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      <Pressable
        onPress={onPrimary}
        style={({ pressed }) => [
          styles.primaryCta,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.primaryCtaText}>{primaryLabel}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {(status === "loading" || (status === "found" && !itinerary)) && (
        <View style={[styles.centerWrap, { paddingTop: insets.top + 100 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Đang tải lời mời…
          </Text>
        </View>
      )}

      {status === "invalid" &&
        renderEmptyState(
          "alert-circle",
          colors.error,
          "Liên kết không hợp lệ",
          "Liên kết mời này đã hết hạn hoặc không tồn tại. Hãy yêu cầu người mời tạo liên kết mới.",
          "Về trang chính",
          () => router.replace("/(tabs)/trips"),
        )}

      {status === "error" &&
        renderEmptyState(
          "close-circle",
          colors.error,
          "Không thể tham gia",
          joinError,
          "Thử lại",
          () => {
            setStatus("found");
            setJoinError("");
          },
        )}

      {status === "already" && itinerary && (
        <View style={styles.centerWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.success + "18" }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Bạn đã tham gia chuyến đi này
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            "{itinerary.title}"
          </Text>
          <Pressable
            onPress={() => {
              if (itinerary?.id)
                router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
              else router.replace("/(tabs)/trips");
            }}
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryCtaText}>Mở chuyến đi</Text>
          </Pressable>
        </View>
      )}

      {status === "joined" && itinerary && (
        <View style={styles.centerWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.success + "18" }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Tham gia thành công!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Chào mừng bạn đến với "{itinerary.title}"
          </Text>
          <Pressable
            onPress={() => {
              if (itinerary?.id)
                router.replace({ pathname: "/itinerary/[id]", params: { id: itinerary.id } });
              else router.replace("/(tabs)/trips");
            }}
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.primaryCtaText}>Xem chuyến đi</Text>
          </Pressable>
        </View>
      )}

      {status === "found" && itinerary && (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              {coverImage ? (
                <Image
                  source={{ uri: coverImage }}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={350}
                />
              ) : (
                <LinearGradient
                  colors={gradientFallback}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroImage}
                >
                  <Ionicons name="airplane" size={72} color="rgba(255,255,255,0.3)" />
                </LinearGradient>
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              {coverImages.length > 1 && (
                <View style={styles.heroDots}>
                  {coverImages.map((_, i) => (
                    <Pressable key={i} onPress={() => setCoverIdx(i)} hitSlop={6}>
                      <View
                        style={[
                          styles.heroDot,
                          i === coverIdx && styles.heroDotActive,
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                onPress={() => router.replace("/(tabs)/trips")}
                style={({ pressed }) => [
                  styles.heroBackBtn,
                  { top: insets.top + webTopInset + 8, opacity: pressed ? 0.85 : 1 },
                ]}
                hitSlop={6}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </Pressable>
              <View style={styles.heroFooter}>
                <View style={styles.heroInviteBadge}>
                  <Ionicons name="mail-open" size={11} color="#fff" />
                  <Text style={styles.heroInviteBadgeText}>BẠN ĐƯỢC MỜI</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {itinerary.title}
                </Text>
                <View style={styles.heroMetaRow}>
                  <Ionicons name="location" size={13} color="rgba(255,255,255,0.92)" />
                  <Text style={styles.heroMetaText} numberOfLines={1}>
                    {itinerary.destination}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoBlock, { gap: 4 }]}>
              <View style={[styles.infoRow, { borderTopColor: colors.cardBorder }]}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>NGÀY ĐI</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {itinerary.startDate} → {itinerary.endDate}
                  </Text>
                </View>
              </View>
              <View style={[styles.infoRow, { borderTopColor: colors.cardBorder }]}>
                <Ionicons name="people" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>SỐ NGƯỜI</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {itinerary.numPeople} người
                  </Text>
                </View>
              </View>
              <View style={[styles.infoRow, { borderTopColor: colors.cardBorder }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>QUYỀN HẠN</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {itinerary.sharePermission === "editor"
                      ? "Có thể chỉnh sửa lịch trình"
                      : "Chỉ xem lịch trình"}
                  </Text>
                </View>
              </View>
              {itinerary.totalBudget > 0 && (
                <View style={[styles.infoRow, { borderTopColor: colors.cardBorder }]}>
                  <Ionicons name="wallet" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                      NGÂN SÁCH DỰ KIẾN
                    </Text>
                    <Text
                      style={[styles.infoValue, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {formatVND(itinerary.totalBudget)}
                    </Text>
                  </View>
                </View>
              )}
              {itinerary.ownerName && (() => {
                // Pull the real avatar from the companions list (owner is
                // included with avatarUrl set by the server mapper). Fall
                // back to a hashed-color initial when missing.
                const ownerCompanion = (itinerary.companions || []).find(
                  (c: any) =>
                    c.isOwner || String(c.userId) === String(itinerary.userId),
                );
                const ownerAvatarUrl = (ownerCompanion as any)?.avatarUrl as
                  | string
                  | null
                  | undefined;
                const palette = [
                  "#4F46E5",
                  "#0EA5E9",
                  "#10B981",
                  "#F59E0B",
                  "#EF4444",
                  "#8B5CF6",
                  "#EC4899",
                ];
                let hash = 0;
                for (let i = 0; i < itinerary.ownerName.length; i++) {
                  hash =
                    ((hash << 5) - hash + itinerary.ownerName.charCodeAt(i)) | 0;
                }
                const fallbackBg = palette[Math.abs(hash) % palette.length];
                return (
                  <View
                    style={[styles.infoRow, { borderTopColor: colors.cardBorder }]}
                  >
                    {ownerAvatarUrl ? (
                      <Image
                        source={{ uri: ownerAvatarUrl }}
                        style={styles.ownerAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[styles.ownerAvatar, { backgroundColor: fallbackBg }]}
                      >
                        <Text style={styles.ownerAvatarText}>
                          {itinerary.ownerName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                        NGƯỜI MỜI
                      </Text>
                      <Text
                        style={[styles.infoValue, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {itinerary.ownerName}
                      </Text>
                    </View>
                  </View>
                );
              })()}
              {itinerary.status === "completed" && (
                <View
                  style={[
                    styles.warnBox,
                    {
                      backgroundColor: colors.warning + "18",
                      borderColor: colors.warning + "40",
                    },
                  ]}
                >
                  <Ionicons name="alert" size={16} color={colors.warning} />
                  <Text style={[styles.warnText, { color: colors.text }]}>
                    Chuyến đi này đã kết thúc — bạn không thể tham gia.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.cardBorder,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            {itinerary.status === "completed" ? (
              <Pressable
                onPress={() => router.replace("/(tabs)/trips")}
                style={({ pressed }) => [
                  styles.primaryCta,
                  { backgroundColor: colors.textSecondary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.primaryCtaText}>Đóng</Text>
              </Pressable>
            ) : (
              <View style={styles.bottomBarRow}>
                <Pressable
                  onPress={() => router.replace("/(tabs)/trips")}
                  style={({ pressed }) => [
                    styles.declineBtn,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.cardBorder,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.declineBtnText, { color: colors.textSecondary }]}>
                    Từ chối
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleJoin}
                  disabled={joinInFlightRef.current}
                  style={({ pressed }) => [
                    styles.primaryCta,
                    {
                      flex: 1,
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.primaryCtaText}>Tham gia chuyến đi</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 21,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 8 },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: "100%",
    marginTop: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryCtaText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  hero: {
    height: 260,
    backgroundColor: "#E5E7EB",
    position: "relative",
    justifyContent: "flex-end",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBackBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  heroFooter: { padding: 20, gap: 8 },
  heroInviteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignSelf: "flex-start",
  },
  heroInviteBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetaText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  infoBlock: { paddingHorizontal: 20, paddingTop: 4 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  infoValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  warnBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  warnText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomBarRow: { flexDirection: "row", gap: 10 },
  declineBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  heroDots: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  heroDotActive: { width: 22, backgroundColor: "#fff" },
  ownerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerAvatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
