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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validateFullName,
  validateConfirmPassword,
} from "@/lib/validation";
import { t } from "@/lib/i18n";
import { AuthInput } from "@/features/auth/components/AuthInput";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { SocialButton } from "@/features/auth/components/SocialButton";
import { Toast } from "@/features/auth/components/Toast";
import { useToast } from "@/features/auth/hooks/useToast";
import {
  useGoogleAuth,
  useFacebookAuth,
  useAppleAuth,
} from "@/features/auth/hooks/useSocialAuth";

interface FormErrors {
  fullName?: string;
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { register, applySession } = useAuth();
  const { toast, show, close } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | "apple" | null>(null);

  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const googleAuth = useGoogleAuth();
  const facebookAuth = useFacebookAuth();
  const appleAuth = useAppleAuth();

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    const nameErr = validateFullName(fullName);
    if (nameErr) next.fullName = nameErr;
    const emailErr = validateEmail(email);
    if (emailErr) next.email = emailErr;
    const usernameErr = validateUsername(username);
    if (usernameErr) next.username = usernameErr;
    const passwordErr = validatePassword(password);
    if (passwordErr) next.password = passwordErr;
    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (confirmErr) next.confirmPassword = confirmErr;
    if (!agreed) next.terms = t().auth.mustAgreeTerms;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors({});
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await register({
      username: username.trim(),
      password,
      email: email.trim(),
      fullName: fullName.trim(),
    });
    setLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      show(result.error || t().auth.registerFailed, "error");
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
      const applied = await applySession("", result.user);
      if (applied.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } else {
        show(applied.error || t().auth.registerFailed, "error");
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      show(result.error || t().auth.registerFailed, "error");
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
          {/* Hero */}
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + webTopInset + 12 }]}
          >
            <Pressable onPress={() => router.back()} style={styles.heroBack} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.heroIconCircle}>
              <Ionicons name="rocket-outline" size={28} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>{t().auth.joinTitle}</Text>
            <Text style={styles.heroSubtitle}>{t().auth.joinSubtitle}</Text>
          </LinearGradient>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.background }]}>
            {/* Social buttons */}
            <View style={styles.socialColumn}>
              <SocialButton
                provider="google"
                label={
                  socialLoading === "google" ? "Đang xử lý..." : t().auth.continueWithGoogle
                }
                onPress={() => runSocial("google", googleAuth.login)}
                disabled={socialLoading !== null}
              />
              {Platform.OS === "ios" && appleAuth.available && (
                <SocialButton
                  provider="apple"
                  label={
                    socialLoading === "apple" ? "Đang xử lý..." : t().auth.continueWithApple
                  }
                  onPress={() => runSocial("apple", appleAuth.login)}
                  disabled={socialLoading !== null}
                />
              )}
              <SocialButton
                provider="facebook"
                label={
                  socialLoading === "facebook"
                    ? "Đang xử lý..."
                    : t().auth.continueWithFacebook
                }
                onPress={() => runSocial("facebook", facebookAuth.login)}
                disabled={socialLoading !== null}
              />
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>
                hoặc với email
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            </View>

            <View style={styles.form}>
              <AuthInput
                icon="person-outline"
                label={t().auth.fullName}
                placeholder={t().auth.fullNamePlaceholder}
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  clearError("fullName");
                }}
                error={errors.fullName}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                testID="register-fullname"
              />
              <AuthInput
                ref={emailRef}
                icon="mail-outline"
                label={t().auth.email}
                placeholder={t().auth.emailPlaceholder}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clearError("email");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.email}
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                testID="register-email"
              />
              <AuthInput
                ref={usernameRef}
                icon="at-outline"
                label={t().auth.username}
                placeholder={t().auth.usernamePlaceholder}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  clearError("username");
                }}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.username}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                testID="register-username"
              />
              <View>
                <AuthInput
                  ref={passwordRef}
                  icon="lock-closed-outline"
                  label={t().auth.password}
                  placeholder={t().auth.passwordPlaceholder}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    clearError("password");
                  }}
                  isPassword
                  error={errors.password}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  testID="register-password"
                />
                <PasswordStrengthMeter password={password} />
              </View>
              <AuthInput
                ref={confirmRef}
                icon="shield-checkmark-outline"
                label={t().auth.confirmPassword}
                placeholder={t().auth.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  clearError("confirmPassword");
                }}
                isPassword
                error={errors.confirmPassword}
                returnKeyType="go"
                onSubmitEditing={handleRegister}
                testID="register-confirm"
              />

              {/* Terms checkbox */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setAgreed((v) => !v);
                  clearError("terms");
                }}
                style={styles.termsRow}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: errors.terms ? colors.error : agreed ? colors.primary : colors.inputBorder,
                      backgroundColor: agreed ? colors.primary : "transparent",
                    },
                  ]}
                >
                  {agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                  {t().auth.agreeToTerms}{" "}
                  <Text style={[styles.termsLink, { color: colors.primary }]}>
                    {t().auth.termsOfService}
                  </Text>{" "}
                  {t().auth.and}{" "}
                  <Text style={[styles.termsLink, { color: colors.primary }]}>
                    {t().auth.privacyPolicy}
                  </Text>
                </Text>
              </Pressable>
              {errors.terms && (
                <Text style={[styles.fieldError, { color: colors.error, marginLeft: 30 }]}>
                  {errors.terms}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed || loading ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
                onPress={handleRegister}
                disabled={loading}
                testID="register-submit"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>{t().auth.createAccount}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                {t().auth.hasAccount}{" "}
              </Text>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text style={[styles.footerLink, { color: colors.primary }]}>
                  {t().auth.signIn}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={close} />}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroBack: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.92)",
    marginTop: 4,
  },
  card: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  socialColumn: { gap: 10 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  form: { gap: 14 },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  termsLink: { fontFamily: "Inter_600SemiBold" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    paddingBottom: 8,
  },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
