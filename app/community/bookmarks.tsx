import React, { useCallback, useState } from "react";
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api/query-client";
import type { BlogPost } from "@/hooks/queries/use-blog";

async function unwrap<T>(res: Response): Promise<T> {
  const json = await res.json();
  return ("data" in json ? json.data : json) as T;
}

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
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function BookmarksScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const bookmarksQuery = useQuery<BlogPost[]>({
    queryKey: ["blog", "bookmarks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/blog/me/bookmarks");
      return unwrap<BlogPost[]>(res);
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await bookmarksQuery.refetch();
    setRefreshing(false);
  }, [bookmarksQuery]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const bookmarks = bookmarksQuery.data || [];

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Đã lưu</Text>
        <View style={{ width: 40 }} />
      </View>

      {!user ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bookmark-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Hãy đăng nhập để xem bookmark
          </Text>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.loginBtnText}>Đăng nhập</Text>
          </Pressable>
        </View>
      ) : bookmarksQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bookmark-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Chưa có bài viết nào được lưu
          </Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Bấm vào icon bookmark khi đọc bài viết để lưu lại
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/community")}
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.loginBtnText}>Khám phá bài viết</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 12,
            paddingBottom: 80,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            {bookmarks.length} bài đã lưu
          </Text>
          {bookmarks.map((p) => (
            <Pressable
              key={p.postId}
              onPress={() =>
                router.push({ pathname: "/community/blog/[id]", params: { id: String(p.postId) } })
              }
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.95 : 1,
                },
              ]}
            >
              {p.coverImage && (
                <Image source={{ uri: p.coverImage }} style={styles.cover} contentFit="cover" />
              )}
              <View style={{ padding: 12, gap: 6 }}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {p.title}
                </Text>
                {p.excerpt && (
                  <Text style={[styles.excerpt, { color: colors.textSecondary }]} numberOfLines={2}>
                    {p.excerpt}
                  </Text>
                )}
                <View style={styles.meta}>
                  {p.authorAvatar ? (
                    <Image
                      source={{ uri: p.authorAvatar }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
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
                      <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>
                        {p.authorName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.metaText, { color: colors.text }]}>{p.authorName}</Text>
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>·</Text>
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                    {timeAgo(p.publishedAt)}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Ionicons name="bookmark" size={13} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },

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

  countLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 160 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 19 },
  excerpt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  metaText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  emptyText: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  loginBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
  loginBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
