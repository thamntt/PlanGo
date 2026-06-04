import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";
import {
  useReportContent,
  type ReportContentType,
  type ReportReason,
} from "@/hooks/queries/use-moderation";

interface Reason {
  key: ReportReason;
  label: string;
  desc: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const REASONS: Reason[] = [
  {
    key: "spam",
    label: "Spam",
    desc: "Quảng cáo, lặp lại, không liên quan",
    icon: "alert-decagram-outline",
  },
  {
    key: "misinformation",
    label: "Sai lệch",
    desc: "Thông tin sai sự thật về điểm đến/dịch vụ",
    icon: "information-off-outline",
  },
  {
    key: "harassment",
    label: "Xúc phạm / quấy rối",
    desc: "Tấn công cá nhân, kỳ thị, miệt thị",
    icon: "account-cancel-outline",
  },
  {
    key: "offensive",
    label: "Nội dung phản cảm",
    desc: "Tình dục, bạo lực, hate speech",
    icon: "alert-octagon-outline",
  },
  {
    key: "illegal",
    label: "Vi phạm pháp luật",
    desc: "Hướng dẫn phạm pháp, lừa đảo",
    icon: "shield-alert-outline",
  },
  { key: "other", label: "Khác", desc: "Lý do khác — vui lòng mô tả", icon: "dots-horizontal" },
];

export function ReportSheet({
  visible,
  onClose,
  contentType,
  contentRefId,
}: {
  visible: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentRefId: number;
}) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const reportMutation = useReportContent();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!selectedReason) return;
    try {
      await reportMutation.mutateAsync({
        contentType,
        contentRefId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Đã gửi báo cáo", "Cảm ơn bạn. Team PlanGo sẽ xem xét trong 24h và quyết định.");
      setSelectedReason(null);
      setDetails("");
      onClose();
    } catch (err: any) {
      Alert.alert("Không gửi được", err?.message || "Có lỗi xảy ra");
    }
  }, [selectedReason, details, contentType, contentRefId, reportMutation, onClose]);

  const close = () => {
    setSelectedReason(null);
    setDetails("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.cardBorder },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Báo cáo nội dung</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Chọn lý do — team PlanGo sẽ xem xét trong 24h. Nội dung vẫn hiển thị cho đến khi có
            quyết định.
          </Text>

          <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
            {/* Reasons */}
            <View style={{ gap: 8, paddingBottom: 6 }}>
              {REASONS.map((r) => {
                const active = selectedReason === r.key;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedReason(r.key);
                    }}
                    style={[
                      styles.reasonCard,
                      {
                        backgroundColor: active ? colors.primary + "12" : colors.card,
                        borderColor: active ? colors.primary : colors.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.reasonIcon,
                        { backgroundColor: active ? colors.primary : colors.inputBg },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={r.icon}
                        size={16}
                        color={active ? "#fff" : colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reasonLabel, { color: colors.text }]}>{r.label}</Text>
                      <Text style={[styles.reasonDesc, { color: colors.textSecondary }]}>
                        {r.desc}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: active ? colors.primary : colors.cardBorder,
                          backgroundColor: active ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Details */}
            {selectedReason && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.detailsLabel, { color: colors.text }]}>
                  Mô tả thêm{" "}
                  <Text style={{ color: colors.textTertiary, fontFamily: "Inter_400Regular" }}>
                    ({selectedReason === "other" ? "bắt buộc" : "không bắt buộc"})
                  </Text>
                </Text>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Ghi rõ hơn để team xem xét nhanh..."
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.detailsInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  multiline
                  maxLength={500}
                />
              </View>
            )}
          </ScrollView>

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={!selectedReason || reportMutation.isPending}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor:
                  selectedReason && !reportMutation.isPending ? colors.primary : colors.inputBg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {reportMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: selectedReason ? "#fff" : colors.textTertiary },
                ]}
              >
                Gửi báo cáo
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 17 },

  reasonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  reasonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  reasonDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  detailsLabel: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 6 },
  detailsInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minHeight: 70,
    maxHeight: 140,
    textAlignVertical: "top",
  },

  submitBtn: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
