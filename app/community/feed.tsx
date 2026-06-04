import React, { useState, useCallback } from "react";
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
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useBlogPosts } from "@/hooks/queries/use-blog";
import { useForumThreads } from "@/hooks/queries/use-forum";
import { BlogPostRow, ForumThreadRow } from "@/features/community/ContentRows";

type FeedMode = "following" | "liked" | "bookmarked";

const MODE_CONFIG: Record<
  FeedMode,
  {
    title: string;
    desc: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    hasForumTab: boolean;
  }
> = {
  following: {
    title: "Đang theo dõi",
    desc: "Bài viết & câu hỏi từ tác giả bạn theo dõi",
    icon: "account-multiple-check",
    color: "#A855F7",
    hasForumTab: true,
  },
  liked: {
    title: "Đã thích",
    desc: "Bài viết bạn đã tim",
    icon: "heart",
    color: "#EF4444",
    hasForumTab: false,
  },
  bookmarked: {
    title: "Đã lưu",
    desc: "Bài viết đã bookmark để đọc lại",
    icon: "bookmark",
    color: "#F59E0B",
    hasForumTab: false,
  },
};

export default function CommunityFeedScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = (
    params.mode === "liked" || params.mode === "bookmarked" ? params.mode : "following"
  ) as FeedMode;
  const config = MODE_CONFIG[mode];
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();

  const [tab, setTab] = useState<"blog" | "forum">("blog");
  const [refreshing, setRefreshing] = useState(false);

  const blogFilters = {
    followingOnly: mode === "following",
    likedOnly: mode === "liked",
    bookmarkedOnly: mode === "bookmarked",
  };

  const blogQuery = useBlogPosts(blogFilters);
  const forumQuery = useForumThreads(
    config.hasForumTab ? { followingOnly: mode === "following" } : {},
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([blogQuery.refetch(), config.hasForumTab && forumQuery.refetch()]);
    setRefreshing(false);
  }, [blogQuery, forumQuery, config.hasForumTab]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const blogPosts = blogQuery.data || [];
  const threads = forumQuery.data || [];

  const showLoginWall = !user;

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
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/community"))}
          style={[
            styles.headerBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{config.title}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Subtitle banner */}
      <View
        style={[
          styles.banner,
          { backgroundColor: config.color + "12", borderColor: config.color + "44" },
        ]}
      >
        <MaterialCommunityIcons name={config.icon} size={16} color={config.color} />
        <Text style={[styles.bannerText, { color: config.color }]}>{config.desc}</Text>
      </View>

      {/* Tabs (only if mode has forum tab) */}
      {config.hasForumTab && (
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
              size={14}
              color={tab === "blog" ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: tab === "blog" ? colors.primary : colors.textSecondary },
              ]}
            >
              Blog ({blogPosts.length})
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
              size={14}
              color={tab === "forum" ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: tab === "forum" ? colors.primary : colors.textSecondary },
              ]}
            >
              Diễn đàn ({threads.length})
            </Text>
          </Pressable>
        </View>
      )}

      {/* Content */}
      {showLoginWall ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock-outline" size={42} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Cần đăng nhập</Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Hãy đăng nhập để xem nội dung này
          </Text>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={[styles.cta, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.ctaText}>Đăng nhập</Text>
          </Pressable>
        </View>
      ) : (blogQuery.isLoading && tab === "blog") || (forumQuery.isLoading && tab === "forum") ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 60,
            gap: 10,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {tab === "blog" ? (
            blogPosts.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name={config.icon} size={42} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {mode === "following" && "Chưa theo dõi ai"}
                  {mode === "liked" && "Chưa thích bài nào"}
                  {mode === "bookmarked" && "Chưa lưu bài nào"}
                </Text>
                <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                  {mode === "following" && "Khám phá cộng đồng và theo dõi tác giả bạn quan tâm"}
                  {mode === "liked" && "Bấm icon tim khi đọc bài hay để lưu lại"}
                  {mode === "bookmarked" && "Bấm icon bookmark trên bài viết để lưu đọc lại"}
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/community")}
                  style={[styles.cta, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.ctaText}>Khám phá cộng đồng</Text>
                </Pressable>
              </View>
            ) : (
              blogPosts.map((p) => <BlogPostRow key={p.postId} post={p} colors={colors} />)
            )
          ) : threads.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name={config.icon} size={42} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Chưa có câu hỏi nào</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                {mode === "following" && "Theo dõi thêm tác giả để xem câu hỏi của họ"}
              </Text>
            </View>
          ) : (
            threads.map((t) => <ForumThreadRow key={t.threadId} thread={t} colors={colors} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  empty: { paddingVertical: 50, alignItems: "center", gap: 8, paddingHorizontal: 24 },

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

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 14,
  },
  bannerText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },

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

  emptyTitle: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  cta: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
  ctaText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
