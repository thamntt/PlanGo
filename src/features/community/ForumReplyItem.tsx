import React, { useState, useCallback } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import type { useThemeColors } from "@/constants/colors";
import { AdminBadge } from "./AdminBadge";
import { CommentActionSheet, type ActionItem } from "./CommentActionSheet";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";

type ThemeColors = ReturnType<typeof useThemeColors>;

export interface ReplyLike {
  replyId: number;
  authorId: number;
  authorName: string;
  authorAvatar?: string | null;
  authorRole?: string | null;
  body: string;
  upvotes: number;
  downvotes: number;
  myVote: string | null;
  createdAt: string;
  updatedAt?: string | null;
  parentReplyId?: number | null;
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

export function ForumReplyItem({
  reply,
  colors,
  currentUserId,
  isThreadAuthor,
  isAdminViewer,
  isAccepted,
  threadAuthorId,
  onVote,
  onEdit,
  onDelete,
  onReply,
  onAccept,
  onUnaccept,
  onReport,
  nested = false,
  children,
}: {
  reply: ReplyLike;
  colors: ThemeColors;
  currentUserId?: string;
  isThreadAuthor?: boolean;
  isAdminViewer?: boolean;
  isAccepted?: boolean;
  threadAuthorId?: number;
  onVote: (voteType: "up" | "down") => void;
  onEdit: (replyId: number, body: string) => Promise<void>;
  onDelete: (replyId: number) => void;
  onReply?: (parentId: number, body: string) => Promise<void>;
  onAccept?: () => void;
  onUnaccept?: () => void;
  onReport?: (replyId: number) => void;
  nested?: boolean;
  children?: React.ReactNode;
}) {
  const isByThreadAuthor = !!threadAuthorId && reply.authorId === threadAuthorId;

  const parsedReplyTarget = (() => {
    const braced = reply.body.match(/^@\{([^}]+)\}\s+/);
    if (braced) return { target: braced[1], body: reply.body.slice(braced[0].length) };
    const plain = reply.body.match(/^@(\S+)\s+/);
    if (plain) return { target: plain[1], body: reply.body.slice(plain[0].length) };
    return { target: null as string | null, body: reply.body };
  })();
  const initialDraft = parsedReplyTarget.body;
  const isOwn = !!currentUserId && reply.authorId === Number(currentUserId);
  const canEdit = isOwn;
  const canDelete = isOwn || isAdminViewer;
  const isEdited = !!reply.updatedAt;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();
  const { confirm } = useConfirm();

  const handleSaveEdit = useCallback(async () => {
    const text = draft.trim();
    const finalText = parsedReplyTarget.target ? `@{${parsedReplyTarget.target}} ${text}` : text;
    if (!text || finalText === reply.body) {
      setEditing(false);
      setDraft(initialDraft);
      return;
    }
    setSaving(true);
    try {
      await onEdit(reply.replyId, finalText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }, [draft, reply.body, reply.replyId, onEdit, parsedReplyTarget.target, initialDraft]);

  const handleSendReply = useCallback(async () => {
    if (!onReply) return;
    const text = replyDraft.trim();
    if (!text) return;
    setPostingReply(true);
    try {
      await onReply(reply.replyId, text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyDraft("");
      setReplying(false);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không gửi được");
    } finally {
      setPostingReply(false);
    }
  }, [replyDraft, reply.replyId, onReply]);

  const confirmDelete = useCallback(async () => {
    const ok = await confirm({
      title: "Xóa câu trả lời?",
      message: "Câu trả lời sẽ bị xóa vĩnh viễn.",
      destructive: true,
      confirmText: "Xóa",
    });
    if (ok) onDelete(reply.replyId);
  }, [reply.replyId, onDelete, confirm]);

  const handleUnacceptPress = useCallback(async () => {
    if (!onUnaccept) return;
    const ok = await confirm({
      title: "Bỏ chọn câu trả lời?",
      message: "Câu hỏi sẽ chuyển về trạng thái Đang mở.",
      destructive: true,
      confirmText: "Bỏ chọn",
    });
    if (ok) onUnaccept();
  }, [onUnaccept, confirm]);

  return (
    <View style={styles.wrap}>
      {isAccepted && (
        <View style={styles.acceptedBadge}>
          <Ionicons name="checkmark-circle" size={11} color="#fff" />
          <Text style={styles.acceptedText}>Câu trả lời được chọn</Text>
        </View>
      )}

      <View style={styles.row}>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/user/[id]", params: { id: String(reply.authorId) } })
          }
          hitSlop={4}
        >
          {reply.authorAvatar ? (
            <Image
              source={{ uri: reply.authorAvatar }}
              style={[styles.avatar, nested && styles.avatarNested]}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.avatar,
                nested && styles.avatarNested,
                {
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text
                style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: nested ? 10 : 12 }}
              >
                {reply.authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/user/[id]", params: { id: String(reply.authorId) } })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              hitSlop={4}
            >
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {reply.authorName}
              </Text>
              <AdminBadge role={reply.authorRole} size="tiny" />
              {isByThreadAuthor && (
                <View style={styles.authorChip}>
                  <Text style={styles.authorChipText}>Tác giả</Text>
                </View>
              )}
              {parsedReplyTarget.target && (
                <>
                  <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} />
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {parsedReplyTarget.target}
                  </Text>
                </>
              )}
            </Pressable>
            <Text style={[styles.meta, { color: colors.textTertiary }]}>·</Text>
            <Text style={[styles.meta, { color: colors.textTertiary }]}>
              {timeAgo(reply.createdAt)}
            </Text>
            {isEdited && (
              <>
                <Text style={[styles.meta, { color: colors.textTertiary }]}>·</Text>
                <Text style={[styles.meta, { color: colors.textTertiary, fontStyle: "italic" }]}>
                  đã chỉnh sửa
                </Text>
              </>
            )}
            <View style={{ flex: 1 }} />
            {!editing && (
              <Pressable onPress={() => setMenuOpen(true)} hitSlop={6}>
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {editing ? (
            <View
              style={[
                styles.editBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                multiline
                autoFocus
                placeholder="Viết câu trả lời..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.editInput, { color: colors.text }]}
              />
              <View style={styles.editActions}>
                <Pressable
                  onPress={() => {
                    setEditing(false);
                    setDraft(initialDraft);
                  }}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.editBtn,
                    { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.editBtnText, { color: colors.text }]}>Hủy</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdit}
                  disabled={saving || !draft.trim() || draft.trim() === initialDraft}
                  style={({ pressed }) => [
                    styles.editBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity:
                        pressed || saving || !draft.trim() || draft.trim() === initialDraft
                          ? 0.6
                          : 1,
                    },
                  ]}
                >
                  <Text style={[styles.editBtnText, { color: "#fff" }]}>
                    {saving ? "..." : "Lưu"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onLongPress={() => setMenuOpen(true)}
              delayLongPress={350}
              android_disableSound
            >
              <Text style={[styles.content, { color: colors.text }]}>{parsedReplyTarget.body}</Text>
            </Pressable>
          )}

          {!editing && (
            <View style={styles.actionsRow}>
              {/* Vote pair — small icons + count */}
              <Pressable onPress={() => onVote("up")} style={styles.voteIconBtn} hitSlop={4}>
                <Ionicons
                  name={reply.myVote === "up" ? "arrow-up-circle" : "arrow-up-circle-outline"}
                  size={18}
                  color={reply.myVote === "up" ? "#10B981" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.voteCount,
                    { color: reply.myVote === "up" ? "#10B981" : colors.textSecondary },
                  ]}
                >
                  {reply.upvotes}
                </Text>
              </Pressable>
              <Pressable onPress={() => onVote("down")} style={styles.voteIconBtn} hitSlop={4}>
                <Ionicons
                  name={reply.myVote === "down" ? "arrow-down-circle" : "arrow-down-circle-outline"}
                  size={18}
                  color={reply.myVote === "down" ? "#EF4444" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.voteCount,
                    { color: reply.myVote === "down" ? "#EF4444" : colors.textSecondary },
                  ]}
                >
                  {reply.downvotes}
                </Text>
              </Pressable>
              {onReply && (
                <Pressable onPress={() => setReplying((v) => !v)} hitSlop={4}>
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                    {replying ? "Hủy" : "Trả lời"}
                  </Text>
                </Pressable>
              )}
              {/* Accept stays inline — it's a primary action for the thread author */}
              {isThreadAuthor && !isAccepted && onAccept && (
                <Pressable onPress={onAccept} hitSlop={4} style={styles.acceptBtn}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
                  <Text style={[styles.acceptBtnText, { color: "#10B981" }]}>Chọn câu trả lời</Text>
                </Pressable>
              )}
              {isThreadAuthor && isAccepted && onUnaccept && (
                <Pressable onPress={handleUnacceptPress} hitSlop={4}>
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>Bỏ chọn</Text>
                </Pressable>
              )}
            </View>
          )}

          {replying && onReply && (
            <View
              style={[
                styles.replyBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <TextInput
                value={replyDraft}
                onChangeText={setReplyDraft}
                multiline
                autoFocus
                placeholder={`Trả lời ${reply.authorName}...`}
                placeholderTextColor={colors.textTertiary}
                style={[styles.editInput, { color: colors.text }]}
              />
              <View style={styles.editActions}>
                <Pressable
                  onPress={() => {
                    setReplying(false);
                    setReplyDraft("");
                  }}
                  disabled={postingReply}
                  style={({ pressed }) => [
                    styles.editBtn,
                    { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.editBtnText, { color: colors.text }]}>Hủy</Text>
                </Pressable>
                <Pressable
                  onPress={handleSendReply}
                  disabled={postingReply || !replyDraft.trim()}
                  style={({ pressed }) => [
                    styles.editBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed || postingReply || !replyDraft.trim() ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.editBtnText, { color: "#fff" }]}>
                    {postingReply ? "..." : "Gửi"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {children && <View style={{ marginTop: 12 }}>{children}</View>}
        </View>
      </View>

      <CommentActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        colors={colors}
        actions={(() => {
          const items: ActionItem[] = [];
          items.push({
            key: "copy",
            label: "Sao chép",
            icon: "copy-outline",
            onPress: async () => {
              await Clipboard.setStringAsync(parsedReplyTarget.body);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toast.show("Đã sao chép câu trả lời vào bộ nhớ tạm", "success");
            },
          });
          if (canEdit) {
            items.push({
              key: "edit",
              label: "Sửa",
              icon: "create-outline",
              onPress: () => setEditing(true),
            });
          }
          if (onReport && !isOwn) {
            items.push({
              key: "report",
              label: "Báo cáo",
              icon: "flag-outline",
              onPress: () => onReport(reply.replyId),
            });
          }
          if (canDelete) {
            items.push({
              key: "delete",
              label: "Xóa",
              icon: "trash-outline",
              destructive: true,
              onPress: confirmDelete,
            });
          }
          return items;
        })()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarNested: { width: 28, height: 28, borderRadius: 14 },

  acceptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  acceptedText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  name: { fontSize: 13, fontFamily: "Inter_700Bold", maxWidth: 160 },
  replyTarget: { fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 140 },
  meta: { fontSize: 11, fontFamily: "Inter_500Medium" },

  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginTop: 2 },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
    flexWrap: "wrap",
  },
  actionText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  voteIconBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  voteCount: { fontSize: 12, fontFamily: "Inter_700Bold" },

  acceptBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  acceptBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  editBox: { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 4 },
  editInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
    minHeight: 40,
    maxHeight: 200,
    textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  editBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  replyBox: { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 8 },

  authorChip: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  authorChipText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
