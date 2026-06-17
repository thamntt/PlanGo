import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";
import { usePopularDestinations } from "@/hooks/queries/use-destinations";
import { apiRequest } from "@/lib/api/query-client";
import { useQuery } from "@tanstack/react-query";

const MAX_RECENT = 8;

export type SearchContext = "community" | "destination" | "trip";

const TIP_BY_CONTEXT: Record<SearchContext, string> = {
  community: "Mẹo: nhập tên địa danh (Sa Pa, Phú Quốc) hoặc loại bài (Hướng dẫn, Ẩm thực…)",
  destination: "Mẹo: nhập tên địa danh (Sa Pa, Phú Quốc) hoặc loại điểm đến",
  trip: "Mẹo: nhập tên chuyến đi hoặc điểm đến",
};

// Top tags ordered by usageCount (BE listTags already sorts desc)
function usePopularBlogTags() {
  return useQuery<{ tagId: number; name: string; color?: string | null }[]>({
    queryKey: ["blog", "tags", "popular"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/blog/tags");
      const json = await res.json();
      return ("data" in json ? json.data : json) || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function SearchOverlay({
  visible,
  onClose,
  onSubmit,
  placeholder,
  context = "destination",
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (q: string) => void;
  placeholder?: string;
  context?: SearchContext;
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const RECENT_KEY = `search_recent_${context}`;

  // Pick popular data based on context
  const popularDest = usePopularDestinations(context === "community" ? 0 : 10);
  const popularTags = usePopularBlogTags();
  const popularItems: { key: string; label: string; subtitle?: string }[] =
    context === "community"
      ? (popularTags.data || []).slice(0, 12).map((t) => ({ key: `tag-${t.tagId}`, label: t.name }))
      : (popularDest.data || []).map((d) => ({
          key: `dest-${d.destinationId}`,
          label: d.name,
          subtitle: d.tripCount > 0 ? String(d.tripCount) : undefined,
        }));

  useEffect(() => {
    if (visible) {
      setQuery("");
      AsyncStorage.getItem(RECENT_KEY).then((v) => {
        if (v) {
          try {
            setRecent(JSON.parse(v) || []);
          } catch {}
        } else {
          setRecent([]);
        }
      });
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible, RECENT_KEY]);

  const handleSubmit = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    Haptics.selectionAsync();
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, MAX_RECENT);
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    onSubmit(q);
    onClose();
  };

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY);
  };

  const tip = TIP_BY_CONTEXT[context];

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              {
                paddingTop: Math.max(insets.top, 24) + webTopInset + 8,
                borderBottomColor: colors.divider,
              },
            ]}
          >
            <Pressable onPress={onClose} hitSlop={8} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handleSubmit(query)}
                placeholder={placeholder || "Tìm bài viết, câu hỏi..."}
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                returnKeyType="search"
                autoFocus
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={4}>
                  <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 22 }}
          >
            {/* Recent */}
            {recent.length > 0 && (
              <View>
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Tìm gần đây</Text>
                  <Pressable onPress={clearRecent} hitSlop={4}>
                    <Text style={[styles.clearText, { color: colors.textSecondary }]}>Xóa</Text>
                  </Pressable>
                </View>
                <View style={{ gap: 4 }}>
                  {recent.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => handleSubmit(r)}
                      style={({ pressed }) => [
                        styles.recentRow,
                        { backgroundColor: pressed ? colors.inputBg : "transparent" },
                      ]}
                    >
                      <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                      <Text style={[styles.recentText, { color: colors.text }]}>{r}</Text>
                      <View style={{ flex: 1 }} />
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          const next = recent.filter((x) => x !== r);
                          setRecent(next);
                          AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
                        }}
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={14} color={colors.textTertiary} />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular — destinations or tags depending on context */}
            {popularItems.length > 0 && (
              <View>
                <View style={styles.sectionRow}>
                  <MaterialCommunityIcons name="trending-up" size={16} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {context === "community" ? "Chủ đề phổ biến" : "Tìm phổ biến"}
                  </Text>
                </View>
                <View style={styles.chipsWrap}>
                  {popularItems.map((it) => (
                    <Pressable
                      key={it.key}
                      onPress={() => handleSubmit(it.label)}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      ]}
                    >
                      {context === "community" && (
                        <Text style={[styles.chipHash, { color: colors.textTertiary }]}>#</Text>
                      )}
                      <Text style={[styles.chipText, { color: colors.text }]}>{it.label}</Text>
                      {it.subtitle && (
                        <Text style={[styles.chipCount, { color: colors.textTertiary }]}>
                          {it.subtitle}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Tips */}
            <View
              style={[
                styles.tipBox,
                { backgroundColor: colors.primary + "0F", borderColor: colors.primary + "33" },
              ]}
            >
              <Ionicons name="bulb-outline" size={16} color={colors.primary} />
              <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },
  clearText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  recentText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chipCount: { fontSize: 11, fontFamily: "Inter_700Bold" },
  chipHash: { fontSize: 12, fontFamily: "Inter_700Bold", marginRight: -3 },

  tipBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  tipText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
});
