import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeColors } from "@/constants/colors";
import { PREFERENCE_OPTIONS } from "@/lib/seed-data";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { user, logout, updateProfile, isAdmin } = useAuth();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(user?.preferences || []);

  const handleSave = async () => {
    await updateProfile({ fullName, email, phone, preferences: selectedPrefs });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const togglePref = (pref: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + webTopInset + 8, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <Pressable
          onPress={() => {
            if (editing) {
              handleSave();
            } else {
              setEditing(true);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons name={editing ? "checkmark" : "create-outline"} size={24} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[styles.avatarSection, { borderColor: colors.cardBorder }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName}</Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>@{user?.username}</Text>
        {isAdmin && (
          <View style={[styles.adminBadge, { backgroundColor: colors.accent }]}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Info</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            {editing ? (
              <TextInput
                style={[styles.infoInput, { color: colors.text, borderColor: colors.inputBorder }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor={colors.textTertiary}
              />
            ) : (
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.fullName || "-"}</Text>
            )}
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            {editing ? (
              <TextInput
                style={[styles.infoInput, { color: colors.text, borderColor: colors.inputBorder }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
              />
            ) : (
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email || "-"}</Text>
            )}
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            {editing ? (
              <TextInput
                style={[styles.infoInput, { color: colors.text, borderColor: colors.inputBorder }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={[styles.infoValue, { color: colors.text }]}>{user?.phone || "-"}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Travel Preferences</Text>
        <View style={styles.prefsGrid}>
          {PREFERENCE_OPTIONS.map((pref) => {
            const isSelected = selectedPrefs.includes(pref);
            return (
              <Pressable
                key={pref}
                onPress={() => {
                  if (editing) {
                    Haptics.selectionAsync();
                    togglePref(pref);
                  }
                }}
                style={[
                  styles.prefChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.inputBg,
                    borderColor: isSelected ? colors.primary : colors.inputBorder,
                    opacity: editing ? 1 : 0.8,
                  },
                ]}
              >
                <Text style={[styles.prefChipText, { color: isSelected ? "#fff" : colors.textSecondary }]}>
                  {pref}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isAdmin && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/admin");
          }}
          style={({ pressed }) => [
            styles.adminButton,
            { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="settings-outline" size={20} color="#fff" />
          <Text style={styles.adminButtonText}>Admin Dashboard</Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          { backgroundColor: colors.error, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  avatarSection: { alignItems: "center", paddingVertical: 20, gap: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  userName: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  adminBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  section: { marginTop: 20, gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 14, borderWidth: 1, padding: 4, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoValue: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  infoInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", borderBottomWidth: 1, paddingVertical: 4 },
  infoDivider: { height: 1, marginHorizontal: 14 },
  prefsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prefChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  prefChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  adminButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  logoutButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
