import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
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

interface FormErrors {
  fullName?: string;
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const nameErr = validateFullName(fullName);
    if (nameErr) newErrors.fullName = nameErr;
    const emailErr = validateEmail(email);
    if (emailErr) newErrors.email = emailErr;
    const usernameErr = validateUsername(username);
    if (usernameErr) newErrors.username = usernameErr;
    const passwordErr = validatePassword(password);
    if (passwordErr) newErrors.password = passwordErr;
    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (confirmErr) newErrors.confirmPassword = confirmErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setErrors({});
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await register({ username: username.trim(), password, email: email.trim(), fullName: fullName.trim() });
    setLoading(false);
    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setErrors({ general: result.error || t().auth.registerFailed });
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderField = (
    icon: string,
    placeholder: string,
    value: string,
    onChange: (t: string) => void,
    errorKey: keyof FormErrors,
    options?: { keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean; autoCorrect?: boolean }
  ) => (
    <View>
      <View style={[
        styles.inputContainer,
        { backgroundColor: colors.inputBg, borderColor: errors[errorKey] ? colors.error : colors.inputBorder },
      ]}>
        <Ionicons name={icon as any} size={20} color={errors[errorKey] ? colors.error : colors.textTertiary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={(val) => { onChange(val); clearError(errorKey); }}
          keyboardType={options?.keyboardType}
          autoCapitalize={options?.autoCapitalize ?? "sentences"}
          secureTextEntry={options?.secureTextEntry}
          autoCorrect={options?.autoCorrect}
        />
      </View>
      {errors[errorKey] && <Text style={[styles.fieldError, { color: colors.error }]}>{errors[errorKey]}</Text>}
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t().auth.createAccount}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t().auth.startPlanning}
        </Text>
      </View>

      {errors.general && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error + "15", borderColor: colors.error + "40" }]}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[styles.errorBannerText, { color: colors.error }]}>{errors.general}</Text>
        </View>
      )}

      <View style={styles.form}>
        {renderField("person-outline", t().auth.fullName, fullName, setFullName, "fullName")}
        {renderField("mail-outline", t().auth.email, email, setEmail, "email", { keyboardType: "email-address", autoCapitalize: "none" })}
        {renderField("at-outline", t().auth.username, username, setUsername, "username", { autoCapitalize: "none", autoCorrect: false })}
        {renderField("lock-closed-outline", t().auth.password, password, setPassword, "password", { secureTextEntry: true })}
        {renderField("shield-checkmark-outline", t().auth.confirmPassword, confirmPassword, setConfirmPassword, "confirmPassword", { secureTextEntry: true })}

        <Pressable
          style={({ pressed }) => [
            styles.registerButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
          onPress={handleRegister}
          disabled={loading}
          testID="register-submit"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerButtonText}>{t().auth.createAccount}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          {t().auth.hasAccount}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.footerLink, { color: colors.primary }]}> {t().auth.signIn}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  backButton: { marginBottom: 8 },
  header: { marginBottom: 32, gap: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
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
  registerButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  registerButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
