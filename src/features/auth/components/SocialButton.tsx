import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";

type Provider = "google" | "facebook" | "apple";

interface Props {
  provider: Provider;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const PROVIDER_CONFIG: Record<Provider, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  google: { icon: "logo-google", tint: "#DB4437" },
  facebook: { icon: "logo-facebook", tint: "#1877F2" },
  apple: { icon: "logo-apple", tint: "#000000" },
};

export function SocialButton({ provider, label, onPress, disabled }: Props) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const cfg = PROVIDER_CONFIG[provider];
  const iconColor = provider === "apple" && isDark ? "#fff" : cfg.tint;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <Ionicons name={cfg.icon} size={20} color={iconColor} />
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
