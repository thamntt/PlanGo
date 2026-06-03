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
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useDestinations } from "@/hooks/queries/use-destinations";
import { useCreateBlogPost } from "@/hooks/queries/use-blog";

const CATEGORIES = [
  { key: "guide", label: "Hướng dẫn", color: "#3B82F6", icon: "book-outline" as const },
  { key: "review", label: "Review", color: "#A855F7", icon: "star-outline" as const },
  { key: "story", label: "Trải nghiệm", color: "#EC4899", icon: "heart-outline" as const },
  { key: "food", label: "Ẩm thực", color: "#F59E0B", icon: "restaurant-outline" as const },
  { key: "tip", label: "Mẹo hay", color: "#10B981", icon: "bulb-outline" as const },
];

export default function CreateBlogPostScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const destinationsQuery = useDestinations();
  const createPost = useCreateBlogPost();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("story");
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<number[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [destSearch, setDestSearch] = useState("");
  const [destPickerOpen, setDestPickerOpen] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const destinations = destinationsQuery.data || [];
  const filteredDest = useMemo(() => {
    const q = destSearch.trim().toLowerCase();
    if (!q) return destinations.slice(0, 30);
    return destinations
      .filter((d) => d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q))
      .slice(0, 30);
  }, [destinations, destSearch]);

  const selectedDestObjects = useMemo(
    () => destinations.filter((d) => selectedDestinationIds.includes(Number(d.id))),
    [destinations, selectedDestinationIds],
  );

  const readMinutes = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [content]);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
    }
  }, []);

  const toggleDestination = useCallback((id: number) => {
    Haptics.selectionAsync();
    setSelectedDestinationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags([...tags, t]);
    setTagInput("");
  }, [tagInput, tags]);

  const removeTag = useCallback((t: string) => setTags(tags.filter((x) => x !== t)), [tags]);

  const canSubmit = title.trim().length >= 8 && content.trim().length >= 50;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !user) return;
    try {
      const created = await createPost.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        coverImage: coverImage || undefined,
        category,
        readMinutes,
        tagNames: tags,
        destinationIds: selectedDestinationIds,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/community/blog/[id]", params: { id: String(created.postId) } });
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không tạo được bài viết");
    }
  }, [
    canSubmit,
    user,
    createPost,
    title,
    content,
    excerpt,
    coverImage,
    category,
    readMinutes,
    tags,
    selectedDestinationIds,
  ]);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Bài viết mới</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || createPost.isPending}
            style={[
              styles.publishBtn,
              {
                backgroundColor: canSubmit ? colors.primary : colors.inputBg,
                opacity: createPost.isPending ? 0.6 : 1,
              },
            ]}
          >
            {createPost.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[styles.publishText, { color: canSubmit ? "#fff" : colors.textTertiary }]}
              >
                Đăng
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover image */}
          <Pressable
            onPress={pickImage}
            style={[
              styles.coverBox,
              { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
            ]}
          >
            {coverImage ? (
              <>
                <Image source={{ uri: coverImage }} style={styles.coverImage} contentFit="cover" />
                <View style={styles.coverEditBadge}>
                  <Ionicons name="pencil" size={12} color="#fff" />
                  <Text style={styles.coverEditText}>Đổi ảnh</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="image-outline" size={40} color={colors.textTertiary} />
                <Text style={[styles.coverHint, { color: colors.textSecondary }]}>
                  Thêm ảnh bìa (16:9)
                </Text>
              </>
            )}
          </Pressable>

          {/* Title */}
          <View style={styles.section}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Tiêu đề bài viết..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.titleInput, { color: colors.text }]}
              multiline
              maxLength={120}
            />
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>
              {title.length}/120
            </Text>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Danh mục</Text>
            <View style={styles.catRow}>
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
                      styles.catChip,
                      {
                        backgroundColor: active ? c.color : colors.inputBg,
                        borderColor: active ? c.color : colors.cardBorder,
                      },
                    ]}
                  >
                    <Ionicons name={c.icon} size={13} color={active ? "#fff" : c.color} />
                    <Text style={[styles.catChipText, { color: active ? "#fff" : colors.text }]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Excerpt */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Tóm tắt{" "}
              <Text style={{ color: colors.textTertiary, fontFamily: "Inter_400Regular" }}>
                (không bắt buộc)
              </Text>
            </Text>
            <TextInput
              value={excerpt}
              onChangeText={setExcerpt}
              placeholder="Một dòng giới thiệu ngắn..."
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
              maxLength={200}
            />
          </View>

          {/* Content */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Nội dung <Text style={{ color: "#EF4444" }}>*</Text>
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Chia sẻ trải nghiệm của bạn... (tối thiểu 50 ký tự)"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.contentInput,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                },
              ]}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.contentMeta}>
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {content.length} ký tự
              </Text>
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                · ~{readMinutes} phút đọc
              </Text>
            </View>
          </View>

          {/* Destinations */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Điểm đến liên quan</Text>
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              Liên kết bài viết với điểm đến để giúp người đọc khám phá thêm
            </Text>

            {selectedDestObjects.length > 0 && (
              <View style={styles.selectedDestRow}>
                {selectedDestObjects.map((d) => (
                  <View
                    key={d.id}
                    style={[
                      styles.destChip,
                      { backgroundColor: colors.primary + "1A", borderColor: colors.primary },
                    ]}
                  >
                    <Ionicons name="location" size={11} color={colors.primary} />
                    <Text style={[styles.destChipText, { color: colors.primary }]}>{d.name}</Text>
                    <Pressable onPress={() => toggleDestination(Number(d.id))} hitSlop={6}>
                      <Ionicons name="close-circle" size={14} color={colors.primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={() => setDestPickerOpen(!destPickerOpen)}
              style={[
                styles.addBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.inputBg },
              ]}
            >
              <Ionicons
                name={destPickerOpen ? "chevron-up" : "add"}
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>
                {destPickerOpen ? "Ẩn danh sách" : "Thêm điểm đến"}
              </Text>
            </Pressable>

            {destPickerOpen && (
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
                <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                  {destinationsQuery.isLoading ? (
                    <View style={{ padding: 20, alignItems: "center" }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : filteredDest.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textTertiary }]}>
                      Không tìm thấy
                    </Text>
                  ) : (
                    filteredDest.map((d) => {
                      const selected = selectedDestinationIds.includes(Number(d.id));
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => toggleDestination(Number(d.id))}
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
                            <Text
                              style={[styles.destName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {d.name}
                            </Text>
                            <Text
                              style={[styles.destAddr, { color: colors.textTertiary }]}
                              numberOfLines={1}
                            >
                              {d.address}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.checkBox,
                              {
                                backgroundColor: selected ? colors.primary : "transparent",
                                borderColor: selected ? colors.primary : colors.cardBorder,
                              },
                            ]}
                          >
                            {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                        </Pressable>
                      );
                    })
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

  coverBox: {
    marginHorizontal: 16,
    marginTop: 14,
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    gap: 8,
  },
  coverImage: { ...StyleSheet.absoluteFillObject },
  coverEditBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  coverEditText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  coverHint: { fontSize: 13, fontFamily: "Inter_500Medium" },

  section: { paddingHorizontal: 16, marginTop: 16 },
  label: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8 },
  helpText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -4, marginBottom: 8 },

  titleInput: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    paddingVertical: 8,
    lineHeight: 26,
    minHeight: 50,
  },
  charCount: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "right" },

  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  catChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  input: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  contentInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 200,
    lineHeight: 21,
  },
  contentMeta: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 4 },

  selectedDestRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  destChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  destChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
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
