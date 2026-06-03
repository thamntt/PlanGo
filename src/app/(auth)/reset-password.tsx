import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  type TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/api/query-client";
import { AuthInput } from "@/features/auth/components/AuthInput";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { Toast } from "@/features/auth/components/Toast";
import { useToast } from "@/features/auth/hooks/useToast";
import { validatePassword, validateConfirmPassword } from "@/lib/validation";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { toast, show, close } = useToast();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errs, setErrs] = useState<{ password?: string; confirm?: string }>({});

  const confirmRef = useRef<TextInput>(null);

  const submit = async () => {
    const next: typeof errs = {};
    const pwErr = validatePassword(password);
    if (pwErr) next.password = pwErr;
    const cfErr = validateConfirmPassword(password, confirm);
    if (cfErr) next.confirm = cfErr;
    setErrs(next);
    if (Object.keys(next).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!token) {
      show("Liên kết đặt lại không hợp lệ", "error");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, newPassword: password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("RESET_TOKEN_EXPIRED") || msg.includes("410")) {
        show("Liên kết đã hết hạn. Vui lòng yêu cầu link mới.", "error");
      } else if (msg.includes("RESET_TOKEN_INVALID") || msg.includes("400")) {
        show("Liên kết không hợp lệ.", "error");
      } else {
        show(msg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + webTopInset + 8,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          {done ? (
            <View style={styles.successContainer}>
              <View style={[styles.successIconCircle, { backgroundColor: colors.success + "20" }]}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Đặt lại thành công!</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Mật khẩu của bạn đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.primaryButtonText}>{t().auth.signIn}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
                Đặt lại mật khẩu
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Tạo mật khẩu mới mạnh. Sau khi đặt lại, bạn sẽ đăng nhập với mật khẩu này.
              </Text>

              <View style={styles.form}>
                <View>
                  <AuthInput
                    icon="lock-closed-outline"
                    label="Mật khẩu mới"
                    placeholder={t().auth.passwordPlaceholder}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (errs.password) setErrs((e) => ({ ...e, password: undefined }));
                    }}
                    isPassword
                    error={errs.password}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <PasswordStrengthMeter password={password} />
                </View>
                <AuthInput
                  ref={confirmRef}
                  icon="shield-checkmark-outline"
                  label={t().auth.confirmPassword}
                  placeholder={t().auth.confirmPasswordPlaceholder}
                  value={confirm}
                  onChangeText={(v) => {
                    setConfirm(v);
                    if (errs.confirm) setErrs((e) => ({ ...e, confirm: undefined }));
                  }}
                  isPassword
                  error={errs.confirm}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed || loading ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                  onPress={submit}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.primaryButtonText}>Đặt lại mật khẩu</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={close} />}
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { marginBottom: 24 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 32 },
  form: { gap: 16 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  successContainer: { alignItems: "center", gap: 16, paddingTop: 60 },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
});
