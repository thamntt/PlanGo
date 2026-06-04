import React, { useState, useCallback, useMemo } from "react";
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile, useToggleFollow } from "@/hooks/queries/use-user-community";
import { useBlogPosts, type BlogPost } from "@/hooks/queries/use-blog";
import { useForumThreads, type ForumThread } from "@/hooks/queries/use-forum";
import { BlogPostRow, ForumThreadRow } from "@/features/community/ContentRows";

type Tab = "blog" | "forum";

const LEVEL_LABEL: Record<string, { label: string; color: string }> = {
  newcomer: { label: "Người mới", color: "#94A3B8" },
  active: { label: "Tích cực", color: "#10B981" },
  top: { label: "Nổi bật", color: "#F59E0B" },
  legend: { label: "Huyền thoại", color: "#A855F7" },
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id ? Number(id) : undefined;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user: me } = useAuth();

  // Single source of truth: if viewing my own profile, redirect to Tôi tab
  React.useEffect(() => {
    if (me && userId && userId === Number(me.id)) {
      router.replace("/(tabs)/profile");
    }
  }, [me, userId]);

  const profileQuery = useUserProfile(userId);
  const blogQuery = useBlogPosts(userId ? { authorId: userId, limit: 50 } : {});
  const forumQuery = useForumThreads({ limit: 100 });
  const toggleFollow = useToggleFollow();

  const [tab, setTab] = useState<Tab>("blog");
  const [refreshing, setRefreshing] = useState(false);

  const profile = profileQuery.data;
  const blogPosts = blogQuery.data || [];
  const allForumThreads = forumQuery.data || [];
  const userThreads = useMemo(
    () => allForumThreads.filter((t) => t.authorId === userId),
    [allForumThreads, userId],
  );

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([profileQuery.refetch(), blogQuery.refetch(), forumQuery.refetch()]);
    setRefreshing(false);
  }, [profileQuery, blogQuery, forumQuery]);

  const handleFollow = useCallback(() => {
    if (!userId || !me) {
      router.push("/(auth)/login");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFollow.mutate(userId);
  }, [userId, me, toggleFollow]);

  if (profileQuery.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Không tìm thấy tác giả</Text>
      </View>
    );
  }

  const levelInfo = profile.reviewerLevel ? LEVEL_LABEL[profile.reviewerLevel] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating back button */}
      <View style={[styles.topActions, { top: insets.top + webTopInset + 8 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/community"))}
          style={({ pressed }) => [
            styles.floatBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero header — plain (no gradient) */}
        <View
          style={[
            styles.hero,
            {
              paddingTop: insets.top + webTopInset + 60,
              backgroundColor: colors.background,
            },
          ]}
        >
          {/* Avatar */}
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
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
              <Text style={styles.avatarInitial}>{profile.userName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <Text style={[styles.userName, { color: colors.text }]}>{profile.userName}</Text>

          {levelInfo && (
            <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "1F" }]}>
              <Ionicons name="star" size={11} color={levelInfo.color} />
              <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
            </View>
          )}

          {/* Stats row */}
          <View
            style={[
              styles.statsBar,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <StatItem value={profile.postCount} label="Bài viết" />
            <StatDivider />
            <StatItem value={profile.threadCount + profile.replyCount} label="Hỏi đáp" />
            <StatDivider />
            <StatItem
              value={profile.followerCount}
              label="Followers"
              onPress={() =>
                router.push({
                  pathname: "/connections",
                  params: { userId: String(userId), tab: "followers" },
                })
              }
            />
            <StatDivider />
            <StatItem
              value={profile.followingCount}
              label="Following"
              onPress={() =>
                router.push({
                  pathname: "/connections",
                  params: { userId: String(userId), tab: "following" },
                })
              }
            />
          </View>

          {/* Action buttons — IG style: side by side, light bg */}
          <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 10 }}>
            {profile.isOwnProfile ? (
              <Pressable
                onPress={() => router.push("/profile/edit")}
                style={({ pressed }) => [
                  styles.igBtn,
                  { flex: 1, backgroundColor: colors.inputBg, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.igBtnText, { color: colors.text }]}>Chỉnh sửa profile</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleFollow}
                disabled={toggleFollow.isPending}
                style={({ pressed }) => [
                  styles.igBtn,
                  {
                    flex: 1,
                    backgroundColor: profile.isFollowing ? colors.inputBg : colors.primary,
                    opacity: pressed || toggleFollow.isPending ? 0.85 : 1,
                  },
                ]}
              >
                {toggleFollow.isPending ? (
                  <ActivityIndicator
                    size="small"
                    color={profile.isFollowing ? colors.text : "#fff"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.igBtnText,
                      { color: profile.isFollowing ? colors.text : "#fff" },
                    ]}
                  >
                    {profile.isFollowing ? "Đang theo dõi" : "Theo dõi"}
                  </Text>
                )}
              </Pressable>
            )}
            <Pressable
              onPress={async () => {
                try {
                  const { Share } = await import("react-native");
                  await Share.share({
                    message: `Xem profile ${profile.userName} trên PlanGo`,
                  });
                } catch {}
              }}
              style={({ pressed }) => [
                styles.igBtn,
                { flex: 1, backgroundColor: colors.inputBg, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.igBtnText, { color: colors.text }]}>Chia sẻ profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Tab switcher */}
        <View
          style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setTab("blog");
            }}
            style={[styles.tabBtn, tab === "blog" && { backgroundColor: colors.primary + "1A" }]}
          >
            <Ionicons
              name="newspaper"
              size={15}
              color={tab === "blog" ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: tab === "blog" ? colors.primary : colors.textSecondary },
              ]}
            >
              Bài viết ({profile.postCount})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setTab("forum");
            }}
            style={[styles.tabBtn, tab === "forum" && { backgroundColor: colors.primary + "1A" }]}
          >
            <Ionicons
              name="chatbubbles"
              size={15}
              color={tab === "forum" ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: tab === "forum" ? colors.primary : colors.textSecondary },
              ]}
            >
              Hỏi đáp ({profile.threadCount})
            </Text>
          </Pressable>
        </View>

        {/* Tab content */}
        {tab === "blog" ? (
          <BlogList items={blogPosts} colors={colors} isLoading={blogQuery.isLoading} />
        ) : (
          <ForumList items={userThreads} colors={colors} isLoading={forumQuery.isLoading} />
        )}
      </ScrollView>
    </View>
  );
}

function StatItem({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.statItem, { opacity: pressed && onPress ? 0.7 : 1 }]}
    >
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function StatDivider() {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  return <View style={[styles.statSeparator, { backgroundColor: colors.divider }]} />;
}

function BlogList({
  items,
  colors,
  isLoading,
}: {
  items: BlogPost[];
  colors: ReturnType<typeof useThemeColors>;
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialCommunityIcons
          name="newspaper-variant-outline"
          size={36}
          color={colors.textTertiary}
        />
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Chưa có bài viết nào</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 12 }}>
      {items.map((p) => (
        <BlogPostRow key={p.postId} post={p} colors={colors} />
      ))}
    </View>
  );
}

function ForumList({
  items,
  colors,
  isLoading,
}: {
  items: ForumThread[];
  colors: ReturnType<typeof useThemeColors>;
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialCommunityIcons name="forum-outline" size={36} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Chưa có câu hỏi nào</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}>
      {items.map((t) => (
        <ForumThreadRow key={t.threadId} thread={t} colors={colors} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topActions: { position: "absolute", left: 16, zIndex: 10 },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarInitial: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  userName: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 6 },
  igBtn: {
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  igBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  joinedText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },

  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  statSeparator: { width: 1, height: 26, backgroundColor: "rgba(0,0,0,0.1)" },

  followBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
  },
  followText: { fontSize: 13, fontFamily: "Inter_700Bold" },

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

  empty: { paddingVertical: 50, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
