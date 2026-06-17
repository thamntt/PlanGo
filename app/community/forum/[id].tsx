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
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  useForumThread,
  useForumReplies,
  useCreateForumReply,
  useUpdateForumThread,
  useUpdateForumReply,
  useVoteThread,
  useVoteReply,
  useVotePoll,
  useAcceptReply,
  useDeleteForumThread,
  useDeleteForumReply,
  type ForumReply,
} from "@/hooks/queries/use-forum";
import { ReportSheet } from "@/features/community/ReportSheet";
import { AdminBadge } from "@/features/community/AdminBadge";
import { ForumReplyItem } from "@/features/community/ForumReplyItem";
import { CommentReplies } from "@/features/community/CommentReplies";
import { CommentActionSheet, type ActionItem } from "@/features/community/CommentActionSheet";
import { PollBlock } from "@/features/community/PollBlock";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { getForumCategory } from "@/features/community/categories";

const EDIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function stripMarkdown(input: string): string {
  if (!input) return "";
  return input
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = id ? Number(id) : undefined;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const threadQuery = useForumThread(threadId);
  const repliesQuery = useForumReplies(threadId);
  const createReply = useCreateForumReply();
  const updateThread = useUpdateForumThread();
  const updateReply = useUpdateForumReply();
  const voteThread = useVoteThread();
  const voteReply = useVoteReply();
  const votePoll = useVotePoll();
  const acceptReply = useAcceptReply();
  const deleteThread = useDeleteForumThread();
  const deleteReply = useDeleteForumReply();
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: "forum_thread" | "forum_reply";
    id: number;
  } | null>(null);
  const [editingThread, setEditingThread] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingThread, setSavingThread] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);

  const thread = threadQuery.data;
  const replies = repliesQuery.data || [];
  const isOwn = !!user && thread?.authorId === Number(user.id);
  const isAdminViewer = user?.role === "admin";
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const cat = getForumCategory(thread?.category);
  const isSolved = thread?.status === "solved";
  const threadEditable = useMemo(() => {
    if (!thread || !isOwn || isSolved) return false;
    const age = Date.now() - new Date(thread.createdAt).getTime();
    return age < EDIT_WINDOW_MS;
  }, [thread, isOwn, isSolved]);
  const threadEdited = !!thread?.updatedAt;

  // Group replies — top-level + nested
  const topLevelReplies = useMemo(() => replies.filter((r) => !r.parentReplyId), [replies]);
  const childrenByParent = useMemo(() => {
    const map = new Map<number, ForumReply[]>();
    for (const r of replies) {
      if (r.parentReplyId) {
        const arr = map.get(r.parentReplyId) || [];
        arr.push(r);
        map.set(r.parentReplyId, arr);
      }
    }
    return map;
  }, [replies]);

  const handleVoteThread = useCallback(
    (voteType: "up" | "down") => {
      if (!threadId || !user || !thread) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const current = thread.myVote;
      const newVote = current === voteType ? "clear" : voteType;
      voteThread.mutate({ threadId, voteType: newVote });
    },
    [threadId, user, thread, voteThread],
  );

  const handleVoteReply = useCallback(
    (reply: ForumReply, voteType: "up" | "down") => {
      if (!threadId || !user) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const current = reply.myVote;
      const newVote = current === voteType ? "clear" : voteType;
      voteReply.mutate({ replyId: reply.replyId, threadId, voteType: newVote });
    },
    [threadId, user, voteReply],
  );

  const handleSubmitReply = useCallback(async () => {
    const text = draft.trim();
    if (!text || !threadId || !user) return;
    try {
      await createReply.mutateAsync({ threadId, body: text });
      setDraft("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không gửi được trả lời");
    }
  }, [draft, threadId, user, createReply]);

  const handleAccept = useCallback(
    (replyId: number) => {
      if (!threadId) return;
      acceptReply.mutate(
        { threadId, replyId },
        {
          onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        },
      );
    },
    [threadId, acceptReply],
  );

  const handleEditReply = useCallback(
    async (replyId: number, body: string) => {
      if (!threadId) throw new Error("missing thread");
      await updateReply.mutateAsync({ replyId, threadId, body });
    },
    [threadId, updateReply],
  );

  const handleDeleteReply = useCallback(
    (replyId: number) => {
      if (!threadId) return;
      deleteReply.mutate({ replyId, threadId });
    },
    [threadId, deleteReply],
  );

  const handleReplyToReply = useCallback(
    async (parentId: number, body: string) => {
      if (!threadId) throw new Error("missing thread");
      await createReply.mutateAsync({ threadId, body, parentReplyId: parentId });
    },
    [threadId, createReply],
  );

  // FB/IG-style: nested reply targets the top-level parent + @mentions the user.
  const makeReplyToNestedReply = useCallback(
    (topLevelParentId: number, targetName: string) => async (_replyId: number, body: string) => {
      if (!threadId) throw new Error("missing thread");
      const marker = `@{${targetName}}`;
      const prefixed = body.startsWith(marker) ? body : `${marker} ${body}`;
      await createReply.mutateAsync({
        threadId,
        body: prefixed,
        parentReplyId: topLevelParentId,
      });
    },
    [threadId, createReply],
  );

  const handleDeleteThread = useCallback(async () => {
    if (!threadId) return;
    const ok = await confirm({
      title: "Xóa câu hỏi?",
      message: "Câu hỏi và mọi câu trả lời sẽ bị xóa vĩnh viễn.",
      destructive: true,
      confirmText: "Xóa",
    });
    if (!ok) return;
    try {
      await deleteThread.mutateAsync(threadId);
      router.back();
    } catch {}
  }, [threadId, deleteThread, confirm]);

  const startEditThread = useCallback(() => {
    if (!thread) return;
    setEditTitle(thread.title);
    setEditBody(thread.body);
    setEditingThread(true);
  }, [thread]);

  const saveThreadEdit = useCallback(async () => {
    if (!threadId || !thread) return;
    const title = editTitle.trim();
    const body = editBody.trim();
    if (!title || !body) {
      Alert.alert("Lỗi", "Tiêu đề và nội dung không được trống");
      return;
    }
    if (title === thread.title && body === thread.body) {
      setEditingThread(false);
      return;
    }
    setSavingThread(true);
    try {
      await updateThread.mutateAsync({ threadId, input: { title, body } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingThread(false);
    } catch (err: any) {
      Alert.alert("Không sửa được", err?.message || "Đã xảy ra lỗi");
    } finally {
      setSavingThread(false);
    }
  }, [threadId, thread, editTitle, editBody, updateThread]);

  if (threadQuery.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!thread) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Không tìm thấy câu hỏi</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)/community")
            }
            style={({ pressed }) => [
              styles.headerBtn,
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Câu hỏi</Text>
          {(isOwn || user) && !editingThread ? (
            <Pressable
              onPress={() => setThreadMenuOpen(true)}
              style={({ pressed }) => [
                styles.headerBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              hitSlop={6}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Tags row (above title) */}
          <View style={styles.tagsRow}>
            {cat && (
              <View style={[styles.tagChip, { backgroundColor: cat.color + "1A" }]}>
                <Ionicons name={cat.icon} size={11} color={cat.color} />
                <Text style={[styles.tagText, { color: cat.color }]}>{cat.label}</Text>
              </View>
            )}
            {thread.destinationName && (
              <Pressable
                onPress={() =>
                  thread.destinationId
                    ? router.push({
                        pathname: "/destination/[id]",
                        params: { id: String(thread.destinationId) },
                      })
                    : null
                }
                style={[styles.tagChip, { backgroundColor: colors.inputBg }]}
              >
                <Ionicons name="location" size={10} color={colors.textSecondary} />
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {thread.destinationName}
                </Text>
              </Pressable>
            )}
            {isSolved && (
              <View style={[styles.tagChip, { backgroundColor: "#10B981" }]}>
                <Ionicons name="checkmark-circle" size={11} color="#fff" />
                <Text style={[styles.tagText, { color: "#fff" }]}>Đã giải đáp</Text>
              </View>
            )}
          </View>

          {/* Title + body OR edit form */}
          {editingThread ? (
            <View style={styles.editThreadBlock}>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Tiêu đề"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.editThreadTitle,
                  {
                    color: colors.text,
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.inputBg,
                  },
                ]}
              />
              <TextInput
                value={editBody}
                onChangeText={setEditBody}
                placeholder="Nội dung câu hỏi"
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[
                  styles.editThreadBody,
                  {
                    color: colors.text,
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.inputBg,
                  },
                ]}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                <Pressable
                  onPress={() => setEditingThread(false)}
                  disabled={savingThread}
                  style={({ pressed }) => [
                    styles.editBtn,
                    { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.editBtnText, { color: colors.text }]}>Hủy</Text>
                </Pressable>
                <Pressable
                  onPress={saveThreadEdit}
                  disabled={savingThread}
                  style={({ pressed }) => [
                    styles.editBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed || savingThread ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.editBtnText, { color: "#fff" }]}>
                    {savingThread ? "..." : "Lưu"}
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.editHint, { color: colors.textTertiary }]}>
                * Câu hỏi chỉ được sửa trong 1 tiếng đầu hoặc trước khi có câu trả lời được chọn.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.threadTitle, { color: colors.text }]}>{thread.title}</Text>
              <Pressable
                onLongPress={async () => {
                  await Clipboard.setStringAsync(stripMarkdown(thread.body));
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  toast.show("Đã sao chép câu hỏi vào bộ nhớ tạm", "success");
                }}
                delayLongPress={350}
                android_disableSound
              >
                <Text style={[styles.threadBody, { color: colors.text }]}>
                  {stripMarkdown(thread.body)}
                </Text>
              </Pressable>
            </>
          )}

          {/* Author row — borderless */}
          <Pressable
            onPress={() =>
              router.push({ pathname: "/user/[id]", params: { id: String(thread.authorId) } })
            }
            style={({ pressed }) => [styles.authorBar, { opacity: pressed ? 0.85 : 1 }]}
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
                  {
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" }}>
                  {thread.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                  {thread.authorName}
                </Text>
                <AdminBadge role={thread.authorRole} size="small" />
              </View>
              <Text style={[styles.authorTime, { color: colors.textTertiary }]} numberOfLines={1}>
                {new Date(thread.createdAt).toLocaleDateString("vi-VN")}
                {"  ·  "}
                {thread.viewCount} lượt xem
                {threadEdited && "  ·  đã chỉnh sửa"}
              </Text>
            </View>
          </Pressable>

          {/* Poll (optional) */}
          {thread.poll && (
            <PollBlock
              poll={thread.poll}
              colors={colors}
              isAuthenticated={!!user}
              onLoginRequired={() => toast.show("Vui lòng đăng nhập để bỏ phiếu", "info")}
              onVote={(optionId) =>
                votePoll.mutate(
                  { pollId: thread.poll!.pollId, optionId, threadId: thread.threadId },
                  {
                    onError: (err: any) =>
                      toast.show(err?.message || "Không bỏ phiếu được", "error"),
                  },
                )
              }
            />
          )}

          {/* Inline thread reaction row — icon + count */}
          <View
            style={[
              styles.reactionRow,
              { borderTopColor: colors.divider, borderBottomColor: colors.divider },
            ]}
          >
            <Pressable onPress={() => handleVoteThread("up")} style={styles.reactBtn} hitSlop={6}>
              <Ionicons
                name={thread.myVote === "up" ? "arrow-up-circle" : "arrow-up-circle-outline"}
                size={22}
                color={thread.myVote === "up" ? "#10B981" : colors.text}
              />
              <Text style={[styles.reactCount, { color: colors.text }]}>{thread.upvotes}</Text>
            </Pressable>
            <Pressable onPress={() => handleVoteThread("down")} style={styles.reactBtn} hitSlop={6}>
              <Ionicons
                name={thread.myVote === "down" ? "arrow-down-circle" : "arrow-down-circle-outline"}
                size={22}
                color={thread.myVote === "down" ? "#EF4444" : colors.text}
              />
              <Text style={[styles.reactCount, { color: colors.text }]}>{thread.downvotes}</Text>
            </Pressable>
            <View style={styles.reactBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
              <Text style={[styles.reactCount, { color: colors.text }]}>{thread.replyCount}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.viewMeta}>
              <Ionicons name="eye-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.viewMetaText, { color: colors.textTertiary }]}>
                {thread.viewCount}
              </Text>
            </View>
          </View>

          {/* Replies */}
          <View style={styles.repliesSection}>
            <View style={styles.repliesHeader}>
              <Text style={[styles.repliesTitle, { color: colors.text }]}>
                {replies.length} câu trả lời
              </Text>
              {isOwn && replies.length > 0 && !thread.acceptedReplyId && (
                <View style={styles.hintBadge}>
                  <Ionicons name="bulb-outline" size={11} color="#10B981" />
                  <Text style={styles.hintText}>Chọn 1 câu trả lời đúng nhất</Text>
                </View>
              )}
            </View>
            {topLevelReplies.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>
                Chưa có ai trả lời. Hãy là người đầu tiên!
              </Text>
            ) : (
              <View>
                {topLevelReplies.map((r) => {
                  const children = childrenByParent.get(r.replyId) || [];
                  const isAccepted = thread.acceptedReplyId === r.replyId;
                  return (
                    <ForumReplyItem
                      key={r.replyId}
                      reply={r}
                      colors={colors}
                      currentUserId={user?.id}
                      isThreadAuthor={isOwn}
                      isAdminViewer={isAdminViewer}
                      isAccepted={isAccepted}
                      threadAuthorId={thread.authorId}
                      onVote={(vt) => handleVoteReply(r, vt)}
                      onEdit={handleEditReply}
                      onDelete={handleDeleteReply}
                      onReply={user ? handleReplyToReply : undefined}
                      onAccept={!isAccepted ? () => handleAccept(r.replyId) : undefined}
                      onUnaccept={isAccepted ? () => handleAccept(r.replyId) : undefined}
                      onReport={
                        user
                          ? (replyId) => {
                              setReportTarget({ type: "forum_reply", id: replyId });
                              setReportOpen(true);
                            }
                          : undefined
                      }
                    >
                      {children.length > 0 && (
                        <CommentReplies
                          count={children.length}
                          colors={colors}
                          renderVisible={(limit) =>
                            (limit ? children.slice(0, limit) : children).map((child) => (
                              <ForumReplyItem
                                key={child.replyId}
                                reply={child}
                                colors={colors}
                                currentUserId={user?.id}
                                isThreadAuthor={isOwn}
                                isAdminViewer={isAdminViewer}
                                threadAuthorId={thread.authorId}
                                onVote={(vt) => handleVoteReply(child, vt)}
                                onEdit={handleEditReply}
                                onDelete={handleDeleteReply}
                                onReply={
                                  user
                                    ? makeReplyToNestedReply(r.replyId, child.authorName)
                                    : undefined
                                }
                                onReport={
                                  user
                                    ? (replyId) => {
                                        setReportTarget({ type: "forum_reply", id: replyId });
                                        setReportOpen(true);
                                      }
                                    : undefined
                                }
                                nested
                              />
                            ))
                          }
                        />
                      )}
                    </ForumReplyItem>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Reply input bar */}
        {user && (
          <View
            style={[
              styles.replyInputBar,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.divider,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
              },
            ]}
          >
            <View
              style={[
                styles.replyInputBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Viết câu trả lời..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[styles.replyInput, { color: colors.text }]}
              />
              <Pressable
                onPress={handleSubmitReply}
                disabled={!draft.trim() || createReply.isPending}
                hitSlop={6}
              >
                {createReply.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={draft.trim() ? colors.primary : colors.textTertiary}
                  />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {reportTarget && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => {
            setReportOpen(false);
            setReportTarget(null);
          }}
          contentType={reportTarget.type}
          contentRefId={reportTarget.id}
        />
      )}

      <CommentActionSheet
        visible={threadMenuOpen}
        onClose={() => setThreadMenuOpen(false)}
        colors={colors}
        actions={(() => {
          const items: ActionItem[] = [];
          items.push({
            key: "copy",
            label: "Sao chép",
            icon: "copy-outline",
            onPress: async () => {
              await Clipboard.setStringAsync(stripMarkdown(thread.body));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toast.show("Đã sao chép câu hỏi vào bộ nhớ tạm", "success");
            },
          });
          if (threadEditable) {
            items.push({
              key: "edit",
              label: "Sửa câu hỏi",
              icon: "create-outline",
              onPress: startEditThread,
            });
          }
          if (!isOwn && user) {
            items.push({
              key: "report",
              label: "Báo cáo",
              icon: "flag-outline",
              onPress: () => {
                setReportTarget({ type: "forum_thread", id: thread.threadId });
                setReportOpen(true);
              },
            });
          }
          if (isOwn) {
            items.push({
              key: "delete",
              label: "Xóa câu hỏi",
              icon: "trash-outline",
              destructive: true,
              onPress: handleDeleteThread,
            });
          }
          return items;
        })()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 10,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  threadTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  threadBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    paddingHorizontal: 20,
    marginBottom: 14,
  },

  editThreadBlock: { paddingHorizontal: 20, gap: 10, marginBottom: 14 },
  editThreadTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  editThreadBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: "top",
  },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  editHint: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },

  authorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 12,
  },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  authorTime: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },

  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reactBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  reactCount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  viewMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewMetaText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  repliesSection: { paddingHorizontal: 20, marginTop: 14 },
  repliesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  repliesTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  hintBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B98114",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hintText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  empty: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", paddingVertical: 10 },

  replyInputBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyInputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  replyInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0, maxHeight: 90 },
});
