import React, { forwardRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";

interface AuthInputProps extends Omit<TextInputProps, "style"> {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  error?: string;
  rightSlot?: React.ReactNode;
  /** Show password toggle (eye icon). Sets secureTextEntry automatically. */
  isPassword?: boolean;
}

export const AuthInput = forwardRef<TextInput, AuthInputProps>(
  ({ icon, label, error, rightSlot, isPassword, ...textInputProps }, ref) => {
    const { isDark } = useSettings();
    const colors = useThemeColors(isDark);
    const [show, setShow] = useState(false);
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? colors.error
      : focused
        ? colors.primary
        : colors.inputBorder;

    return (
      <View style={styles.wrapper}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.inputBg,
              borderColor,
              borderWidth: focused ? 1.5 : 1,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={20}
            color={error ? colors.error : focused ? colors.primary : colors.textTertiary}
          />
          <TextInput
            ref={ref}
            style={[styles.input, { color: colors.text }]}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={isPassword && !show}
            onFocus={(e) => {
              setFocused(true);
              textInputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              textInputProps.onBlur?.(e);
            }}
            {...textInputProps}
          />
          {isPassword ? (
            <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
              <Ionicons
                name={show ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textTertiary}
              />
            </Pressable>
          ) : (
            rightSlot
          )}
        </View>
        {error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}
      </View>
    );
  },
);

AuthInput.displayName = "AuthInput";

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
