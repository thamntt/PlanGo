import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  RefreshControl,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearNotifications,
} from "@/hooks/queries/use-notifications";
import { t } from "@/lib/i18n";
import type { Notification } from "@/types";

type FilterKey = "all" | "unread" | "trip" | "expense" | "system";
type NotifKind =
  | "expense_added"
  | "expense_settled"
  | "expense_reminder"
  | "member_joined"
  | "member_left"
  | "role_changed"
  | "trip_started"
  | "trip_completed"
  | "activity_completed"
  | "review_posted"
  | "ai_generated"
  | "weather"
  | "budget_warning"
  | "info";

const KIND_CONFIG: Record<
  NotifKind,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  expense_added: { icon: "wallet", color: "#EC4899", bg: "#FCE7F3" },
  expense_settled: { icon: "checkmark-done-circle", color: "#10B981", bg: "#D1FAE5" },
  expense_reminder: { icon: "alarm", color: "#F59E0B", bg: "#FEF3C7" },
  member_joined: { icon: "person-add", color: "#10B981", bg: "#D1FAE5" },
  member_left: { icon: "person-remove", color: "#6B7280", bg: "#E5E7EB" },
  role_changed: { icon: "shield-checkmark", color: "#6366F1", bg: "#E0E7FF" },
  trip_started: { icon: "rocket", color: "#0EA5E9", bg: "#E0F2FE" },
  trip_completed: { icon: "trophy", color: "#F59E0B", bg: "#FEF3C7" },
  activity_completed: { icon: "checkmark-circle", color: "#10B981", bg: "#D1FAE5" },
  review_posted: { icon: "star", color: "#F59E0B", bg: "#FEF3C7" },
  ai_generated: { icon: "sparkles", color: "#A855F7", bg: "#F3E8FF" },
  weather: { icon: "rainy", color: "#0EA5E9", bg: "#E0F2FE" },
  budget_warning: { icon: "warning", color: "#EF4444", bg: "#FEE2E2" },
  info: { icon: "information-circle", color: "#3B82F6", bg: "#DBEAFE" },
};

/**
 * Server still sends generic type ("info"/"warning"/"success") for most
 * notifications, so we derive the specific kind from title/message keywords.
 * Keep this synced with notification trigger sites server-side as we add new
 * event types (#137 — notifications expansion).
 */
function deriveKind(n: Notification): NotifKind {
  const text = `${n.title || ""} ${n.message || ""}`.toLowerCase();
  if (/quyết toán|đã trả|đã thanh toán/.test(text)) return "expense_settled";
  if (/nhắc|còn nợ|chưa trả/.test(text)) return "expense_reminder";
  if (/chi phí|đã thêm|đã chi/.test(text)) return "expense_added";
  if (/tham gia|đã vào|đã join/.test(text)) return "member_joined";
  if (/rời|đã rời|left/.test(text)) return "member_left";
  if (/vai trò|role/.test(text)) return "role_changed";
  if (/bắt đầu chuyến/.test(text)) return "trip_started";
  if (/hoàn thành chuyến|kết thúc chuyến/.test(text)) return "trip_completed";
  if (/đánh dấu xong|hoàn thành "/.test(text)) return "activity_completed";
  if (/đánh giá|review/.test(text)) return "review_posted";
  if (/ai|tạo lịch trình|đã sẵn sàng/.test(text)) return "ai_generated";
  if (/thời tiết|mưa|nắng/.test(text)) return "weather";
  if (n.type === "warning" || /vượt ngân sách|sắp hết/.test(text)) return "budget_warning";
  return "info";
}

const AVATAR_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

function hashColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;
  if (diffDay === 1) return "Hôm qua";
  if (diffDay < 7) {
    const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
    return `${dow}`;
  }
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}`;
}

function categoryGroup(n: Notification): FilterKey {
  const kind = deriveKind(n);
  switch (kind) {
    case "expense_added":
    case "expense_settled":
    case "expense_reminder":
    case "budget_warning":
      return "expense";
    case "member_joined":
    case "member_left":
    case "role_changed":
    case "trip_started":
    case "trip_completed":
    case "activity_completed":
    case "review_posted":
      return "trip";
    case "ai_generated":
    case "weather":
    case "info":
    default:
      return n.itineraryId ? "trip" : "system";
  }
}

function dayBucket(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (isSameDay(d, today)) return { key: "today", label: "HÔM NAY" };
  if (isSameDay(d, yesterday)) return { key: "yesterday", label: "HÔM QUA" };
  const diffDay = Math.floor(
    (today.getTime() - d.getTime()) / 86400000,
  );
  if (diffDay < 7) return { key: "week", label: "TUẦN NÀY" };
  if (diffDay < 30) return { key: "month", label: "THÁNG NÀY" };
  return { key: "older", label: "TRƯỚC ĐÓ" };
}

function NotificationRow({
  item,
  colors,
  onPress,
}: {
  item: Notification;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
}) {
  const kind = deriveKind(item);
  const actorName = (item as any).actorName as string | undefined;
  const isPersonEvent =
    !!actorName &&
    [
      "member_joined",
      "member_left",
      "role_changed",
      "activity_completed",
      "review_posted",
      "expense_added",
    ].includes(kind);
  const cfg = KIND_CONFIG[kind];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.background,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {!item.isRead && (
        <View style={[styles.unreadStripe, { backgroundColor: colors.primary }]} />
      )}
      <View style={styles.rowInner}>
        {isPersonEvent && actorName ? (
          <View
            style={[
              styles.avatar,
              { backgroundColor: hashColor(actorName) },
            ]}
          >
            <Text style={styles.avatarText}>
              {actorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
          </View>
        )}
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontFamily: item.isRead ? "Inter_500Medium" : "Inter_700Bold",
              },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {!!item.message && (
            <Text
              style={[styles.message, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.message}
            </Text>
          )}
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {relativeTime(item.createdAt)}
          </Text>
        </View>
        {!item.isRead && (
          <View
            style={[styles.unreadDot, { backgroundColor: colors.primary }]}
          />
        )}
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const notificationsQuery = useNotifications(user?.id);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearAll = useClearNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const txt = t();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await notificationsQuery.refetch();
    setRefreshing(false);
  }, [notificationsQuery]);

  const all = useMemo(() => {
    const items = notificationsQuery.data ?? [];
    return [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [notificationsQuery.data]);

  const unreadCount = all.filter((n) => !n.isRead).length;

  const filtered = useMemo(() => {
    if (filter === "all") return all;
    if (filter === "unread") return all.filter((n) => !n.isRead);
    return all.filter((n) => categoryGroup(n) === filter);
  }, [all, filter]);

  const grouped = useMemo(() => {
    const out: Array<{ type: "header"; label: string } | { type: "row"; item: Notification }> = [];
    let lastKey = "";
    for (const item of filtered) {
      const bk = dayBucket(item.createdAt);
      if (bk.key !== lastKey) {
        out.push({ type: "header", label: bk.label });
        lastKey = bk.key;
      }
      out.push({ type: "row", item });
    }
    return out;
  }, [filtered]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const filterChips: Array<{ key: FilterKey; label: string; count?: number }> = [
    { key: "all", label: "Tất cả", count: all.length },
    { key: "unread", label: "Chưa đọc", count: unreadCount },
    {
      key: "trip",
      label: "Chuyến đi",
      count: all.filter((n) => categoryGroup(n) === "trip").length,
    },
    {
      key: "expense",
      label: "Chi phí",
      count: all.filter((n) => categoryGroup(n) === "expense").length,
    },
    {
      key: "system",
      label: "Hệ thống",
      count: all.filter((n) => categoryGroup(n) === "system").length,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          hitSlop={6}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Thông báo
          {unreadCount > 0 ? ` (${unreadCount})` : ""}
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (user) markAllRead.mutate({ userId: user.id });
              }}
              hitSlop={8}
            >
              <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {filterChips.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(f.key);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.text : colors.inputBg,
                  borderColor: active ? colors.text : colors.cardBorder,
                  opacity: !active && pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? colors.background : colors.text },
                ]}
              >
                {f.label}
              </Text>
              {f.count !== undefined && f.count > 0 && (
                <Text
                  style={[
                    styles.chipCount,
                    {
                      color: active ? colors.background : colors.textSecondary,
                      opacity: 0.85,
                    },
                  ]}
                >
                  · {f.count}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={grouped}
        keyExtractor={(g, i) =>
          g.type === "header" ? `h-${g.label}-${i}` : `r-${g.item.id}`
        }
        renderItem={({ item: g }) => {
          if (g.type === "header") {
            return (
              <View style={styles.dayHeaderWrap}>
                <Text
                  style={[styles.dayHeader, { color: colors.textTertiary }]}
                >
                  {g.label}
                </Text>
                <View
                  style={[styles.dayHeaderLine, { backgroundColor: colors.cardBorder }]}
                />
              </View>
            );
          }
          return (
            <NotificationRow
              item={g.item}
              colors={colors}
              onPress={() => {
                if (!g.item.isRead) markRead.mutate(g.item.id);
                if (!g.item.itineraryId) return;
                // Deep-link to the right tab inside the trip based on kind.
                const kind = deriveKind(g.item);
                let initialTab: string | undefined;
                if (
                  kind === "expense_added" ||
                  kind === "expense_settled" ||
                  kind === "expense_reminder" ||
                  kind === "budget_warning"
                ) {
                  initialTab = "expenses";
                } else if (
                  kind === "member_joined" ||
                  kind === "member_left" ||
                  kind === "role_changed"
                ) {
                  initialTab = "companions";
                }
                router.push({
                  pathname: "/itinerary/[id]",
                  params: {
                    id: g.item.itineraryId,
                    ...(initialTab ? { initialTab } : {}),
                  },
                });
              }}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={colors.textTertiary}
            />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {filter === "all"
                ? txt.notifications.empty
                : "Không có thông báo nào trong mục này"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {txt.notifications.emptyHint}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  headerActions: { flexDirection: "row", gap: 16 },
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 16 },
  chipCount: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    lineHeight: 16,
    marginLeft: 4,
  },
  listContent: { paddingBottom: 100 },
  row: {
    position: "relative",
    paddingHorizontal: 20,
  },
  rowInner: {
    flexDirection: "row",
    paddingVertical: 14,
    gap: 12,
    alignItems: "flex-start",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  unreadStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  content: { flex: 1, gap: 3, minWidth: 0 },
  title: { fontSize: 14, letterSpacing: -0.1 },
  message: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  time: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  dayHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  dayHeader: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  dayHeaderLine: { flex: 1, height: StyleSheet.hairlineWidth },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
});
