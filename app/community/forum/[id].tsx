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
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import {
  useForumThread,
  useForumReplies,
  useCreateForumReply,
  useVoteThread,
  useVoteReply,
  useAcceptReply,
  useDeleteForumThread,
  useDeleteForumReply,
  type ForumReply,
} from "@/hooks/queries/use-forum";
import { ReportSheet } from "@/features/community/ReportSheet";
import { AdminBadge } from "@/features/community/AdminBadge";

const CAT_LABEL: Record<string, string> = {
  question: "Câu hỏi",
  discussion: "Thảo luận",
  tip: "Mẹo",
  recommendation: "Gợi ý",
};
const CAT_COLOR: Record<string, string> = {
  question: "#3B82F6",
  discussion: "#A855F7",
  tip: "#10B981",
  recommendation: "#F59E0B",
};

type ThemeColors = ReturnType<typeof useThemeColors>;

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = id ? Number(id) : undefined;
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const threadQuery = useForumThread(threadId);
  const repliesQuery = useForumReplies(threadId);
  const createReply = useCreateForumReply();
  const voteThread = useVoteThread();
  const voteReply = useVoteReply();
  const acceptReply = useAcceptReply();
  const deleteThread = useDeleteForumThread();
  const deleteReply = useDeleteForumReply();
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: "forum_thread" | "forum_reply";
    id: number;
  } | null>(null);

  const thread = threadQuery.data;
  const replies = repliesQuery.data || [];
  const isOwn = !!user && thread?.authorId === Number(user.id);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

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

  const handleDeleteThread = useCallback(() => {
    if (!threadId) return;
    const doDel = async () => {
      try {
        await deleteThread.mutateAsync(threadId);
        router.back();
      } catch {}
    };
    if (Platform.OS === "web") {
      if (confirm("Xóa câu hỏi này?")) doDel();
    } else {
      Alert.alert("Xóa câu hỏi", "Câu hỏi sẽ bị xóa vĩnh viễn", [
        { text: "Hủy", style: "cancel" },
        { text: "Xóa", style: "destructive", onPress: doDel },
      ]);
    }
  }, [threadId, deleteThread]);

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

  const catColor = CAT_COLOR[thread.category || ""] || colors.primary;
  const isSolved = thread.status === "solved";

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
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Câu hỏi</Text>
          {isOwn ? (
            <Pressable
              onPress={handleDeleteThread}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </Pressable>
          ) : user ? (
            <Pressable
              onPress={() => {
                setReportTarget({ type: "forum_thread", id: thread.threadId });
                setReportOpen(true);
              }}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="flag-outline" size={16} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Thread card */}
          <View
            style={[
              styles.threadCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {/* Tags row */}
            <View style={styles.tagsRow}>
              {thread.category && (
                <View style={[styles.tagChip, { backgroundColor: catColor + "1A" }]}>
                  <Text style={[styles.tagText, { color: catColor }]}>
                    {CAT_LABEL[thread.category] || thread.category}
                  </Text>
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

            <Text style={[styles.threadTitle, { color: colors.text }]}>{thread.title}</Text>
            <Text style={[styles.threadBody, { color: colors.text }]}>{thread.body}</Text>

            {/* Author bar */}
            <Pressable
              onPress={() =>
                router.push({ pathname: "/user/[id]", params: { id: String(thread.authorId) } })
              }
              style={({ pressed }) => [styles.authorBar, { opacity: pressed ? 0.9 : 1 }]}
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
                  <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" }}>
                    {thread.authorName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.authorName, { color: colors.text }]}>
                    {thread.authorName}
                  </Text>
                  <AdminBadge role={thread.authorRole} size="small" />
                </View>
                <Text style={[styles.authorTime, { color: colors.textTertiary }]}>
                  {new Date(thread.createdAt).toLocaleDateString("vi-VN")} · {thread.viewCount} lượt
                  xem
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </Pressable>

            {/* Vote bar — explicit labels (Hữu ích / Không hữu ích) */}
            <View style={styles.voteBar}>
              <Pressable
                onPress={() => handleVoteThread("up")}
                style={({ pressed }) => [
                  styles.voteBtnLabeled,
                  {
                    backgroundColor: thread.myVote === "up" ? "#10B981" : colors.inputBg,
                    borderColor: thread.myVote === "up" ? "#10B981" : colors.cardBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                hitSlop={4}
              >
                <Ionicons
                  name="arrow-up"
                  size={15}
                  color={thread.myVote === "up" ? "#fff" : "#10B981"}
                />
                <Text
                  style={[
                    styles.voteBtnLabel,
                    { color: thread.myVote === "up" ? "#fff" : "#10B981" },
                  ]}
                >
                  Hữu ích
                </Text>
                <Text
                  style={[
                    styles.voteBtnCount,
                    { color: thread.myVote === "up" ? "#fff" : colors.text },
                  ]}
                >
                  {thread.upvotes}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleVoteThread("down")}
                style={({ pressed }) => [
                  styles.voteBtnLabeled,
                  {
                    backgroundColor: thread.myVote === "down" ? "#EF4444" : colors.inputBg,
                    borderColor: thread.myVote === "down" ? "#EF4444" : colors.cardBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                hitSlop={4}
              >
                <Ionicons
                  name="arrow-down"
                  size={15}
                  color={thread.myVote === "down" ? "#fff" : "#EF4444"}
                />
                <Text
                  style={[
                    styles.voteBtnLabel,
                    { color: thread.myVote === "down" ? "#fff" : "#EF4444" },
                  ]}
                >
                  Phản đối
                </Text>
                <Text
                  style={[
                    styles.voteBtnCount,
                    { color: thread.myVote === "down" ? "#fff" : colors.text },
                  ]}
                >
                  {thread.downvotes}
                </Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Ionicons name="chatbubble-ellipses" size={14} color={colors.textTertiary} />
              <Text style={[styles.replyCount, { color: colors.textTertiary }]}>
                {thread.replyCount} trả lời
              </Text>
            </View>
          </View>

          {/* Replies section */}
          <View style={styles.repliesSection}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={[styles.repliesTitle, { color: colors.text, marginBottom: 0 }]}>
                {replies.length} câu trả lời
              </Text>
              {isOwn && replies.length > 0 && !thread.acceptedReplyId && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#10B981" + "14",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="bulb-outline" size={11} color="#10B981" />
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#10B981" }}>
                    Chọn 1 câu trả lời đúng nhất
                  </Text>
                </View>
              )}
            </View>
            {replies.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textTertiary }]}>
                Chưa có ai trả lời. Hãy là người đầu tiên!
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {replies.map((r) => {
                  const isOwnReply = !!user && r.authorId === Number(user.id);
                  const isAccepted = thread.acceptedReplyId === r.replyId;
                  return (
                    <View
                      key={r.replyId}
                      style={[
                        styles.replyCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: isAccepted ? "#10B981" : colors.cardBorder,
                          borderWidth: isAccepted ? 2 : 1,
                        },
                      ]}
                    >
                      {isAccepted && (
                        <Pressable
                          onPress={() =>
                            Alert.alert(
                              "Câu trả lời được chọn",
                              "Chủ thớt đã đánh dấu đây là câu trả lời giải quyết được vấn đề. Người sau xem có thể nhanh chóng tìm thấy lời giải đáng tin nhất.",
                            )
                          }
                          style={styles.acceptedBadge}
                          hitSlop={4}
                        >
                          <Ionicons name="checkmark-circle" size={11} color="#fff" />
                          <Text style={styles.acceptedText}>Câu trả lời được chọn</Text>
                          <Ionicons name="information-circle-outline" size={11} color="#fff" />
                        </Pressable>
                      )}
                      <View style={styles.replyHeader}>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/user/[id]",
                              params: { id: String(r.authorId) },
                            })
                          }
                          hitSlop={4}
                        >
                          {r.authorAvatar ? (
                            <Image
                              source={{ uri: r.authorAvatar }}
                              style={styles.replyAvatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.replyAvatar,
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
                                {r.authorName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Text style={[styles.replyAuthor, { color: colors.text }]}>
                              {r.authorName}
                            </Text>
                            <AdminBadge role={(r as any).authorRole} size="tiny" />
                          </View>
                          <Text style={[styles.replyTime, { color: colors.textTertiary }]}>
                            {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                          </Text>
                        </View>
                        {isOwnReply && (
                          <Pressable
                            onPress={() =>
                              deleteReply.mutate({ replyId: r.replyId, threadId: threadId! })
                            }
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                          </Pressable>
                        )}
                      </View>
                      <Text style={[styles.replyBody, { color: colors.text }]}>{r.body}</Text>
                      <View style={styles.replyActions}>
                        <View style={styles.replyVote}>
                          <Pressable
                            onPress={() => handleVoteReply(r, "up")}
                            style={({ pressed }) => [
                              styles.smallVoteBtnLabeled,
                              {
                                backgroundColor: r.myVote === "up" ? "#10B981" : colors.inputBg,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                            hitSlop={4}
                          >
                            <Ionicons
                              name="arrow-up"
                              size={12}
                              color={r.myVote === "up" ? "#fff" : "#10B981"}
                            />
                            <Text
                              style={[
                                styles.smallVoteLabel,
                                { color: r.myVote === "up" ? "#fff" : colors.text },
                              ]}
                            >
                              {r.upvotes}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleVoteReply(r, "down")}
                            style={({ pressed }) => [
                              styles.smallVoteBtnLabeled,
                              {
                                backgroundColor: r.myVote === "down" ? "#EF4444" : colors.inputBg,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                            hitSlop={4}
                          >
                            <Ionicons
                              name="arrow-down"
                              size={12}
                              color={r.myVote === "down" ? "#fff" : "#EF4444"}
                            />
                            <Text
                              style={[
                                styles.smallVoteLabel,
                                { color: r.myVote === "down" ? "#fff" : colors.text },
                              ]}
                            >
                              {r.downvotes}
                            </Text>
                          </Pressable>
                        </View>
                        {/* Owner can accept/un-accept best answer */}
                        {isOwn && !isAccepted && (
                          <Pressable
                            onPress={() => handleAccept(r.replyId)}
                            style={({ pressed }) => [
                              styles.acceptBtn,
                              {
                                borderColor: "#10B981",
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
                            <Text style={[styles.acceptBtnText, { color: "#10B981" }]}>
                              Chọn làm câu trả lời
                            </Text>
                          </Pressable>
                        )}
                        {isOwn && isAccepted && (
                          <Pressable
                            onPress={() => {
                              const doUnaccept = () => handleAccept(r.replyId);
                              if (Platform.OS === "web") {
                                if (confirm("Bỏ chọn câu trả lời này?")) doUnaccept();
                              } else {
                                Alert.alert(
                                  "Bỏ chọn câu trả lời",
                                  "Bạn có chắc muốn bỏ chọn câu trả lời này? Thread sẽ chuyển về trạng thái 'Đang mở'.",
                                  [
                                    { text: "Hủy", style: "cancel" },
                                    { text: "Bỏ chọn", style: "destructive", onPress: doUnaccept },
                                  ],
                                );
                              }
                            }}
                            style={({ pressed }) => [
                              styles.acceptBtn,
                              {
                                borderColor: colors.textTertiary,
                                opacity: pressed ? 0.85 : 1,
                              },
                            ]}
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={13}
                              color={colors.textSecondary}
                            />
                            <Text style={[styles.acceptBtnText, { color: colors.textSecondary }]}>
                              Bỏ chọn
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
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
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },

  threadCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  threadTitle: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 24 },
  threadBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },

  authorBar: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18 },
  authorName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  authorTime: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },

  voteBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  voteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  voteBtnLabeled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  voteBtnLabel: { fontSize: 11, fontFamily: "Inter_700Bold" },
  voteBtnCount: { fontSize: 12, fontFamily: "Inter_700Bold", marginLeft: 2 },
  voteCount: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 28, textAlign: "center" },
  replyCount: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  repliesSection: { paddingHorizontal: 16, marginTop: 18 },
  repliesTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 12 },
  empty: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", paddingVertical: 10 },

  replyCard: { padding: 12, borderRadius: 12, gap: 8 },
  acceptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  acceptedText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  replyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  replyAvatar: { width: 32, height: 32, borderRadius: 16 },
  replyAuthor: { fontSize: 12, fontFamily: "Inter_700Bold" },
  replyTime: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 1 },
  replyBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  replyActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  replyVote: { flexDirection: "row", alignItems: "center", gap: 6 },
  smallVoteBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  smallVoteCount: { fontSize: 12, fontFamily: "Inter_700Bold", minWidth: 18, textAlign: "center" },
  smallVoteBtnLabeled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  smallVoteLabel: { fontSize: 11, fontFamily: "Inter_700Bold" },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  acceptBtnText: { fontSize: 11, fontFamily: "Inter_700Bold" },

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
