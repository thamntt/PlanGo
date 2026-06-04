import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { useThemeColors } from "@/constants/colors";
import type { BlogPost } from "@/hooks/queries/use-blog";
import type { ForumThread } from "@/hooks/queries/use-forum";

type ThemeColors = ReturnType<typeof useThemeColors>;

// Category labels + colors — shared with community tab
const BLOG_CAT: Record<string, { label: string; color: string }> = {
  guide: { label: "Hướng dẫn", color: "#0891B2" },
  review: { label: "Review", color: "#10B981" },
  food: { label: "Ẩm thực", color: "#F97316" },
  tips: { label: "Mẹo hay", color: "#8B5CF6" },
  tip: { label: "Mẹo hay", color: "#8B5CF6" },
  experience: { label: "Trải nghiệm", color: "#EC4899" },
  story: { label: "Trải nghiệm", color: "#EC4899" },
};
const FORUM_CAT: Record<string, { label: string; color: string }> = {
  question: { label: "Câu hỏi", color: "#3B82F6" },
  discussion: { label: "Thảo luận", color: "#A855F7" },
  tip: { label: "Mẹo", color: "#10B981" },
  recommendation: { label: "Gợi ý", color: "#F59E0B" },
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

export function BlogPostRow({ post, colors }: { post: BlogPost; colors: ThemeColors }) {
  const cat = post.category ? BLOG_CAT[post.category] : null;
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
        {/* Category badge */}
        {cat && (
          <View style={styles.catRow}>
            <View style={[styles.catBadge, { backgroundColor: cat.color + "1A" }]}>
              <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
            </View>
          </View>
        )}
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt && (
          <Text style={[styles.excerpt, { color: colors.textSecondary }]} numberOfLines={1}>
            {post.excerpt}
          </Text>
        )}
        {/* Author row */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            router.push({ pathname: "/user/[id]", params: { id: String(post.authorId) } });
          }}
          style={styles.authorRow}
          hitSlop={4}
        >
          {post.authorAvatar ? (
            <Image
              source={{ uri: post.authorAvatar }}
              style={styles.authorAvatar}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.authorAvatar,
                { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
              ]}
            >
              <Text style={{ color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" }}>
                {post.authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
            {post.authorName}
          </Text>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>·</Text>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {timeAgo(post.publishedAt)}
          </Text>
        </Pressable>
        <View style={styles.metaRow}>
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
  const cat = thread.category ? FORUM_CAT[thread.category] : null;
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
      {/* Category badge */}
      {cat && (
        <View style={styles.catRow}>
          <View style={[styles.catBadge, { backgroundColor: cat.color + "1A" }]}>
            <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
        </View>
      )}
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {thread.title}
      </Text>
      {/* Author row */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          router.push({ pathname: "/user/[id]", params: { id: String(thread.authorId) } });
        }}
        style={styles.authorRow}
        hitSlop={4}
      >
        {thread.authorAvatar ? (
          <Image
            source={{ uri: thread.authorAvatar }}
            style={styles.authorAvatar}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.authorAvatar,
              { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Text style={{ color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" }}>
              {thread.authorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
          {thread.authorName}
        </Text>
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>·</Text>
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
          {timeAgo(thread.createdAt)}
        </Text>
      </Pressable>
      <View style={styles.metaRow}>
        {solved && (
          <View style={styles.solvedBadge}>
            <Ionicons name="checkmark-circle" size={9} color="#fff" />
            <Text style={styles.solvedText}>Đã giải đáp</Text>
          </View>
        )}
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
  authorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  authorAvatar: { width: 18, height: 18, borderRadius: 9 },
  authorName: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  catRow: { flexDirection: "row", marginBottom: 5 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 10, fontFamily: "Inter_700Bold" },

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
