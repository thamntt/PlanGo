import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { useThemeColors } from "@/constants/colors";
import type { BlogPost, TripTemplate, QAThread } from "@/data/destination-content-mocks";
import { formatVndCompact } from "@/data/destination-content-mocks";

type ThemeColors = ReturnType<typeof useThemeColors>;

// ──────────────────────────────────────────────────────────────
// SectionHeader — used by all 3 community sections
// ──────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  iconColor,
  title,
  subtitle,
  rightLabel,
  onRightPress,
  colors,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  rightLabel?: string;
  onRightPress?: () => void;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {rightLabel ? (
        <Pressable onPress={onRightPress} hitSlop={6} style={styles.sectionRight}>
          <Text style={[styles.sectionRightText, { color: colors.primary }]}>{rightLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// BlogPostCard — horizontal carousel card
// ──────────────────────────────────────────────────────────────

const CAT_LABEL: Record<BlogPost["category"], string> = {
  guide: "Hướng dẫn",
  review: "Review",
  food: "Ẩm thực",
  tips: "Mẹo hay",
};
const CAT_COLOR: Record<BlogPost["category"], string> = {
  guide: "#0891B2",
  review: "#10B981",
  food: "#F97316",
  tips: "#8B5CF6",
};

export function BlogPostCard({
  post,
  colors,
  onPress,
}: {
  post: BlogPost;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.blogCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={{ position: "relative" }}>
        <Image source={{ uri: post.coverImage }} style={styles.blogImage} contentFit="cover" />
        <View style={[styles.blogCategoryChip, { backgroundColor: CAT_COLOR[post.category] }]}>
          <Text style={styles.blogCategoryText}>{CAT_LABEL[post.category]}</Text>
        </View>
      </View>
      <View style={styles.blogContent}>
        <Text style={[styles.blogTitle, { color: colors.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={[styles.blogExcerpt, { color: colors.textSecondary }]} numberOfLines={2}>
          {post.excerpt}
        </Text>
        <View style={styles.blogMeta}>
          <Image source={{ uri: post.authorAvatar }} style={styles.blogAvatar} contentFit="cover" />
          <Text style={[styles.blogAuthor, { color: colors.text }]} numberOfLines={1}>
            {post.authorName}
          </Text>
          <View style={styles.blogMetaDivider} />
          <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
          <Text style={[styles.blogMetaText, { color: colors.textTertiary }]}>
            {post.readMinutes} phút
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="heart" size={12} color="#EF4444" />
          <Text style={[styles.blogMetaText, { color: colors.textTertiary }]}>{post.likes}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// TripTemplateCard — clone-able itinerary
// ──────────────────────────────────────────────────────────────

export function TripTemplateCard({
  template,
  colors,
  onPress,
}: {
  template: TripTemplate;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.templateCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={{ uri: template.coverImage }}
          style={styles.templateImage}
          contentFit="cover"
        />
        <View style={styles.templateDaysChip}>
          <MaterialCommunityIcons name="calendar-outline" size={12} color="#fff" />
          <Text style={styles.templateDaysText}>{template.numDays} ngày</Text>
        </View>
      </View>
      <View style={styles.templateContent}>
        <Text style={[styles.templateTitle, { color: colors.text }]} numberOfLines={1}>
          {template.title}
        </Text>
        <Text style={[styles.templateDesc, { color: colors.textSecondary }]} numberOfLines={2}>
          {template.description}
        </Text>
        <View style={styles.templateStatsRow}>
          <View style={styles.templateStat}>
            <Ionicons name="star" size={13} color={colors.star} />
            <Text style={[styles.templateStatText, { color: colors.text }]}>
              {template.rating.toFixed(1)}
            </Text>
          </View>
          <View style={styles.templateStat}>
            <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.templateStatText, { color: colors.textSecondary }]}>
              {template.usedByCount} dùng
            </Text>
          </View>
          <View style={[styles.templateStat, { marginLeft: "auto" }]}>
            <MaterialCommunityIcons name="wallet-outline" size={13} color={colors.primary} />
            <Text
              style={[
                styles.templateStatText,
                { color: colors.primary, fontFamily: "Inter_700Bold" },
              ]}
            >
              {formatVndCompact(template.budgetVnd)}đ
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// QAThreadCard — vertical list item
// ──────────────────────────────────────────────────────────────

export function QAThreadCard({
  thread,
  colors,
  onPress,
}: {
  thread: QAThread;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.qaCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={[styles.qaIconWrap, { backgroundColor: colors.primary + "1A" }]}>
        <MaterialCommunityIcons name="comment-question" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.qaQuestion, { color: colors.text }]} numberOfLines={2}>
          {thread.question}
        </Text>
        <Text style={[styles.qaPreview, { color: colors.textSecondary }]} numberOfLines={1}>
          {thread.preview}
        </Text>
        <View style={styles.qaMeta}>
          <Image source={{ uri: thread.authorAvatar }} style={styles.qaAvatar} contentFit="cover" />
          <Text style={[styles.qaAuthor, { color: colors.textTertiary }]} numberOfLines={1}>
            {thread.authorName}
          </Text>
          <View style={styles.qaMetaDivider} />
          <MaterialCommunityIcons name="message-outline" size={12} color={colors.textTertiary} />
          <Text style={[styles.qaMetaText, { color: colors.textTertiary }]}>
            {thread.answerCount} câu trả lời
          </Text>
          {thread.isAnswered && (
            <View style={[styles.qaSolvedBadge, { backgroundColor: colors.success + "20" }]}>
              <Ionicons name="checkmark-circle" size={10} color={colors.success} />
              <Text style={[styles.qaSolvedText, { color: colors.success }]}>Đã giải đáp</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Section header
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 28 },
  sectionRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionRightText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Blog card
  blogCard: {
    width: 260,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  blogImage: { width: "100%", height: 140 },
  blogCategoryChip: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  blogCategoryText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  blogContent: { padding: 12, gap: 6 },
  blogTitle: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 18 },
  blogExcerpt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  blogMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  blogAvatar: { width: 18, height: 18, borderRadius: 9 },
  blogAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold", maxWidth: 80 },
  blogMetaDivider: { width: 2, height: 2, borderRadius: 1, backgroundColor: "#94A3B8" },
  blogMetaText: { fontSize: 10, fontFamily: "Inter_500Medium" },

  // Template card
  templateCard: {
    width: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  templateImage: { width: "100%", height: 130 },
  templateDaysChip: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  templateDaysText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  templateContent: { padding: 14, gap: 6 },
  templateTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  templateDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  templateStatsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  templateStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  templateStatText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Q&A card
  qaCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  qaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  qaQuestion: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 19 },
  qaPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  qaMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, flexWrap: "wrap" },
  qaAvatar: { width: 16, height: 16, borderRadius: 8 },
  qaAuthor: { fontSize: 11, fontFamily: "Inter_500Medium", maxWidth: 70 },
  qaMetaDivider: { width: 2, height: 2, borderRadius: 1, backgroundColor: "#94A3B8" },
  qaMetaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  qaSolvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  qaSolvedText: { fontSize: 10, fontFamily: "Inter_700Bold" },
});
