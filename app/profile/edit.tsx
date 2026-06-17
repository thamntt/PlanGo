import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api/query-client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserProfile } from "@/hooks/queries/use-user-community";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user, updateProfile } = useAuth();
  const qc = useQueryClient();
  const profileQuery = useUserProfile(user ? Number(user.id) : undefined);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [bio, setBio] = useState("");
  const [bioHydrated, setBioHydrated] = useState(false);
  const [initialBio, setInitialBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Hydrate bio ONCE when profile arrives — never overwrite the user's typing
  // if the query refetches in the background.
  useEffect(() => {
    if (bioHydrated) return;
    if (profileQuery.data) {
      const fromServer = profileQuery.data.bio ?? "";
      setBio(fromServer);
      setInitialBio(fromServer);
      setBioHydrated(true);
    }
  }, [profileQuery.data, bioHydrated]);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handlePickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const data = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setAvatar(data);
    }
  }, []);

  const validate = useCallback(() => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Tên cần ít nhất 2 ký tự");
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email không hợp lệ");
      return false;
    }
    setError("");
    return true;
  }, [fullName, email]);

  const handleSave = useCallback(async () => {
    if (!user || !validate()) return;
    // Optimistic flow: updateProfile() now merges locally first, then syncs
    // server in the same call. Combined with router.back() before awaiting
    // background invalidations, the profile screen shows new values instantly.
    setSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      await updateProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        avatar: avatar ?? undefined,
        bio: bio.trim(),
      } as any);
      // Background cache invalidations — no need to await before nav
      qc.invalidateQueries({ queryKey: ["blog"] });
      qc.invalidateQueries({ queryKey: ["forum"] });
      qc.invalidateQueries({ queryKey: ["userCommunity"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
    } catch (err: any) {
      setError(err?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }, [user, fullName, email, avatar, bio, validate, updateProfile, qc]);

  const dirty =
    fullName.trim() !== (user?.fullName || "") ||
    email.trim() !== (user?.email || "") ||
    avatar !== (user?.avatar || null) ||
    bio.trim() !== initialBio;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + webTopInset + 8,
              borderBottomColor: colors.divider,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.headerBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chỉnh sửa profile</Text>
          <Pressable
            onPress={handleSave}
            disabled={!dirty || saving}
            style={[
              styles.saveBtn,
              {
                backgroundColor: dirty ? colors.primary : colors.inputBg,
                opacity: saving ? 0.6 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.saveText, { color: dirty ? "#fff" : colors.textTertiary }]}>
                Lưu
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={handlePickAvatar} style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text style={styles.avatarInitial}>
                    {fullName.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              Đổi ảnh đại diện
            </Text>
          </View>

          {/* Form */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Họ và tên</Text>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nguyễn Văn A"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                maxLength={50}
              />
            </View>
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>
              {fullName.length}/50
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <Text style={[styles.helpText, { color: colors.textTertiary }]}>
              Email không hiển thị công khai trên trang cá nhân
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.text }]}>
              Giới thiệu bản thân{" "}
              <Text style={{ color: colors.textTertiary, fontFamily: "Inter_400Regular" }}>
                (không bắt buộc)
              </Text>
            </Text>
            <View
              style={[
                styles.inputBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  alignItems: "flex-start",
                  paddingVertical: 10,
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={colors.textTertiary}
                style={{ marginTop: 2 }}
              />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Vài dòng về bạn — ví dụ: 'Mê núi rừng, ưa solo travel'"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text, minHeight: 60 }]}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
            </View>
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>{bio.length}/150</Text>
          </View>

          {/* Account section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TÀI KHOẢN</Text>
            <View
              style={[
                styles.linkBox,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Pressable
                onPress={() => router.push("/profile/password" as any)}
                style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.linkIcon, { backgroundColor: "#8B5CF6" + "1A" }]}>
                  <Ionicons name="lock-closed" size={16} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkLabel, { color: colors.text }]}>Đổi mật khẩu</Text>
                  <Text style={[styles.linkDesc, { color: colors.textTertiary }]}>
                    Cập nhật mật khẩu tài khoản
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <Pressable
                onPress={() => router.push("/profile/preferences" as any)}
                style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.linkIcon, { backgroundColor: "#F97316" + "1A" }]}>
                  <MaterialCommunityIcons name="tune" size={16} color="#F97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkLabel, { color: colors.text }]}>Sở thích du lịch</Text>
                  <Text style={[styles.linkDesc, { color: colors.textTertiary }]}>
                    Cá nhân hóa gợi ý điểm đến
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
          </View>

          {/* Error */}
          {!!error && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: "#EF4444" + "12", borderColor: "#EF4444" + "44" },
              ]}
            >
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 64,
    alignItems: "center",
  },
  saveText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  avatarSection: { alignItems: "center", marginTop: 24, gap: 10 },
  avatarWrap: { position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarInitial: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: 12, fontFamily: "Inter_500Medium" },

  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 6 },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },

  charCount: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "right", marginTop: 4 },
  helpText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },

  linkBox: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  linkLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  linkDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 16,
  },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
});
