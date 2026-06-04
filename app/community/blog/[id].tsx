import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
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
import {
  useBlogPost,
  useBlogComments,
  useToggleBlogLike,
  useToggleBlogBookmark,
  useCreateBlogComment,
  useDeleteBlogComment,
  useDeleteBlogPost,
} from "@/hooks/queries/use-blog";
import { ReportSheet } from "@/features/community/ReportSheet";

const CAT_LABEL: Record<string, string> = {
  guide: "Hướng dẫn",
  review: "Review",
  food: "Ẩm thực",
  tips: "Mẹo hay",
  experience: "Trải nghiệm",
};
const CAT_COLOR: Record<string, string> = {
  guide: "#0891B2",
  review: "#10B981",
  food: "#F97316",
  tips: "#8B5CF6",
  experience: "#EC4899",
};

export default function BlogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id ? Number(id) : undefined;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const postQuery = useBlogPost(postId);
  const commentsQuery = useBlogComments(postId);
  const toggleLike = useToggleBlogLike();
  const toggleBookmark = useToggleBlogBookmark();
  const createComment = useCreateBlogComment();
  const deleteComment = useDeleteBlogComment();
  const deletePost = useDeleteBlogPost();
  const [commentDraft, setCommentDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  const post = postQuery.data;
  const comments = commentsQuery.data || [];
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const isOwn = !!user && post?.authorId === Number(user.id);

  const handleLike = useCallback(() => {
    if (!postId || !user) {
      Alert.alert("", "Vui lòng đăng nhập để thích bài viết");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLike.mutate(postId);
  }, [postId, user, toggleLike]);

  const handleBookmark = useCallback(() => {
    if (!postId || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleBookmark.mutate(postId);
  }, [postId, user, toggleBookmark]);

  const handleSubmitComment = useCallback(async () => {
    const text = commentDraft.trim();
    if (!text || !postId || !user) return;
    try {
      await createComment.mutateAsync({ postId, content: text });
      setCommentDraft("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không gửi được bình luận");
    }
  }, [commentDraft, postId, user, createComment]);

  const handleDeletePost = useCallback(() => {
    if (!postId) return;
    const doDelete = async () => {
      try {
        await deletePost.mutateAsync(postId);
        router.back();
      } catch {}
    };
    if (Platform.OS === "web") {
      if (confirm("Xóa bài viết này?")) doDelete();
    } else {
      Alert.alert("Xóa bài viết", "Bài viết sẽ bị xóa vĩnh viễn", [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: doDelete },
      ]);
    }
  }, [postId, deletePost]);

  if (postQuery.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Không tìm thấy bài viết</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero image with overlay */}
          <View style={styles.heroWrap}>
            {post.coverImage ? (
              <Image source={{ uri: post.coverImage }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, { backgroundColor: colors.inputBg }]} />
            )}
            <LinearGradient
              colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.65)"]}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {/* Top buttons */}
            <View style={[styles.topRow, { top: insets.top + webTopInset + 8 }]}>
              <Pressable
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/(tabs)/community")
                }
                style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={handleBookmark}
                  style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Ionicons
                    name={post.isBookmarkedByViewer ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color="#fff"
                  />
                </Pressable>
                {isOwn ? (
                  <Pressable
                    onPress={handleDeletePost}
                    style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                  </Pressable>
                ) : user ? (
                  <Pressable
                    onPress={() => setReportOpen(true)}
                    style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="flag-outline" size={18} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            </View>
            {/* Title overlay */}
            <View style={styles.titleOverlay}>
              {post.category && (
                <View
                  style={[
                    styles.catBadge,
                    { backgroundColor: CAT_COLOR[post.category] || colors.primary },
                  ]}
                >
                  <Text style={styles.catBadgeText}>
                    {CAT_LABEL[post.category] || post.category}
                  </Text>
                </View>
              )}
              <Text style={styles.heroTitle}>{post.title}</Text>
            </View>
          </View>

          {/* Author bar */}
          <Pressable
            onPress={() =>
              router.push({ pathname: "/user/[id]", params: { id: String(post.authorId) } })
            }
            style={({ pressed }) => [
              styles.authorBar,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
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
                  {
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" }}>
                  {post.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.authorName, { color: colors.text }]}>{post.authorName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
                <Text style={[styles.authorMeta, { color: colors.textTertiary }]}>
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("vi-VN") : ""}
                </Text>
                <Text style={[styles.authorMeta, { color: colors.textTertiary }]}>·</Text>
                <Text style={[styles.authorMeta, { color: colors.textTertiary }]}>
                  {post.readMinutes} phút đọc
                </Text>
                <Text style={[styles.authorMeta, { color: colors.textTertiary }]}>·</Text>
                <Ionicons name="eye-outline" size={11} color={colors.textTertiary} />
                <Text style={[styles.authorMeta, { color: colors.textTertiary }]}>
                  {post.viewCount}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>

          {/* Destinations linked */}
          {post.destinationsList.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ĐỊA ĐIỂM</Text>
              <View style={styles.destChipsRow}>
                {post.destinationsList.map((d) => (
                  <Pressable
                    key={d.destinationId}
                    onPress={() =>
                      router.push({
                        pathname: "/destination/[id]",
                        params: { id: String(d.destinationId) },
                      })
                    }
                    style={[
                      styles.destChip,
                      {
                        backgroundColor: colors.primary + "1A",
                        borderColor: colors.primary + "40",
                      },
                    ]}
                  >
                    <Ionicons name="location" size={11} color={colors.primary} />
                    <Text style={[styles.destChipText, { color: colors.primary }]}>{d.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CHỦ ĐỀ</Text>
              <View style={styles.tagsRow}>
                {post.tags.map((t) => (
                  <View
                    key={t.tagId}
                    style={[
                      styles.tagChip,
                      { backgroundColor: (t.color || colors.primary) + "18" },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: t.color || colors.primary }]}>
                      #{t.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Content */}
          {post.excerpt && (
            <Text style={[styles.excerpt, { color: colors.textSecondary }]}>{post.excerpt}</Text>
          )}
          <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>

          {/* Stats + actions */}
          <View
            style={[
              styles.actionsBar,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Pressable
              onPress={handleLike}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: post.isLikedByViewer ? "#EF4444" + "1A" : "transparent",
                  borderColor: post.isLikedByViewer ? "#EF4444" : colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={post.isLikedByViewer ? "heart" : "heart-outline"}
                size={16}
                color={post.isLikedByViewer ? "#EF4444" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: post.isLikedByViewer ? "#EF4444" : colors.text },
                ]}
              >
                {post.likeCount} thích
              </Text>
            </Pressable>
            <Pressable
              onPress={handleBookmark}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: post.isBookmarkedByViewer
                    ? colors.primary + "1A"
                    : "transparent",
                  borderColor: post.isBookmarkedByViewer ? colors.primary : colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={post.isBookmarkedByViewer ? "bookmark" : "bookmark-outline"}
                size={16}
                color={post.isBookmarkedByViewer ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: post.isBookmarkedByViewer ? colors.primary : colors.text },
                ]}
              >
                Lưu
              </Text>
            </Pressable>
          </View>

          {/* Comments */}
          <View style={styles.section}>
            <Text style={[styles.commentsTitle, { color: colors.text }]}>
              Bình luận ({comments.length})
            </Text>
            {comments.length === 0 ? (
              <Text style={[styles.commentsEmpty, { color: colors.textTertiary }]}>
                Hãy là người đầu tiên bình luận
              </Text>
            ) : (
              <View style={{ gap: 12 }}>
                {comments.map((c) => {
                  const isOwnComment = !!user && c.authorId === Number(user.id);
                  return (
                    <View
                      key={c.commentId}
                      style={[
                        styles.comment,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      ]}
                    >
                      <View style={styles.commentHeader}>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/user/[id]",
                              params: { id: String(c.authorId) },
                            })
                          }
                          hitSlop={4}
                        >
                          {c.authorAvatar ? (
                            <Image
                              source={{ uri: c.authorAvatar }}
                              style={styles.commentAvatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.commentAvatar,
                                {
                                  backgroundColor: colors.primary,
                                  alignItems: "center",
                                  justifyContent: "center",
                                },
                              ]}
                            >
                              <Text
                                style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" }}
                              >
                                {c.authorName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.commentAuthor, { color: colors.text }]}>
                            {c.authorName}
                          </Text>
                          <Text style={[styles.commentTime, { color: colors.textTertiary }]}>
                            {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                          </Text>
                        </View>
                        {isOwnComment && (
                          <Pressable
                            onPress={() =>
                              deleteComment.mutate({ commentId: c.commentId, postId: postId! })
                            }
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.error} />
                          </Pressable>
                        )}
                      </View>
                      <Text style={[styles.commentContent, { color: colors.text }]}>
                        {c.content}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Sticky comment input */}
        {user && (
          <View
            style={[
              styles.commentInputBar,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.divider,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
              },
            ]}
          >
            <View
              style={[
                styles.commentInputBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="Viết bình luận..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[styles.commentInput, { color: colors.text }]}
              />
              <Pressable
                onPress={handleSubmitComment}
                disabled={!commentDraft.trim() || createComment.isPending}
                hitSlop={6}
              >
                {createComment.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={commentDraft.trim() ? colors.primary : colors.textTertiary}
                  />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="blog"
        contentRefId={post.postId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  heroWrap: { position: "relative" },
  cover: { width: "100%", height: 280 },
  topRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleOverlay: { position: "absolute", left: 16, right: 16, bottom: 16, gap: 8 },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  catBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  heroTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.2,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  authorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  authorMeta: { fontSize: 11, fontFamily: "Inter_500Medium" },

  section: { paddingHorizontal: 20, marginBottom: 14 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5, marginBottom: 8 },
  destChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  destChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  destChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  tagText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  excerpt: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 20,
    lineHeight: 22,
    fontStyle: "italic",
    marginBottom: 12,
  },
  content: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    lineHeight: 23,
    marginBottom: 20,
  },

  actionsBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  commentsTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 14 },
  commentsEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    paddingVertical: 10,
  },
  comment: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 6 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentAuthor: { fontSize: 13, fontFamily: "Inter_700Bold" },
  commentTime: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
  commentContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  commentInputBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
    maxHeight: 90,
  },
});
