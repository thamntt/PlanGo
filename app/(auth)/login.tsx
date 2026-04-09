import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { validateUsername, validatePassword } from "@/lib/validation";
import { t } from "@/lib/i18n";
import { setPendingRedirect } from "@/app/_layout";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { login, isAdmin } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; general?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    const usernameErr = validateUsername(username);
    if (usernameErr) newErrors.username = usernameErr;
    if (!password) newErrors.password = t().validation.required(t().auth.password);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setErrors({});
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.success) {
      if (redirect) {
        // Set pending redirect so AuthGate also knows where to go
        setPendingRedirect(redirect);
        router.replace(redirect as any);
      } else {
        router.replace(isAdmin ? "/admin" : "/(tabs)");
      }
    } else {
      setErrors({ general: result.error || t().auth.loginFailed });
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Ionicons name="compass" size={48} color={colors.primary} />
        <Text style={[styles.appName, { color: colors.primary }]}>{t().auth.appName}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t().auth.tagline}
        </Text>
      </View>

      {errors.general && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[styles.errorBannerText, { color: colors.error }]}>{errors.general}</Text>
        </View>
      )}

      <View style={styles.form}>
        <View>
          <View style={[
            styles.inputContainer,
            { backgroundColor: colors.inputBg, borderColor: errors.username ? colors.error : colors.inputBorder },
          ]}>
            <Ionicons name="person-outline" size={20} color={errors.username ? colors.error : colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t().auth.username}
              placeholderTextColor={colors.textTertiary}
              value={username}
              onChangeText={(t) => { setUsername(t); if (errors.username) setErrors((e) => ({ ...e, username: undefined })); }}
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-username"
            />
          </View>
          {errors.username && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.username}</Text>}
        </View>

        <View>
          <View style={[
            styles.inputContainer,
            { backgroundColor: colors.inputBg, borderColor: errors.password ? colors.error : colors.inputBorder },
          ]}>
            <Ionicons name="lock-closed-outline" size={20} color={errors.password ? colors.error : colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t().auth.password}
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }}
              secureTextEntry={!showPassword}
              testID="login-password"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
          {errors.password && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.password}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
          onPress={handleLogin}
          disabled={loading}
          testID="login-submit"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>{t().auth.signIn}</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          {t().auth.noAccount}
        </Text>
        <Pressable onPress={() => router.push("/(auth)/register")}>
          <Text style={[styles.footerLink, { color: colors.primary }]}> {t().auth.signUp}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { alignItems: "center", marginTop: 40, marginBottom: 48, gap: 8 },
  appName: { fontSize: 36, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 16, fontFamily: "Inter_400Regular" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  form: { gap: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, marginLeft: 4 },
  loginButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
  },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
