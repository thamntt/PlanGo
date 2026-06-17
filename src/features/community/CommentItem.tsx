import React, { useState, useCallback } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import type { useThemeColors } from "@/constants/colors";
import { AdminBadge } from "./AdminBadge";
import { CommentActionSheet, type ActionItem } from "./CommentActionSheet";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/contexts/ConfirmContext";

type ThemeColors = ReturnType<typeof useThemeColors>;

export interface CommentLike {
  commentId: number;
  authorId: number;
  authorName: string;
  authorAvatar?: string | null;
  authorRole?: string | null;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  parentCommentId?: number | null;
  likeCount?: number;
  isLikedByViewer?: boolean;
  isPinned?: boolean;
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

export function CommentItem({
  comment,
  colors,
  currentUserId,
  isAdminViewer,
  postAuthorId,
  onEdit,
  onDelete,
  onReply,
  onReport,
  onToggleLike,
  onTogglePin,
  canPin,
  nested = false,
  children,
}: {
  comment: CommentLike;
  colors: ThemeColors;
  currentUserId?: string;
  isAdminViewer?: boolean;
  postAuthorId?: number;
  onEdit: (commentId: number, newContent: string) => Promise<void>;
  onDelete: (commentId: number) => void;
  onReply?: (parentId: number, body: string) => Promise<void>;
  onReport?: (commentId: number) => void;
  onToggleLike?: (commentId: number) => void;
  onTogglePin?: (commentId: number) => void;
  canPin?: boolean;
  nested?: boolean;
  children?: React.ReactNode; // nested comments rendered below
}) {
  const isPostAuthor = !!postAuthorId && comment.authorId === postAuthorId;

  // TikTok-style breadcrumb. Marker formats supported in saved content:
  //   "@{Full Name} body" — preferred, handles names with spaces
  //   "@SingleWord body"  — legacy single-token mention
  const parsedReplyTarget = (() => {
    const braced = comment.content.match(/^@\{([^}]+)\}\s+/);
    if (braced) return { target: braced[1], body: comment.content.slice(braced[0].length) };
    const plain = comment.content.match(/^@(\S+)\s+/);
    if (plain) return { target: plain[1], body: comment.content.slice(plain[0].length) };
    return { target: null as string | null, body: comment.content };
  })();
  const isOwn = !!currentUserId && comment.authorId === Number(currentUserId);
  const canEdit = isOwn;
  const canDelete = isOwn || isAdminViewer;
  const isEdited = !!comment.updatedAt;

  const [editing, setEditing] = useState(false);
  const initialDraft = parsedReplyTarget.body;
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
    // Re-attach the @{target} prefix if the comment was a nested reply
    const finalText = parsedReplyTarget.target ? `@{${parsedReplyTarget.target}} ${text}` : text;
    if (!text || finalText === comment.content) {
      setEditing(false);
      setDraft(initialDraft);
      return;
    }
    setSaving(true);
    try {
      await onEdit(comment.commentId, finalText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }, [draft, comment.content, comment.commentId, onEdit, parsedReplyTarget.target, initialDraft]);

  const handleSendReply = useCallback(async () => {
    if (!onReply) return;
    const text = replyDraft.trim();
    if (!text) return;
    setPostingReply(true);
    try {
      await onReply(comment.commentId, text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyDraft("");
      setReplying(false);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không gửi được");
    } finally {
      setPostingReply(false);
    }
  }, [replyDraft, comment.commentId, onReply]);

  const confirmDelete = useCallback(async () => {
    const ok = await confirm({
      title: "Xóa bình luận?",
      message: "Bình luận sẽ bị xóa vĩnh viễn.",
      destructive: true,
      confirmText: "Xóa",
    });
    if (ok) onDelete(comment.commentId);
  }, [comment.commentId, onDelete, confirm]);

  return (
    <View style={styles.wrap}>
      {comment.isPinned && !nested && (
        <View style={styles.pinnedRow}>
          <MaterialCommunityIcons name="pin" size={12} color={colors.primary} />
          <Text style={[styles.pinnedText, { color: colors.primary }]}>Đã ghim</Text>
        </View>
      )}
      <View style={styles.row}>
        {/* Avatar */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/user/[id]", params: { id: String(comment.authorId) } })
          }
          hitSlop={4}
        >
          {comment.authorAvatar ? (
            <Image
              source={{ uri: comment.authorAvatar }}
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
                style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: nested ? 10 : 11 }}
              >
                {comment.authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Header line: name + admin badge + time + edited */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/user/[id]", params: { id: String(comment.authorId) } })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              hitSlop={4}
            >
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {comment.authorName}
              </Text>
              <AdminBadge role={comment.authorRole} size="tiny" />
              {isPostAuthor && (
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
              {timeAgo(comment.createdAt)}
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

          {/* Content or edit input */}
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
                placeholder="Viết bình luận..."
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

          {/* Action bar — only ❤ + Trả lời inline; secondary actions in long-press menu */}
          {!editing && (
            <View style={styles.actionsRow}>
              {onToggleLike && (
                <Pressable
                  onPress={() => onToggleLike(comment.commentId)}
                  style={styles.likeBtn}
                  hitSlop={4}
                >
                  <Ionicons
                    name={comment.isLikedByViewer ? "heart" : "heart-outline"}
                    size={16}
                    color={comment.isLikedByViewer ? "#EF4444" : colors.textSecondary}
                  />
                  {(comment.likeCount || 0) > 0 && (
                    <Text
                      style={[
                        styles.likeCount,
                        { color: comment.isLikedByViewer ? "#EF4444" : colors.textSecondary },
                      ]}
                    >
                      {comment.likeCount}
                    </Text>
                  )}
                </Pressable>
              )}
              {onReply && (
                <Pressable onPress={() => setReplying((v) => !v)} hitSlop={4}>
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                    {replying ? "Hủy reply" : "Trả lời"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Reply input */}
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
                placeholder={`Trả lời ${comment.authorName}...`}
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

          {/* Nested children */}
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
              toast.show("Đã sao chép bình luận vào bộ nhớ tạm", "success");
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
          if (canPin && onTogglePin && !nested) {
            items.push({
              key: "pin",
              label: comment.isPinned ? "Bỏ ghim" : "Ghim bình luận",
              icon: { lib: "mci", name: comment.isPinned ? "pin-off-outline" : "pin-outline" },
              onPress: () => onTogglePin(comment.commentId),
            });
          }
          if (onReport && !isOwn) {
            items.push({
              key: "report",
              label: "Báo cáo",
              icon: "flag-outline",
              onPress: () => onReport(comment.commentId),
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
  wrap: { marginBottom: 12 },
  pinnedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    marginLeft: 2,
  },
  pinnedText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarNested: { width: 26, height: 26, borderRadius: 13 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  name: { fontSize: 13, fontFamily: "Inter_700Bold", maxWidth: 160 },
  replyTarget: { fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 140 },
  meta: { fontSize: 11, fontFamily: "Inter_500Medium" },

  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 2 },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
    flexWrap: "wrap",
  },
  actionText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  likeCount: { fontSize: 12, fontFamily: "Inter_700Bold" },

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
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
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
