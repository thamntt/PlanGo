import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { useThemeColors } from "@/constants/colors";
import {
  REPORT_REASONS,
  useReviewReplies,
  useCreateReply,
  useDeleteReply,
  useReportContent,
  type ReportReason,
} from "@/hooks/queries/use-review-engagement";

type ThemeColors = ReturnType<typeof useThemeColors>;

// ──────────────────────────────────────────────────────────────
// Reviewer level badge
// ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  active: { label: "Tích cực", color: "#10B981", bg: "#10B98118", icon: "thumb-up" },
  top: { label: "Top Reviewer", color: "#F59E0B", bg: "#F59E0B20", icon: "trophy-variant" },
  legend: { label: "Huyền thoại", color: "#8B5CF6", bg: "#8B5CF620", icon: "crown" },
};

export function ReviewerBadge({ level }: { level?: string | null }) {
  if (!level || level === "newcomer" || !LEVEL_CONFIG[level]) return null;
  const cfg = LEVEL_CONFIG[level];
  return (
    <View style={[styles.levelBadge, { backgroundColor: cfg.bg }]}>
      <MaterialCommunityIcons name={cfg.icon} size={10} color={cfg.color} />
      <Text style={[styles.levelBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Photo gallery — horizontal thumbnails + tap to view fullscreen
// ──────────────────────────────────────────────────────────────

export function ReviewPhotos({ photos, colors }: { photos: string[]; colors: ThemeColors }) {
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {photos.map((url, idx) => (
          <Pressable
            key={idx}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewerIdx(idx);
            }}
          >
            <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
            {photos.length > 4 && idx === 3 && (
              <View style={styles.thumbOverlay}>
                <Text style={styles.thumbOverlayText}>+{photos.length - 4}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={viewerIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIdx(null)}
      >
        <Pressable style={styles.viewerOverlay} onPress={() => setViewerIdx(null)}>
          {viewerIdx !== null && photos[viewerIdx] && (
            <Image
              source={{ uri: photos[viewerIdx] }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          )}
          <View style={styles.viewerTop}>
            <Text style={styles.viewerCount}>
              {(viewerIdx ?? 0) + 1} / {photos.length}
            </Text>
            <Pressable onPress={() => setViewerIdx(null)} hitSlop={8}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          {viewerIdx !== null && viewerIdx > 0 && (
            <Pressable
              style={[styles.viewerNav, { left: 16 }]}
              onPress={(e) => {
                e.stopPropagation();
                setViewerIdx((i) => (i ?? 0) - 1);
              }}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </Pressable>
          )}
          {viewerIdx !== null && viewerIdx < photos.length - 1 && (
            <Pressable
              style={[styles.viewerNav, { right: 16 }]}
              onPress={(e) => {
                e.stopPropagation();
                setViewerIdx((i) => (i ?? 0) + 1);
              }}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpful button (Phase 1.5)
// ──────────────────────────────────────────────────────────────

export function HelpfulButton({
  count,
  voted,
  onPress,
  colors,
}: {
  count: number;
  voted: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.engageBtn,
        {
          backgroundColor: voted ? colors.primary + "18" : "transparent",
          borderColor: voted ? colors.primary + "60" : colors.cardBorder,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons
        name={voted ? "thumbs-up" : "thumbs-up-outline"}
        size={12}
        color={voted ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[styles.engageBtnText, { color: voted ? colors.primary : colors.textSecondary }]}
      >
        Hữu ích{count > 0 ? ` (${count})` : ""}
      </Text>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Report modal — pick reason + optional details + submit
// ──────────────────────────────────────────────────────────────

export function ReportModal({
  visible,
  target,
  onClose,
  colors,
}: {
  visible: boolean;
  target: { contentType: "review" | "reply"; contentRefId: string } | null;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const reportMut = useReportContent();

  React.useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails("");
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!target || !reason) return;
    try {
      await reportMut.mutateAsync({ ...target, reason, details: details.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      if (Platform.OS === "web")
        alert("Cảm ơn bạn! Admin sẽ xem xét báo cáo trong thời gian sớm nhất.");
      else
        Alert.alert(
          "Đã ghi nhận",
          "Cảm ơn bạn! Admin sẽ xem xét báo cáo trong thời gian sớm nhất.",
        );
    } catch (err: any) {
      if (Platform.OS === "web") alert(err?.message || "Lỗi gửi báo cáo");
      else Alert.alert("Lỗi", err?.message || "Lỗi gửi báo cáo");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.divider }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Báo cáo nội dung</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
            Chọn lý do bạn cho rằng nội dung này vi phạm
          </Text>
          <View style={{ gap: 6, marginBottom: 14 }}>
            {REPORT_REASONS.map((r) => {
              const active = reason === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReason(r.key);
                  }}
                  style={[
                    styles.reasonRow,
                    {
                      backgroundColor: active ? colors.primary + "15" : colors.card,
                      borderColor: active ? colors.primary : colors.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: active ? colors.primary : colors.textTertiary,
                        backgroundColor: active ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                  <Text
                    style={[styles.reasonText, { color: active ? colors.primary : colors.text }]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Chi tiết thêm (không bắt buộc)..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            style={[
              styles.detailsInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.cardBorder,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={!reason || reportMut.isPending}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: !reason ? colors.textTertiary : "#EF4444",
                opacity: reportMut.isPending ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {reportMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flag" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Gửi báo cáo</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────
// Reply thread — expandable list + input
// ──────────────────────────────────────────────────────────────

export function ReplyThread({
  reviewUserId,
  reviewTripId,
  currentUserId,
  colors,
  onReport,
}: {
  reviewUserId: number;
  reviewTripId: number;
  currentUserId?: number;
  colors: ThemeColors;
  onReport?: (replyId: number) => void;
}) {
  const { data: replies = [], isLoading } = useReviewReplies(reviewUserId, reviewTripId);
  const createReply = useCreateReply();
  const deleteReply = useDeleteReply();
  const [draftContent, setDraftContent] = useState("");

  const handleSend = useCallback(async () => {
    const content = draftContent.trim();
    if (!content) return;
    try {
      await createReply.mutateAsync({ reviewUserId, reviewTripId, content });
      setDraftContent("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      if (Platform.OS === "web") alert(err?.message || "Không gửi được phản hồi");
      else Alert.alert("Lỗi", err?.message || "Không gửi được phản hồi");
    }
  }, [draftContent, reviewUserId, reviewTripId, createReply]);

  const handleDelete = useCallback(
    async (replyId: number) => {
      try {
        await deleteReply.mutateAsync({ replyId, reviewUserId, reviewTripId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (Platform.OS === "web") alert("Không xoá được");
        else Alert.alert("Lỗi", "Không xoá được");
      }
    },
    [reviewUserId, reviewTripId, deleteReply],
  );

  return (
    <View style={[styles.replyContainer, { borderColor: colors.divider }]}>
      {isLoading && replies.length === 0 ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : replies.length === 0 ? (
        <Text style={[styles.replyEmpty, { color: colors.textTertiary }]}>
          Chưa có phản hồi nào. Hãy là người đầu tiên!
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {replies.map((r) => {
            const isOwn = currentUserId === r.authorId;
            const dateStr = new Date(r.createdAt).toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            return (
              <View key={r.replyId} style={styles.replyItem}>
                {r.authorAvatarUrl ? (
                  <Image
                    source={{ uri: r.authorAvatarUrl }}
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
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" }}>
                      {r.authorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.replyAuthor, { color: colors.text }]}>{r.authorName}</Text>
                    <Text style={[styles.replyDate, { color: colors.textTertiary }]}>
                      {dateStr}
                    </Text>
                  </View>
                  <Text style={[styles.replyContent, { color: colors.text }]}>{r.content}</Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    {isOwn ? (
                      <Pressable onPress={() => handleDelete(r.replyId)} hitSlop={4}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_600SemiBold",
                            color: "#EF4444",
                          }}
                        >
                          Xóa
                        </Text>
                      </Pressable>
                    ) : (
                      onReport && (
                        <Pressable onPress={() => onReport(r.replyId)} hitSlop={4}>
                          <Text
                            style={{
                              fontSize: 11,
                              fontFamily: "Inter_600SemiBold",
                              color: colors.textTertiary,
                            }}
                          >
                            Báo cáo
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Input */}
      {currentUserId ? (
        <View
          style={[
            styles.replyInputRow,
            { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
          ]}
        >
          <TextInput
            value={draftContent}
            onChangeText={setDraftContent}
            placeholder="Viết phản hồi..."
            placeholderTextColor={colors.textTertiary}
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: colors.text,
              paddingVertical: 6,
            }}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draftContent.trim() || createReply.isPending}
            hitSlop={6}
          >
            {createReply.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={draftContent.trim() ? colors.primary : colors.textTertiary}
              />
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Level badge
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },

  // Photos
  thumb: { width: 80, height: 80, borderRadius: 8 },
  thumbOverlay: {
    position: "absolute",
    inset: 0 as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  thumbOverlayText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  viewerOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: { width: "100%", height: "85%" },
  viewerTop: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewerCount: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  viewerNav: {
    position: "absolute",
    top: "50%",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Engage button
  engageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  engageBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Report modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 14 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  detailsInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minHeight: 70,
    marginBottom: 14,
    textAlignVertical: "top",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  // Reply thread
  replyContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  replyEmpty: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  replyItem: { flexDirection: "row", gap: 10 },
  replyAvatar: { width: 28, height: 28, borderRadius: 14 },
  replyAuthor: { fontSize: 12, fontFamily: "Inter_700Bold" },
  replyDate: { fontSize: 10, fontFamily: "Inter_500Medium" },
  replyContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  replyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 6,
  },
});
