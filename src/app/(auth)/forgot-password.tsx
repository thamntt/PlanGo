import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/api/query-client";
import { AuthInput } from "@/features/auth/components/AuthInput";
import { Toast } from "@/features/auth/components/Toast";
import { useToast } from "@/features/auth/hooks/useToast";
import { validateEmail } from "@/lib/validation";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { toast, show, close } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailErr, setEmailErr] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const err = validateEmail(email);
    if (err) {
      setEmailErr(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setEmailErr(undefined);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim().toLowerCase() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e: any) {
      // BE always returns 200 for security (don't reveal whether email exists)
      // So this catches only network errors
      const msg = e?.message || "";
      if (msg.includes("Network") || msg.includes("Failed to fetch")) {
        show(t().auth.networkError, "error");
      } else {
        // Even on other errors, show success to user (security: don't leak account existence)
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>

          {sent ? (
            <View style={styles.successContainer}>
              <View style={[styles.successIconCircle, { backgroundColor: colors.success + "20" }]}>
                <Ionicons name="mail-outline" size={48} color={colors.success} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t().auth.resetLinkSent}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t().auth.resetLinkSentSubtitle}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.primaryButtonText}>{t().auth.backToLogin}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="key-outline" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>
                {t().auth.forgotTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t().auth.forgotSubtitle}
              </Text>

              <View style={styles.form}>
                <AuthInput
                  icon="mail-outline"
                  label={t().auth.email}
                  placeholder={t().auth.emailPlaceholder}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (emailErr) setEmailErr(undefined);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={emailErr}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  testID="forgot-email"
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
                  onPress={handleSubmit}
                  disabled={loading}
                  testID="forgot-submit"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{t().auth.sendResetLink}</Text>
                  )}
                </Pressable>

                <Pressable onPress={() => router.back()} style={styles.linkRow}>
                  <Ionicons name="arrow-back" size={16} color={colors.primary} />
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    {t().auth.backToLogin}
                  </Text>
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
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginBottom: 32,
  },
  form: { gap: 16 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 60,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
});
