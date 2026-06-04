import React, { useState, useCallback, useMemo } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBlogPost,
  useBlogComments,
  useToggleBlogLike,
  useToggleBlogBookmark,
  useCreateBlogComment,
  useUpdateBlogComment,
  useDeleteBlogComment,
  useDeleteBlogPost,
  useToggleCommentLike,
  useTogglePinComment,
  type BlogComment,
} from "@/hooks/queries/use-blog";
import { ReportSheet } from "@/features/community/ReportSheet";
import { AdminBadge } from "@/features/community/AdminBadge";
import { CommentItem } from "@/features/community/CommentItem";
import { CommentReplies } from "@/features/community/CommentReplies";
import { useToast } from "@/contexts/ToastContext";
import { getBlogCategory } from "@/features/community/categories";

function stripMarkdown(input: string): string {
  if (!input) return "";
  return input
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // leading headings ##
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2") // *italic*
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/^\s{0,3}>\s?/gm, "") // > quotes
    .replace(/^\s*[-*]\s+/gm, "• ") // bullets - / * → •
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [text](url)
}

export default function BlogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id ? Number(id) : undefined;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const toast = useToast();
  const postQuery = useBlogPost(postId);
  const commentsQuery = useBlogComments(postId);
  const toggleLike = useToggleBlogLike();
  const toggleBookmark = useToggleBlogBookmark();
  const createComment = useCreateBlogComment();
  const updateComment = useUpdateBlogComment();
  const deleteComment = useDeleteBlogComment();
  const toggleCommentLike = useToggleCommentLike();
  const togglePinComment = useTogglePinComment();
  const deletePost = useDeleteBlogPost();
  const [commentDraft, setCommentDraft] = useState("");
  const [reportTarget, setReportTarget] = useState<{
    type: "blog" | "blog_comment";
    id: number;
  } | null>(null);

  const post = postQuery.data;
  const comments = commentsQuery.data || [];
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const isOwn = !!user && post?.authorId === Number(user.id);
  const isAdminViewer = user?.role === "admin";
  const cat = getBlogCategory(post?.category);

  // Group comments by parent (1-level nesting)
  const topLevelComments = useMemo(() => comments.filter((c) => !c.parentCommentId), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<number, BlogComment[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const arr = map.get(c.parentCommentId) || [];
        arr.push(c);
        map.set(c.parentCommentId, arr);
      }
    }
    return map;
  }, [comments]);

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

  const handleEditComment = useCallback(
    async (commentId: number, content: string) => {
      if (!postId) throw new Error("missing post");
      await updateComment.mutateAsync({ commentId, postId, content });
    },
    [postId, updateComment],
  );

  const handleDeleteComment = useCallback(
    (commentId: number) => {
      if (!postId) return;
      deleteComment.mutate({ commentId, postId });
    },
    [postId, deleteComment],
  );

  const handleReply = useCallback(
    async (parentId: number, body: string) => {
      if (!postId) throw new Error("missing post");
      await createComment.mutateAsync({ postId, content: body, parentCommentId: parentId });
    },
    [postId, createComment],
  );

  // FB/IG-style: replying to a nested reply still goes under the top-level parent,
  // but prefixes the body with @authorName so the conversation thread stays flat (1 level).
  const makeReplyToNested = useCallback(
    (topLevelParentId: number, targetName: string) => async (_replyId: number, body: string) => {
      if (!postId) throw new Error("missing post");
      const marker = `@{${targetName}}`;
      const prefixed = body.startsWith(marker) ? body : `${marker} ${body}`;
      await createComment.mutateAsync({
        postId,
        content: prefixed,
        parentCommentId: topLevelParentId,
      });
    },
    [postId, createComment],
  );

  const handleToggleCommentLike = useCallback(
    (commentId: number) => {
      if (!postId || !user) {
        Alert.alert("", "Vui lòng đăng nhập để thích bình luận");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleCommentLike.mutate({ commentId, postId });
    },
    [postId, user, toggleCommentLike],
  );

  const handleTogglePinComment = useCallback(
    (commentId: number) => {
      if (!postId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      togglePinComment.mutate(
        { commentId, postId },
        {
          onError: (err: any) => Alert.alert("Lỗi", err?.message || "Không ghim được bình luận"),
        },
      );
    },
    [postId, togglePinComment],
  );

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
          {/* Hero image */}
          <View style={styles.heroWrap}>
            {post.coverImage ? (
              <Image source={{ uri: post.coverImage }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, { backgroundColor: colors.inputBg }]} />
            )}
            <LinearGradient
              colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.55)"]}
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
                  <>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/community/blog/create",
                          params: { editId: String(post.postId) },
                        })
                      }
                      style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={handleDeletePost}
                      style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                    </Pressable>
                  </>
                ) : user ? (
                  <Pressable
                    onPress={() => setReportTarget({ type: "blog", id: post.postId })}
                    style={({ pressed }) => [styles.floatBtn, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Ionicons name="flag-outline" size={18} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            </View>
            {/* Title overlay */}
            <View style={styles.titleOverlay}>
              {cat && (
                <View style={[styles.catBadge, { backgroundColor: cat.color }]}>
                  <Ionicons name={cat.icon} size={11} color="#fff" />
                  <Text style={styles.catBadgeText}>{cat.label}</Text>
                </View>
              )}
              <Text style={styles.heroTitle}>{post.title}</Text>
            </View>
          </View>

          {/* Author row — borderless */}
          <Pressable
            onPress={() =>
              router.push({ pathname: "/user/[id]", params: { id: String(post.authorId) } })
            }
            style={({ pressed }) => [styles.authorRow, { opacity: pressed ? 0.85 : 1 }]}
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
                <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>
                  {post.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}
              >
                <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                  {post.authorName}
                </Text>
                <AdminBadge role={post.authorRole} size="small" />
              </View>
              <Text style={[styles.authorMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("vi-VN") : ""}
                {"  ·  "}
                {post.readMinutes ? `${post.readMinutes} phút đọc  ·  ` : ""}
                {post.viewCount} lượt xem
              </Text>
            </View>
          </Pressable>

          {/* Excerpt — italic lead */}
          {post.excerpt && (
            <Text style={[styles.excerpt, { color: colors.textSecondary }]}>
              {stripMarkdown(post.excerpt)}
            </Text>
          )}

          {/* Body content (long-press to copy plain text) */}
          <Pressable
            onLongPress={async () => {
              await Clipboard.setStringAsync(stripMarkdown(post.content || ""));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toast.show("Đã sao chép bài viết vào bộ nhớ tạm", "success");
            }}
            delayLongPress={350}
            android_disableSound
          >
            <Text style={[styles.content, { color: colors.text }]}>
              {stripMarkdown(post.content || "")}
            </Text>
          </Pressable>

          {/* Destinations linked — chips inline */}
          {post.destinationsList.length > 0 && (
            <View style={styles.chipsBlock}>
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
                    { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" },
                  ]}
                >
                  <Ionicons name="location" size={11} color={colors.primary} />
                  <Text style={[styles.destChipText, { color: colors.primary }]}>{d.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <View style={styles.chipsBlock}>
              {post.tags.map((t) => (
                <Text key={t.tagId} style={[styles.hashTag, { color: t.color || colors.primary }]}>
                  #{t.name}
                </Text>
              ))}
            </View>
          )}

          {/* Inline reaction row — IG/Threads style */}
          <View
            style={[
              styles.reactionRow,
              { borderTopColor: colors.divider, borderBottomColor: colors.divider },
            ]}
          >
            <Pressable onPress={handleLike} style={styles.reactBtn} hitSlop={6}>
              <Ionicons
                name={post.isLikedByViewer ? "heart" : "heart-outline"}
                size={22}
                color={post.isLikedByViewer ? "#EF4444" : colors.text}
              />
              <Text style={[styles.reactCount, { color: colors.text }]}>{post.likeCount}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                /* scroll-to-comments would go here; minimal for now */
              }}
              style={styles.reactBtn}
              hitSlop={6}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
              <Text style={[styles.reactCount, { color: colors.text }]}>{post.commentCount}</Text>
            </Pressable>
            <Pressable onPress={handleBookmark} style={styles.reactBtn} hitSlop={6}>
              <Ionicons
                name={post.isBookmarkedByViewer ? "bookmark" : "bookmark-outline"}
                size={20}
                color={post.isBookmarkedByViewer ? colors.primary : colors.text}
              />
              <Text style={[styles.reactCount, { color: colors.text }]}>{post.bookmarkCount}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <View style={styles.viewMeta}>
              <Ionicons name="eye-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.viewMetaText, { color: colors.textTertiary }]}>
                {post.viewCount}
              </Text>
            </View>
          </View>

          {/* Comments */}
          <View style={styles.commentsSection}>
            <Text style={[styles.commentsTitle, { color: colors.text }]}>
              Bình luận{" "}
              <Text style={{ color: colors.textTertiary, fontFamily: "Inter_500Medium" }}>
                {comments.length}
              </Text>
            </Text>
            {topLevelComments.length === 0 ? (
              <Text style={[styles.commentsEmpty, { color: colors.textTertiary }]}>
                Hãy là người đầu tiên bình luận
              </Text>
            ) : (
              <View>
                {topLevelComments.map((c) => {
                  const replies = repliesByParent.get(c.commentId) || [];
                  return (
                    <CommentItem
                      key={c.commentId}
                      comment={c}
                      colors={colors}
                      currentUserId={user?.id}
                      isAdminViewer={isAdminViewer}
                      postAuthorId={post.authorId}
                      onEdit={handleEditComment}
                      onDelete={handleDeleteComment}
                      onReply={user ? handleReply : undefined}
                      onReport={
                        user
                          ? (commentId) => setReportTarget({ type: "blog_comment", id: commentId })
                          : undefined
                      }
                      onToggleLike={handleToggleCommentLike}
                      onTogglePin={isOwn ? handleTogglePinComment : undefined}
                      canPin={isOwn}
                    >
                      {replies.length > 0 && (
                        <CommentReplies
                          count={replies.length}
                          colors={colors}
                          renderVisible={(limit) =>
                            (limit ? replies.slice(0, limit) : replies).map((r) => (
                              <CommentItem
                                key={r.commentId}
                                comment={r}
                                colors={colors}
                                currentUserId={user?.id}
                                isAdminViewer={isAdminViewer}
                                postAuthorId={post.authorId}
                                onEdit={handleEditComment}
                                onDelete={handleDeleteComment}
                                onReply={
                                  user ? makeReplyToNested(c.commentId, r.authorName) : undefined
                                }
                                onReport={
                                  user
                                    ? (commentId) =>
                                        setReportTarget({ type: "blog_comment", id: commentId })
                                    : undefined
                                }
                                onToggleLike={handleToggleCommentLike}
                                nested
                              />
                            ))
                          }
                        />
                      )}
                    </CommentItem>
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

      {reportTarget && (
        <ReportSheet
          visible
          onClose={() => setReportTarget(null)}
          contentType={reportTarget.type}
          contentRefId={reportTarget.id}
        />
      )}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  catBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
    lineHeight: 32,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  authorAvatar: { width: 44, height: 44, borderRadius: 22 },
  authorName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  authorMeta: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },

  excerpt: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 20,
    lineHeight: 24,
    fontStyle: "italic",
    marginBottom: 14,
  },
  content: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    lineHeight: 24,
    marginBottom: 16,
  },

  chipsBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
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
  hashTag: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reactBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  reactCount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  viewMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewMetaText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  commentsSection: { paddingHorizontal: 20, paddingTop: 14 },
  commentsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 16 },
  commentsEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    paddingVertical: 10,
  },

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
