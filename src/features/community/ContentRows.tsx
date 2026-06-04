import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { useThemeColors } from "@/constants/colors";
import type { BlogPost } from "@/hooks/queries/use-blog";
import type { ForumThread } from "@/hooks/queries/use-forum";

type ThemeColors = ReturnType<typeof useThemeColors>;

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

export function BlogPostRow({ post, colors }: { post: BlogPost; colors: ThemeColors }) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/community/blog/[id]", params: { id: String(post.postId) } })
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
      {post.coverImage && (
        <Image source={{ uri: post.coverImage }} style={styles.thumb} contentFit="cover" />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt && (
          <Text style={[styles.excerpt, { color: colors.textSecondary }]} numberOfLines={2}>
            {post.excerpt}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {timeAgo(post.publishedAt)}
          </Text>
          <Ionicons name="heart" size={10} color="#EF4444" />
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>{post.likeCount}</Text>
          <Ionicons name="chatbubble-outline" size={10} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>{post.commentCount}</Text>
          <Ionicons name="eye-outline" size={10} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>{post.viewCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ForumThreadRow({ thread, colors }: { thread: ForumThread; colors: ThemeColors }) {
  const solved = thread.status === "solved";
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/community/forum/[id]", params: { id: String(thread.threadId) } })
      }
      style={({ pressed }) => [
        styles.threadCard,
        {
          backgroundColor: colors.card,
          borderColor: solved ? "#10B98140" : colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {thread.title}
      </Text>
      <View style={styles.metaRow}>
        {solved && (
          <View style={styles.solvedBadge}>
            <Ionicons name="checkmark-circle" size={9} color="#fff" />
            <Text style={styles.solvedText}>Đã giải đáp</Text>
          </View>
        )}
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
          {timeAgo(thread.createdAt)}
        </Text>
        <Ionicons name="arrow-up" size={10} color={colors.textTertiary} />
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{thread.upvotes}</Text>
        <Ionicons name="chatbubble-outline" size={10} color={colors.textTertiary} />
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{thread.replyCount}</Text>
      </View>
    </Pressable>
  );
}

export function EmptyContentBlock({
  icon,
  title,
  cta,
  onPress,
  colors,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  cta: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[styles.empty, { borderColor: colors.cardBorder, backgroundColor: colors.inputBg }]}
    >
      <MaterialCommunityIcons name={icon} size={32} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.emptyBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.emptyBtnText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  thumb: { width: 80, height: 80, borderRadius: 10 },
  title: { fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 18 },
  excerpt: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  metaText: { fontSize: 10, fontFamily: "Inter_500Medium" },

  threadCard: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  solvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  solvedText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },

  empty: {
    padding: 26,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
});
