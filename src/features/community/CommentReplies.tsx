import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { useThemeColors } from "@/constants/colors";

type ThemeColors = ReturnType<typeof useThemeColors>;

const INITIAL_VISIBLE = 2;

export function CommentReplies({
  count,
  colors,
  renderVisible,
}: {
  count: number;
  colors: ThemeColors;
  renderVisible: (limit: number | null) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? null : INITIAL_VISIBLE;
  const hidden = expanded ? 0 : Math.max(0, count - INITIAL_VISIBLE);

  return (
    <View style={[styles.wrap, { borderLeftColor: colors.divider || colors.cardBorder }]}>
      {renderVisible(limit)}
      {hidden > 0 && (
        <Pressable onPress={() => setExpanded(true)} style={styles.moreBtn} hitSlop={4}>
          <Ionicons
            name="return-down-forward"
            size={12}
            color={colors.textSecondary}
            style={{ transform: [{ scaleX: -1 }] }}
          />
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>
            Xem thêm {hidden} câu trả lời
          </Text>
        </Pressable>
      )}
      {expanded && count > INITIAL_VISIBLE && (
        <Pressable onPress={() => setExpanded(false)} style={styles.moreBtn} hitSlop={4}>
          <Ionicons name="chevron-up" size={12} color={colors.textSecondary} />
          <Text style={[styles.moreText, { color: colors.textSecondary }]}>Thu gọn</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingLeft: 10,
    borderLeftWidth: 2,
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    marginTop: 4,
  },
  moreText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
