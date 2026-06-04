import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { useThemeColors } from "@/constants/colors";
import type { ForumPoll } from "@/hooks/queries/use-forum";

type ThemeColors = ReturnType<typeof useThemeColors>;

export function PollBlock({
  poll,
  colors,
  isAuthenticated,
  onVote,
  onLoginRequired,
}: {
  poll: ForumPoll;
  colors: ThemeColors;
  isAuthenticated: boolean;
  onVote: (optionId: number) => void;
  onLoginRequired: () => void;
}) {
  const total = poll.totalVotes;
  const hasVoted = poll.myVote !== null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <Ionicons name="bar-chart" size={14} color={colors.primary} />
        <Text style={[styles.title, { color: colors.primary }]}>Thăm dò ý kiến</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.totalText, { color: colors.textTertiary }]}>{total} lượt vote</Text>
      </View>

      <View style={{ gap: 8 }}>
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
          const isMyVote = poll.myVote === opt.optionId;
          // Show progress only after the viewer has voted OR is unauthenticated viewing results
          const showResults = hasVoted;
          return (
            <Pressable
              key={opt.optionId}
              onPress={() => {
                if (!isAuthenticated) {
                  onLoginRequired();
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onVote(opt.optionId);
              }}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: isMyVote ? colors.primary : colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {showResults && (
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: isMyVote ? colors.primary + "33" : colors.primary + "15",
                    },
                  ]}
                />
              )}
              <View style={styles.optionContent}>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: isMyVote ? colors.primary : colors.cardBorder,
                      backgroundColor: isMyVote ? colors.primary : "transparent",
                    },
                  ]}
                >
                  {isMyVote && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: colors.text,
                      fontFamily: isMyVote ? "Inter_700Bold" : "Inter_500Medium",
                    },
                  ]}
                >
                  {opt.optionText}
                </Text>
                {showResults && (
                  <Text
                    style={[
                      styles.pctText,
                      {
                        color: isMyVote ? colors.primary : colors.textSecondary,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {pct}%
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {hasVoted && (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Tap để thay đổi · Tap option đang chọn để bỏ phiếu
        </Text>
      )}
      {!hasVoted && isAuthenticated && (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Chọn 1 phương án để xem kết quả
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  totalText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  optionRow: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 1.5,
  },
  progressFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1, fontSize: 14 },
  pctText: { fontSize: 13 },

  hint: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 4 },
});
