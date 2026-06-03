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
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { t } from "@/lib/i18n";
import { setPendingRedirect } from "@/app/_layout";
import { AuthInput } from "@/features/auth/components/AuthInput";
import { SocialButton } from "@/features/auth/components/SocialButton";
import { Toast } from "@/features/auth/components/Toast";
import { useToast } from "@/features/auth/hooks/useToast";
import {
  useGoogleAuth,
  useFacebookAuth,
  useAppleAuth,
} from "@/features/auth/hooks/useSocialAuth";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { login, applySession } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { toast, show: showToast, close: closeToast } = useToast();
  const googleAuth = useGoogleAuth();
  const facebookAuth = useFacebookAuth();
  const appleAuth = useAppleAuth();
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | "apple" | null>(null);

  const handleSocialSuccess = (redirectTarget?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (redirectTarget) {
      setPendingRedirect(redirectTarget);
      router.replace(redirectTarget as any);
    } else {
      router.replace("/(tabs)");
    }
  };

  const runSocial = async (
    provider: "google" | "facebook" | "apple",
    runner: () => Promise<{ success: boolean; user?: any; error?: string }>,
  ) => {
    setSocialLoading(provider);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await runner();
    setSocialLoading(null);
    if (result.success) {
      // Token đã được set vào AsyncStorage trong useSocialAuth → apply user
      const applied = await applySession(""  /* no-op token */, result.user);
      if (applied.success) {
        handleSocialSuccess(redirect);
      } else {
        showToast(applied.error || t().auth.loginFailed, "error");
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(result.error || t().auth.loginFailed, "error");
    }
  };

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  const validate = () => {
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = t().auth.emailOrUsername + " " + t().validation.required("").trim();
    if (!password) next.password = t().validation.required(t().auth.password);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors({});
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await login(identifier.trim(), password);
    setLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (redirect) {
        setPendingRedirect(redirect);
        router.replace(redirect as any);
      } else {
        router.replace("/(tabs)");
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(result.error || t().auth.loginFailed, "error");
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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + webTopInset + 24 }]}
          >
            <View style={styles.heroIconCircle}>
              <Ionicons name="compass" size={32} color="#fff" />
            </View>
            <Text style={styles.heroAppName}>{t().auth.appName}</Text>
            <Text style={styles.heroTagline}>{t().auth.tagline}</Text>
          </LinearGradient>

          {/* ── Form Card ── */}
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t().auth.welcomeBack}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t().auth.welcomeSubtitle}
            </Text>

            <View style={styles.form}>
              <AuthInput
                icon="person-outline"
                label={t().auth.emailOrUsername}
                placeholder={t().auth.emailOrUsernamePlaceholder}
                value={identifier}
                onChangeText={(v) => {
                  setIdentifier(v);
                  if (errors.identifier) setErrors((e) => ({ ...e, identifier: undefined }));
                }}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.identifier}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                testID="login-identifier"
              />
              <AuthInput
                ref={passwordRef}
                icon="lock-closed-outline"
                label={t().auth.password}
                placeholder="••••••••"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                }}
                isPassword
                error={errors.password}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                testID="login-password"
              />

              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                hitSlop={8}
                style={styles.forgotWrapper}
              >
                <Text style={[styles.forgotText, { color: colors.primary }]}>
                  {t().auth.forgotPassword}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed || loading ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
                onPress={handleLogin}
                disabled={loading}
                testID="login-submit"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>{t().auth.signIn}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>

            {/* ── Divider ── */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>
                {t().auth.orContinueWith}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            </View>

            {/* ── Social ── */}
            <View style={styles.socialColumn}>
              <SocialButton
                provider="google"
                label={
                  socialLoading === "google" ? "Đang đăng nhập..." : t().auth.continueWithGoogle
                }
                onPress={() => runSocial("google", googleAuth.login)}
                disabled={socialLoading !== null}
              />
              {Platform.OS === "ios" && appleAuth.available && (
                <SocialButton
                  provider="apple"
                  label={
                    socialLoading === "apple" ? "Đang đăng nhập..." : t().auth.continueWithApple
                  }
                  onPress={() => runSocial("apple", appleAuth.login)}
                  disabled={socialLoading !== null}
                />
              )}
              <SocialButton
                provider="facebook"
                label={
                  socialLoading === "facebook"
                    ? "Đang đăng nhập..."
                    : t().auth.continueWithFacebook
                }
                onPress={() => runSocial("facebook", facebookAuth.login)}
                disabled={socialLoading !== null}
              />
            </View>

            {/* ── Footer ── */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                {t().auth.noAccount}{" "}
              </Text>
              <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={8}>
                <Text style={[styles.footerLink, { color: colors.primary }]}>
                  {t().auth.signUp}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={closeToast} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroAppName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  heroTagline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.92)",
    marginTop: 4,
    textAlign: "center",
    maxWidth: 280,
  },
  card: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginBottom: 24,
  },
  form: { gap: 16 },
  forgotWrapper: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  socialColumn: { gap: 10 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
