import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "@/lib/i18n";

interface Props {
  password: string;
}

/**
 * Lightweight password strength score 0-4.
 * - 1pt: length >= 8
 * - 1pt: mixed case (has upper AND lower)
 * - 1pt: has digit
 * - 1pt: has special char
 * Max 4. Length 6-7 with nothing else = 0.
 */
function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export function PasswordStrengthMeter({ password }: Props) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const txt = t().auth;

  const score = useMemo(() => scorePassword(password), [password]);

  if (!password) return null;

  const segments = [0, 1, 2, 3];
  const labels = [txt.passwordWeak, txt.passwordFair, txt.passwordGood, txt.passwordStrong];
  const colorByScore = [colors.error, colors.warning, "#3B82F6", colors.success];
  const label = score > 0 ? labels[score - 1] : labels[0];
  const tint = score > 0 ? colorByScore[score - 1] : colors.error;

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {segments.map((i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor: i < score ? tint : colors.divider,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 4,
    marginTop: 2,
  },
  barRow: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    minWidth: 70,
    textAlign: "right",
  },
});
