import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useDestinations } from "@/hooks/queries/use-destinations";
import { useCreateForumThread } from "@/hooks/queries/use-forum";

const CATEGORIES = [
  {
    key: "question",
    label: "Câu hỏi",
    color: "#3B82F6",
    icon: "help-circle-outline" as const,
    help: "Hỏi đáp cộng đồng",
  },
  {
    key: "discussion",
    label: "Thảo luận",
    color: "#A855F7",
    icon: "chatbubbles-outline" as const,
    help: "Cùng bàn luận chủ đề",
  },
  {
    key: "tip",
    label: "Mẹo hay",
    color: "#10B981",
    icon: "bulb-outline" as const,
    help: "Chia sẻ kinh nghiệm",
  },
  {
    key: "recommendation",
    label: "Gợi ý",
    color: "#F59E0B",
    icon: "star-outline" as const,
    help: "Xin recommend",
  },
];

export default function CreateForumThreadScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const destinationsQuery = useDestinations();
  const createThread = useCreateForumThread();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("question");
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  const [destSearch, setDestSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const destinations = destinationsQuery.data || [];
  const selectedDest = useMemo(
    () => destinations.find((d) => Number(d.id) === destinationId),
    [destinations, destinationId],
  );
  const filteredDest = useMemo(() => {
    const q = destSearch.trim().toLowerCase();
    if (!q) return destinations.slice(0, 30);
    return destinations
      .filter((d) => d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q))
      .slice(0, 30);
  }, [destinations, destSearch]);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags([...tags, t]);
    setTagInput("");
  }, [tagInput, tags]);
  const removeTag = useCallback((t: string) => setTags(tags.filter((x) => x !== t)), [tags]);

  const validPollOptions = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
  const pollValid = !pollEnabled || validPollOptions.length >= 2;
  const canSubmit = title.trim().length >= 8 && body.trim().length >= 20 && pollValid;

  const handleSubmit = useCallback(async () => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để đặt câu hỏi");
      return;
    }
    if (title.trim().length < 8) {
      Alert.alert("Tiêu đề quá ngắn", "Vui lòng nhập tiêu đề tối thiểu 8 ký tự");
      return;
    }
    if (body.trim().length < 20) {
      Alert.alert("Nội dung quá ngắn", "Vui lòng mô tả tối thiểu 20 ký tự");
      return;
    }
    try {
      const created = await createThread.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        destinationId,
        category,
        tagNames: tags,
        poll: pollEnabled && validPollOptions.length >= 2 ? { options: validPollOptions } : null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/community/forum/[id]",
        params: { id: String(created.threadId) },
      });
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không tạo được bài");
    }
  }, [canSubmit, user, createThread, title, body, destinationId, category, tags]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + webTopInset + 8, borderBottomColor: colors.divider },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.headerBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Đặt câu hỏi</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || createThread.isPending}
            style={({ pressed }) => [
              styles.publishBtn,
              {
                backgroundColor: colors.primary,
                opacity: createThread.isPending ? 0.6 : !canSubmit ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {createThread.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.publishText, { color: "#fff" }]}>Đăng</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category selector */}
          <View style={[styles.section, { marginTop: 14 }]}>
            <Text style={[styles.label, { color: colors.text }]}>Loại bài</Text>
            <View style={{ gap: 8 }}>
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCategory(c.key);
                    }}
                    style={[
                      styles.catCard,
                      {
                        backgroundColor: active ? c.color + "12" : colors.card,
                        borderColor: active ? c.color : colors.cardBorder,
                      },
                    ]}
                  >
                    <View style={[styles.catIcon, { backgroundColor: c.color + "1F" }]}>
                      <Ionicons name={c.icon} size={18} color={c.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catTitle, { color: colors.text }]}>{c.label}</Text>
                      <Text style={[styles.catHelp, { color: colors.textSecondary }]}>
                        {c.help}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: active ? c.color : colors.cardBorder,
                          backgroundColor: active ? c.color : "transparent",
                        },
                      ]}
                    >
                      {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Tiêu đề <Text style={{ color: "#EF4444" }}>*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="VD: Đi Sa Pa 3N2Đ tháng 12 nên chuẩn bị gì?"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                },
              ]}
              multiline
              maxLength={150}
            />
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    title.trim().length > 0 && title.trim().length < 8
                      ? "#EF4444"
                      : colors.textTertiary,
                },
              ]}
            >
              {title.trim().length < 8
                ? `Tối thiểu 8 ký tự · ${title.length}/150`
                : `${title.length}/150 · cụ thể, rõ ràng để dễ nhận trợ giúp`}
            </Text>
          </View>

          {/* Body */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Nội dung <Text style={{ color: "#EF4444" }}>*</Text>
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Mô tả chi tiết tình huống, nhu cầu, ngân sách... (tối thiểu 20 ký tự)"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.bodyInput,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                },
              ]}
              multiline
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    body.trim().length > 0 && body.trim().length < 20
                      ? "#EF4444"
                      : colors.textTertiary,
                },
              ]}
            >
              {body.trim().length < 20
                ? `Tối thiểu 20 ký tự · ${body.length}`
                : `${body.length} ký tự`}
            </Text>
          </View>

          {/* Poll (optional) */}
          <View style={styles.section}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setPollEnabled((v) => !v);
              }}
              style={[
                styles.pollToggle,
                {
                  backgroundColor: pollEnabled ? colors.primary + "12" : colors.inputBg,
                  borderColor: pollEnabled ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Ionicons
                name="bar-chart-outline"
                size={18}
                color={pollEnabled ? colors.primary : colors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.pollToggleLabel,
                    { color: pollEnabled ? colors.primary : colors.text },
                  ]}
                >
                  Thêm cuộc thăm dò
                </Text>
                <Text style={[styles.pollToggleHelp, { color: colors.textTertiary }]}>
                  Cho cộng đồng bỏ phiếu (2-6 lựa chọn)
                </Text>
              </View>
              <View
                style={[
                  styles.pollSwitch,
                  {
                    backgroundColor: pollEnabled ? colors.primary : colors.inputBg,
                    borderColor: pollEnabled ? colors.primary : colors.cardBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.pollSwitchKnob,
                    {
                      backgroundColor: "#fff",
                      transform: [{ translateX: pollEnabled ? 16 : 0 }],
                    },
                  ]}
                />
              </View>
            </Pressable>

            {pollEnabled && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {pollOptions.map((opt, i) => (
                  <View key={i} style={styles.pollOptRow}>
                    <View
                      style={[
                        styles.pollOptNum,
                        { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                      ]}
                    >
                      <Text style={[styles.pollOptNumText, { color: colors.textSecondary }]}>
                        {i + 1}
                      </Text>
                    </View>
                    <TextInput
                      value={opt}
                      onChangeText={(t) =>
                        setPollOptions(pollOptions.map((o, idx) => (idx === i ? t : o)))
                      }
                      placeholder={`Lựa chọn ${i + 1}`}
                      placeholderTextColor={colors.textTertiary}
                      maxLength={200}
                      style={[
                        styles.pollOptInput,
                        {
                          color: colors.text,
                          backgroundColor: colors.inputBg,
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    />
                    {pollOptions.length > 2 && (
                      <Pressable
                        onPress={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                        hitSlop={6}
                        style={styles.pollOptRemove}
                      >
                        <Ionicons name="close" size={16} color={colors.textTertiary} />
                      </Pressable>
                    )}
                  </View>
                ))}
                {pollOptions.length < 6 && (
                  <Pressable
                    onPress={() => setPollOptions([...pollOptions, ""])}
                    style={[
                      styles.pollAddBtn,
                      { borderColor: colors.cardBorder, backgroundColor: colors.inputBg },
                    ]}
                  >
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={[styles.pollAddText, { color: colors.primary }]}>
                      Thêm lựa chọn
                    </Text>
                  </Pressable>
                )}
                <Text style={[styles.helpText, { color: colors.textTertiary }]}>
                  {validPollOptions.length < 2
                    ? "Nhập ít nhất 2 lựa chọn"
                    : `${validPollOptions.length}/6 lựa chọn`}
                </Text>
              </View>
            )}
          </View>

          {/* Destination tag */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Liên kết điểm đến{" "}
              <Text style={{ color: colors.textTertiary, fontFamily: "Inter_400Regular" }}>
                (không bắt buộc)
              </Text>
            </Text>
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              Liên kết với 1 điểm đến để câu hỏi xuất hiện trong trang chi tiết của địa danh đó
            </Text>

            {selectedDest && (
              <View
                style={[
                  styles.selectedDestCard,
                  { backgroundColor: colors.primary + "12", borderColor: colors.primary },
                ]}
              >
                {selectedDest.images[0] && (
                  <Image
                    source={{ uri: selectedDest.images[0] }}
                    style={styles.selectedDestImg}
                    contentFit="cover"
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectedDestName, { color: colors.text }]}>
                    {selectedDest.name}
                  </Text>
                  <Text
                    style={[styles.selectedDestAddr, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {selectedDest.address}
                  </Text>
                </View>
                <Pressable onPress={() => setDestinationId(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.primary} />
                </Pressable>
              </View>
            )}

            {!selectedDest && (
              <Pressable
                onPress={() => setDestPickerOpen(!destPickerOpen)}
                style={[
                  styles.addBtn,
                  { borderColor: colors.cardBorder, backgroundColor: colors.inputBg },
                ]}
              >
                <Ionicons
                  name={destPickerOpen ? "chevron-up" : "location-outline"}
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>
                  {destPickerOpen ? "Ẩn danh sách" : "Chọn điểm đến"}
                </Text>
              </Pressable>
            )}

            {destPickerOpen && !selectedDest && (
              <View
                style={[
                  styles.destPicker,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <View
                  style={[
                    styles.searchBox,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <Ionicons name="search" size={14} color={colors.textTertiary} />
                  <TextInput
                    value={destSearch}
                    onChangeText={setDestSearch}
                    placeholder="Tìm điểm đến..."
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                </View>
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                  {destinationsQuery.isLoading ? (
                    <View style={{ padding: 20, alignItems: "center" }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : filteredDest.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textTertiary }]}>
                      Không tìm thấy
                    </Text>
                  ) : (
                    filteredDest.map((d) => (
                      <Pressable
                        key={d.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDestinationId(Number(d.id));
                          setDestPickerOpen(false);
                        }}
                        style={[styles.destRow, { borderBottomColor: colors.divider }]}
                      >
                        {d.images[0] && (
                          <Image
                            source={{ uri: d.images[0] }}
                            style={styles.destThumb}
                            contentFit="cover"
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.destName, { color: colors.text }]} numberOfLines={1}>
                            {d.name}
                          </Text>
                          <Text
                            style={[styles.destAddr, { color: colors.textTertiary }]}
                            numberOfLines={1}
                          >
                            {d.address}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Tags{" "}
              <Text style={{ color: colors.textTertiary, fontFamily: "Inter_400Regular" }}>
                (tối đa 5)
              </Text>
            </Text>
            <View
              style={[
                styles.tagInputRow,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="pricetag-outline" size={14} color={colors.textTertiary} />
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                placeholder="Nhập tag và Enter..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.tagInput, { color: colors.text }]}
                returnKeyType="done"
                maxLength={20}
              />
              {!!tagInput.trim() && tags.length < 5 && (
                <Pressable onPress={addTag} hitSlop={6}>
                  <Text style={[styles.tagAdd, { color: colors.primary }]}>Thêm</Text>
                </Pressable>
              )}
            </View>
            {tags.length > 0 && (
              <View style={styles.tagListRow}>
                {tags.map((t) => (
                  <View
                    key={t}
                    style={[
                      styles.tagItem,
                      { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Text style={[styles.tagItemText, { color: colors.text }]}>#{t}</Text>
                    <Pressable onPress={() => removeTag(t)} hitSlop={6}>
                      <Ionicons name="close-circle" size={13} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  publishBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  publishText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  section: { paddingHorizontal: 16, marginTop: 16 },
  label: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8 },
  helpText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -4, marginBottom: 8 },

  catCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  catTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  catHelp: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
    lineHeight: 21,
  },
  bodyInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 160,
    lineHeight: 21,
  },
  charCount: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "right", marginTop: 4 },

  pollToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pollToggleLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  pollToggleHelp: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  pollSwitch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    padding: 1,
    justifyContent: "center",
  },
  pollSwitchKnob: { width: 16, height: 16, borderRadius: 8 },
  pollOptRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollOptNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pollOptNumText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  pollOptInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pollOptRemove: { padding: 4 },
  pollAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  pollAddText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  selectedDestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  selectedDestImg: { width: 44, height: 44, borderRadius: 10 },
  selectedDestName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  selectedDestAddr: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  destPicker: { marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  destThumb: { width: 40, height: 40, borderRadius: 8 },
  destName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  destAddr: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  empty: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", padding: 16 },

  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  tagAdd: { fontSize: 13, fontFamily: "Inter_700Bold" },
  tagListRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagItemText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
