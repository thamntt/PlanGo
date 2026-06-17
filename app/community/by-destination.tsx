import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useBlogPosts } from "@/hooks/queries/use-blog";
import { useForumThreads } from "@/hooks/queries/use-forum";
import { BlogPostRow, ForumThreadRow } from "@/features/community/ContentRows";

type Tab = "blog" | "forum";

export default function CommunityByDestinationScreen() {
  const { name = "", tab: initialTab } = useLocalSearchParams<{ name?: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const [tab, setTab] = useState<Tab>(initialTab === "forum" ? "forum" : "blog");

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const search = String(name).trim();

  const blogQuery = useBlogPosts({ search: search || undefined, sort: "latest", limit: 50 });
  const forumQuery = useForumThreads({ search: search || undefined, sort: "latest", limit: 50 });
  const posts = blogQuery.data || [];
  const threads = forumQuery.data || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with REAL back button */}
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Cộng đồng về {search || "điểm đến"}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]} numberOfLines={1}>
            {tab === "blog" ? `${posts.length} bài viết` : `${threads.length} câu hỏi`}
          </Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(["blog", "forum"] as const).map((k) => {
          const active = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={({ pressed }) => [
                styles.tabBtn,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={k === "blog" ? "newspaper-outline" : "chatbubbles-outline"}
                size={14}
                color={active ? "#fff" : colors.textSecondary}
              />
              <Text style={[styles.tabBtnText, { color: active ? "#fff" : colors.text }]}>
                {k === "blog" ? "Bài viết" : "Hỏi đáp"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "blog" ? (
          blogQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
          ) : posts.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textTertiary }]}>
              Chưa có bài viết nào về {search}
            </Text>
          ) : (
            posts.map((p) => <BlogPostRow key={p.postId} post={p} colors={colors} />)
          )
        ) : forumQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : threads.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            Chưa có câu hỏi nào về {search}
          </Text>
        ) : (
          threads.map((t) => <ForumThreadRow key={t.threadId} thread={t} colors={colors} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  headerSub: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  empty: { textAlign: "center", marginTop: 40, fontSize: 13, fontStyle: "italic" },
});
