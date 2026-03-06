import React, { useState, useMemo } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useThemeColors } from "@/constants/colors";
import { PREFERENCE_OPTIONS } from "@/lib/seed-data";

function StatItem({ icon, value, label, colors }: { icon: string; value: number; label: string; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={pStyles.statItem}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <Text style={[pStyles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[pStyles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { user, logout, updateProfile, isAdmin } = useAuth();
  const { itineraries, reviews } = useData();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(user?.preferences || []);

  const myTripsCount = useMemo(() => itineraries.filter((i) => i.userId === user?.id).length, [itineraries, user]);
  const myReviewsCount = useMemo(() => reviews.filter((r) => r.userId === user?.id).length, [reviews, user]);
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

  const handleSave = async () => {
    await updateProfile({ fullName, email, phone, preferences: selectedPrefs });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
  };

  const handleCancel = () => {
    setFullName(user?.fullName || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
    setSelectedPrefs(user?.preferences || []);
    setEditing(false);
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to logout?");
      if (confirmed) {
        logout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            logout();
          },
        },
      ]);
    }
  };

  const togglePref = (pref: string) => {
    Haptics.selectionAsync();
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={[pStyles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 120 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={isDark ? [colors.primaryDark, colors.background] : [colors.primary, colors.background]}
        style={[pStyles.heroGradient, { paddingTop: insets.top + webTopInset + 12 }]}
      >
        <View style={pStyles.heroHeader}>
          <Text style={pStyles.heroTitle}>Profile</Text>
          {editing ? (
            <View style={pStyles.editActions}>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [pStyles.editActionBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [pStyles.editActionBtn, pStyles.saveBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="checkmark" size={22} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setEditing(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [pStyles.editActionBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        <View style={pStyles.avatarContainer}>
          <View style={pStyles.avatarRing}>
            <View style={[pStyles.avatar, { backgroundColor: isDark ? "#1E293B" : "#fff" }]}>
              <Text style={[pStyles.avatarText, { color: colors.primary }]}>
                {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
          </View>
          <Text style={pStyles.userName}>{user?.fullName}</Text>
          <Text style={pStyles.userHandle}>@{user?.username}</Text>
          <View style={pStyles.badgeRow}>
            {isAdmin && (
              <View style={pStyles.adminBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#fff" />
                <Text style={pStyles.adminBadgeText}>Admin</Text>
              </View>
            )}
            {memberSince ? (
              <View style={[pStyles.memberBadge, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                <Ionicons name="calendar-outline" size={11} color="#fff" />
                <Text style={pStyles.memberBadgeText}>Since {memberSince}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <View style={pStyles.body}>
        <View style={[pStyles.statsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <StatItem icon="map" value={myTripsCount} label="Trips" colors={colors} />
          <View style={[pStyles.statDivider, { backgroundColor: colors.divider }]} />
          <StatItem icon="chatbubble" value={myReviewsCount} label="Reviews" colors={colors} />
          <View style={[pStyles.statDivider, { backgroundColor: colors.divider }]} />
          <StatItem icon="heart" value={selectedPrefs.length} label="Interests" colors={colors} />
        </View>

        <View style={pStyles.section}>
          <View style={pStyles.sectionHeader}>
            <Ionicons name="person" size={18} color={colors.primary} />
            <Text style={[pStyles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
          </View>
          <View style={[pStyles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <InfoRow
              icon="person-outline"
              label="Full Name"
              value={user?.fullName || "-"}
              editing={editing}
              editValue={fullName}
              onChangeText={setFullName}
              colors={colors}
            />
            <View style={[pStyles.infoDivider, { backgroundColor: colors.divider }]} />
            <InfoRow
              icon="mail-outline"
              label="Email"
              value={user?.email || "-"}
              editing={editing}
              editValue={email}
              onChangeText={setEmail}
              colors={colors}
              keyboardType="email-address"
            />
            <View style={[pStyles.infoDivider, { backgroundColor: colors.divider }]} />
            <InfoRow
              icon="call-outline"
              label="Phone"
              value={user?.phone || "Not set"}
              editing={editing}
              editValue={phone}
              onChangeText={setPhone}
              colors={colors}
              keyboardType="phone-pad"
              placeholder="Add phone number"
            />
          </View>
        </View>

        <View style={pStyles.section}>
          <View style={pStyles.sectionHeader}>
            <Ionicons name="heart" size={18} color={colors.primary} />
            <Text style={[pStyles.sectionTitle, { color: colors.text }]}>Travel Interests</Text>
            {editing && (
              <Text style={[pStyles.sectionHint, { color: colors.textTertiary }]}>Tap to select</Text>
            )}
          </View>
          <View style={pStyles.prefsGrid}>
            {PREFERENCE_OPTIONS.map((pref) => {
              const isSelected = selectedPrefs.includes(pref);
              const prefIcons: Record<string, string> = {
                Beach: "sunny-outline", Mountain: "triangle-outline", City: "business-outline",
                Culture: "color-palette-outline", Food: "restaurant-outline", Adventure: "compass-outline",
                Relaxation: "leaf-outline", Nature: "flower-outline", History: "library-outline",
                Shopping: "bag-outline", Nightlife: "moon-outline", Photography: "camera-outline",
              };
              return (
                <Pressable
                  key={pref}
                  onPress={() => editing && togglePref(pref)}
                  style={({ pressed }) => [
                    pStyles.prefChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.cardBorder,
                      opacity: pressed && editing ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={prefIcons[pref] as any || "ellipse-outline"}
                    size={15}
                    color={isSelected ? "#fff" : colors.textSecondary}
                  />
                  <Text style={[pStyles.prefChipText, { color: isSelected ? "#fff" : colors.text }]}>
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
              pStyles.adminButton,
              { backgroundColor: colors.card, borderColor: colors.cardBorder, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            <View style={[pStyles.adminBtnIcon, { backgroundColor: colors.accent + "20" }]}>
              <Ionicons name="settings" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[pStyles.adminBtnTitle, { color: colors.text }]}>Admin Dashboard</Text>
              <Text style={[pStyles.adminBtnSub, { color: colors.textSecondary }]}>Manage users, destinations & reviews</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        )}

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            pStyles.logoutButton,
            { borderColor: colors.error, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[pStyles.logoutButtonText, { color: colors.error }]}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  editing,
  editValue,
  onChangeText,
  colors,
  keyboardType,
  placeholder,
}: {
  icon: string;
  label: string;
  value: string;
  editing: boolean;
  editValue: string;
  onChangeText: (t: string) => void;
  colors: ReturnType<typeof useThemeColors>;
  keyboardType?: "email-address" | "phone-pad";
  placeholder?: string;
}) {
  return (
    <View style={pStyles.infoRow}>
      <View style={[pStyles.infoIconBox, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[pStyles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
        {editing ? (
          <TextInput
            style={[pStyles.infoInput, { color: colors.text, borderColor: colors.inputBorder }]}
            value={editValue}
            onChangeText={onChangeText}
            placeholder={placeholder || label}
            placeholderTextColor={colors.textTertiary}
            keyboardType={keyboardType}
            autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
          />
        ) : (
          <Text style={[pStyles.infoValue, { color: value === "Not set" ? colors.textTertiary : colors.text }]}>
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

const pStyles = StyleSheet.create({
  container: { flex: 1 },
  heroGradient: { paddingBottom: 28, paddingHorizontal: 20 },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  editActions: { flexDirection: "row", gap: 8 },
  editActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: { backgroundColor: "rgba(255,255,255,0.35)" },
  avatarContainer: { alignItems: "center", gap: 6 },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  userHandle: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  adminBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  body: { paddingHorizontal: 20, marginTop: -12 },
  statsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 36 },
  section: { marginTop: 24, gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1 },
  sectionHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
  infoInput: { fontSize: 15, fontFamily: "Inter_500Medium", borderBottomWidth: 1, paddingVertical: 2, paddingHorizontal: 0 },
  infoDivider: { height: 1, marginLeft: 66 },
  prefsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prefChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  prefChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
  },
  adminBtnIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  adminBtnTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  adminBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 16,
    backgroundColor: "transparent",
  },
  logoutButtonText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
