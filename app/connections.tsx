import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api/query-client";
import { useToggleFollow } from "@/hooks/queries/use-user-community";

interface ConnectionEdge {
  userId: number;
  userName: string;
  avatarUrl?: string | null;
  reviewerLevel?: string | null;
  followedAt: string;
  isFollowingByViewer: boolean;
  isSelf: boolean;
}

type SortMode = "default" | "newest" | "oldest";
type Tab = "followers" | "following";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

const LEVEL_LABEL: Record<string, { label: string; color: string }> = {
  newcomer: { label: "Người mới", color: "#94A3B8" },
  active: { label: "Tích cực", color: "#10B981" },
  top: { label: "Nổi bật", color: "#F59E0B" },
  legend: { label: "Huyền thoại", color: "#A855F7" },
};

export default function ConnectionsScreen() {
  const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const userId = params.userId ? Number(params.userId) : undefined;
  const initialTab = (params.tab === "following" ? "following" : "followers") as Tab;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user: me } = useAuth();
  const toggleFollow = useToggleFollow();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [sort, setSort] = useState<SortMode>("default");

  const followersQuery = useQuery<ConnectionEdge[]>({
    queryKey: ["connections", userId, "followers"],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest("GET", `/api/users/${userId}/followers`);
      return unwrap<ConnectionEdge[]>(res);
    },
    enabled: !!userId,
  });

  const followingQuery = useQuery<ConnectionEdge[]>({
    queryKey: ["connections", userId, "following"],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest("GET", `/api/users/${userId}/following`);
      return unwrap<ConnectionEdge[]>(res);
    },
    enabled: !!userId,
  });

  const activeQuery = tab === "followers" ? followersQuery : followingQuery;
  const rawList = activeQuery.data || [];

  const sortedList = useMemo(() => {
    const list = [...rawList];
    if (sort === "newest") {
      list.sort((a, b) => new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime());
    } else if (sort === "oldest") {
      list.sort((a, b) => new Date(a.followedAt).getTime() - new Date(b.followedAt).getTime());
    }
    return list;
  }, [rawList, sort]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleToggleFollow = (targetId: number) => {
    if (!me) {
      router.push("/(auth)/login");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFollow.mutate(targetId, {
      onSuccess: () => {
        followersQuery.refetch();
        followingQuery.refetch();
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopInset + 8,
            borderBottomColor: colors.divider,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.headerBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kết nối</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View
        style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setTab("followers");
          }}
          style={[styles.tabBtn, tab === "followers" && { backgroundColor: colors.primary + "1A" }]}
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: tab === "followers" ? colors.primary : colors.textSecondary },
            ]}
          >
            Người theo dõi
          </Text>
          <Text
            style={[
              styles.tabBtnCount,
              { color: tab === "followers" ? colors.primary : colors.textTertiary },
            ]}
          >
            {(followersQuery.data || []).length}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setTab("following");
          }}
          style={[styles.tabBtn, tab === "following" && { backgroundColor: colors.primary + "1A" }]}
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: tab === "following" ? colors.primary : colors.textSecondary },
            ]}
          >
            Đang theo dõi
          </Text>
          <Text
            style={[
              styles.tabBtnCount,
              { color: tab === "following" ? colors.primary : colors.textTertiary },
            ]}
          >
            {(followingQuery.data || []).length}
          </Text>
        </Pressable>
      </View>

      {/* Sort chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {(
          [
            { key: "default", label: "Mặc định" },
            { key: "newest", label: "Mới nhất" },
            { key: "oldest", label: "Sớm nhất" },
          ] as const
        ).map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSort(s.key as SortMode)}
            style={[
              styles.sortChip,
              {
                backgroundColor: sort === s.key ? colors.primary : colors.card,
                borderColor: sort === s.key ? colors.primary : colors.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.sortChipText,
                { color: sort === s.key ? "#fff" : colors.textSecondary },
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {activeQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sortedList.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name={tab === "followers" ? "account-multiple-outline" : "account-arrow-right-outline"}
            size={42}
            color={colors.textTertiary}
          />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {tab === "followers" ? "Chưa có người theo dõi" : "Chưa theo dõi ai"}
          </Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            {tab === "followers"
              ? "Đăng bài hay để thu hút người theo dõi"
              : "Khám phá cộng đồng và theo dõi tác giả bạn quan tâm"}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={activeQuery.isRefetching}
              onRefresh={() => activeQuery.refetch()}
              tintColor={colors.primary}
            />
          }
        >
          {sortedList.map((c) => {
            const level = c.reviewerLevel ? LEVEL_LABEL[c.reviewerLevel] : null;
            const showFollowBack =
              !c.isSelf && !c.isFollowingByViewer && tab === "followers" && !!me;
            const showFollowing = !c.isSelf && c.isFollowingByViewer && !!me;
            const showFollow = !c.isSelf && !c.isFollowingByViewer && tab !== "followers" && !!me;
            return (
              <Pressable
                key={c.userId}
                onPress={() =>
                  router.push({ pathname: "/user/[id]", params: { id: String(c.userId) } })
                }
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.95 : 1,
                  },
                ]}
              >
                {c.avatarUrl ? (
                  <Image source={{ uri: c.avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }}>
                      {c.userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                      {c.userName}
                    </Text>
                    {level && (
                      <View style={[styles.levelBadge, { backgroundColor: level.color + "1A" }]}>
                        <Ionicons name="star" size={8} color={level.color} />
                        <Text style={[styles.levelText, { color: level.color }]}>
                          {level.label}
                        </Text>
                      </View>
                    )}
                  </View>
                  {c.isSelf && (
                    <Text style={[styles.selfText, { color: colors.textTertiary }]}>Là bạn</Text>
                  )}
                </View>
                {/* Follow back / Follow / Following */}
                {showFollowBack && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleToggleFollow(c.userId);
                    }}
                    style={[styles.followBtn, { backgroundColor: colors.primary }]}
                    hitSlop={4}
                  >
                    <Text style={[styles.followBtnText, { color: "#fff" }]}>Theo dõi lại</Text>
                  </Pressable>
                )}
                {showFollow && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleToggleFollow(c.userId);
                    }}
                    style={[styles.followBtn, { backgroundColor: colors.primary }]}
                    hitSlop={4}
                  >
                    <Text style={[styles.followBtnText, { color: "#fff" }]}>Theo dõi</Text>
                  </Pressable>
                )}
                {showFollowing && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleToggleFollow(c.userId);
                    }}
                    style={[
                      styles.followBtn,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.cardBorder,
                        borderWidth: 1,
                      },
                    ]}
                    hitSlop={4}
                  >
                    <Text style={[styles.followBtnText, { color: colors.text }]}>Đang theo</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },

  tabRow: {
    flexDirection: "row",
    gap: 4,
    margin: 16,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  tabBtnCount: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  sortRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 12 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  selfText: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },

  followBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  followBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  emptyText: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 8 },
  emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
