import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import type { Notification } from "@/lib/storage";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  info: { icon: "information-circle", color: "#3B82F6" },
  warning: { icon: "warning", color: "#F59E0B" },
  success: { icon: "checkmark-circle", color: "#10B981" },
};

function NotificationItem({ item, colors, onPress }: { item: Notification; colors: ReturnType<typeof useThemeColors>; onPress: () => void }) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifCard,
        {
          backgroundColor: item.isRead ? colors.card : (colors.primary + "10"),
          borderColor: item.isRead ? colors.cardBorder : colors.primary + "30",
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.notifIcon, { backgroundColor: config.color + "20" }]}>
        <Ionicons name={config.icon as any} size={22} color={config.color} />
      </View>
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.notifMessage, { color: colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>
        <Text style={[styles.notifTime, { color: colors.textTertiary }]}>
          {new Date(item.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useData();
  const txt = t();

  const myNotifications = useMemo(() => {
    if (!user) return [];
    return notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, user]);

  const unreadCount = myNotifications.filter((n) => !n.isRead).length;

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {txt.notifications.title}
          {unreadCount > 0 && ` (${unreadCount})`}
        </Text>
        <View style={styles.headerActions}>
          {myNotifications.length > 0 && (
            <>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  markAllNotificationsRead(user!.id);
                }}
                hitSlop={8}
              >
                <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  clearNotifications(user!.id);
                }}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <FlatList
        data={myNotifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            colors={colors}
            onPress={() => {
              if (!item.isRead) markNotificationRead(item.id);
              if (item.itineraryId) {
                router.push({ pathname: "/itinerary/[id]", params: { id: item.itineraryId } });
              }
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{txt.notifications.empty}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>{txt.notifications.emptyHint}</Text>
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
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_600SemiBold" },
  headerActions: { flexDirection: "row", gap: 16 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  notifCard: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notifContent: { flex: 1, gap: 3 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
