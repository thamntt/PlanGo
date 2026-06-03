import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useTrips } from "@/hooks/queries/use-trips";
import { useReviews } from "@/hooks/queries/use-reviews";
import { useDestinations } from "@/hooks/queries/use-destinations";
import { useBlogPosts } from "@/hooks/queries/use-blog";
import { useForumThreads } from "@/hooks/queries/use-forum";
import { useFavorites } from "@/hooks/useFavorites";
import { queryKeys } from "@/hooks/queries/keys";
import { useQueryClient } from "@tanstack/react-query";
import { PREFERENCE_OPTIONS } from "@/lib/seed-data";
import { formatRating } from "@/features/reviews/components/StarRating";
import { t } from "@/lib/i18n";
import { apiRequest } from "@/lib/api/query-client";
import type { Destination } from "@/types";

type ThemeColors = ReturnType<typeof useThemeColors>;

// ──────────────────────────────────────────────────────────────
// Screen
// ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDark, themeMode, setThemeMode } = useSettings();
  const colors = useThemeColors(isDark);
  const { user, logout, updateProfile, isAdmin, changePassword } = useAuth();
  const qc = useQueryClient();
  const tripsQuery = useTrips(user ? { memberId: Number(user.id) } : undefined);
  const reviewsQuery = useReviews();
  const destinationsQuery = useDestinations();
  const { favorites, favoritesCount, toggleFavorite } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);
  const txt = t();

  const itineraries = tripsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const allDestinations = destinationsQuery.data ?? [];

  // ─── Modals state ──
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ─── Edit form state ──
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(user?.preferences || []);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Avatar crop modal state — Facebook-style interactive crop
  const [pickedAvatar, setPickedAvatar] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  // ─── Password form state ──
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // ─── Join code state ──
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeStatus, setJoinCodeStatus] = useState<
    "idle" | "loading" | "success" | "error" | "already"
  >("idle");
  const [joinCodeError, setJoinCodeError] = useState("");

  // ─── Stats ──
  const myTripsCount = useMemo(
    () => itineraries.filter((i) => i.userId === user?.id).length,
    [itineraries, user],
  );
  const myReviewsCount = useMemo(
    () => reviews.filter((r) => r.userId === user?.id).length,
    [reviews, user],
  );

  // Community contributions
  const userIdNum = user ? Number(user.id) : undefined;
  const myBlogQuery = useBlogPosts(userIdNum ? { authorId: userIdNum, limit: 50 } : {});
  const myForumQuery = useForumThreads(userIdNum ? { limit: 50 } : {});
  const myBlogCount = (myBlogQuery.data || []).length;
  const myThreadCount = useMemo(
    () => (myForumQuery.data || []).filter((t) => t.authorId === userIdNum).length,
    [myForumQuery.data, userIdNum],
  );
  const myCommunityCount = myBlogCount + myThreadCount;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN", { month: "short", year: "numeric" })
    : "—";

  const wishlistDestinations: Destination[] = useMemo(
    () =>
      favorites
        .map((id) => allDestinations.find((d) => d.id === id))
        .filter((d): d is Destination => !!d),
    [favorites, allDestinations],
  );

  // ─── Handlers ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([tripsQuery.refetch(), reviewsQuery.refetch(), destinationsQuery.refetch()]);
    setRefreshing(false);
  }, [tripsQuery, reviewsQuery, destinationsQuery]);

  const handlePickAvatar = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (Platform.OS === "web") alert("Cần cấp quyền truy cập thư viện ảnh");
        else Alert.alert("Cần cấp quyền", "Vui lòng cho phép truy cập thư viện ảnh");
        return;
      }
      // Don't request crop or base64 here — we do interactive crop ourselves
      // (pinch/drag in AvatarCropModal) and produce the final base64 via
      // ImageManipulator. Cleaner UX, works on web too (where system crop
      // doesn't exist).
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.uri || !asset.width || !asset.height) {
        if (Platform.OS === "web") alert("Không đọc được ảnh");
        else Alert.alert("Lỗi", "Không đọc được ảnh");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPickedAvatar({ uri: asset.uri, width: asset.width, height: asset.height });
      setAvatarPreviewOpen(true);
    } catch (err: any) {
      console.warn("Image pick error", err);
      const msg = err?.message || "Không mở được thư viện ảnh";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("Lỗi", msg);
    }
  }, []);

  /**
   * Called by AvatarCropModal with the FINAL cropped data URI (already
   * processed via ImageManipulator using the user's pan/zoom transforms).
   */
  const handleConfirmAvatar = useCallback(
    async (croppedDataUri: string) => {
      setUploadingAvatar(true);
      try {
        await updateProfile({ avatar: croppedDataUri });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAvatarPreviewOpen(false);
        setPickedAvatar(null);
      } catch (err: any) {
        console.warn("Avatar upload error", err);
        const msg = err?.message || "Không cập nhật được ảnh đại diện";
        if (Platform.OS === "web") alert(msg);
        else Alert.alert("Lỗi", msg);
      } finally {
        setUploadingAvatar(false);
      }
    },
    [updateProfile],
  );

  const handleSaveProfile = useCallback(async () => {
    setSavingProfile(true);
    await updateProfile({ fullName, email, preferences: selectedPrefs });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavingProfile(false);
    setEditProfileOpen(false);
  }, [fullName, email, selectedPrefs, updateProfile]);

  const handleChangePassword = useCallback(async () => {
    setPwdError("");
    if (!currentPwd) {
      setPwdError(txt.validation.required(txt.profile.currentPassword));
      return;
    }
    if (!newPwd || newPwd.length < 6) {
      setPwdError(txt.validation.passwordMinLength);
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError(txt.validation.passwordMismatch);
      return;
    }
    setPwdSubmitting(true);
    const result = await changePassword(currentPwd, newPwd);
    setPwdSubmitting(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === "web") alert(txt.profile.passwordChanged);
      else Alert.alert(txt.common.done, txt.profile.passwordChanged);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPasswordOpen(false);
    } else {
      setPwdError(result.error || txt.profile.wrongCurrentPassword);
    }
  }, [currentPwd, newPwd, confirmPwd, changePassword, txt]);

  const togglePref = useCallback((pref: string) => {
    Haptics.selectionAsync();
    setSelectedPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  }, []);

  const handleSavePrefs = useCallback(async () => {
    await updateProfile({ preferences: selectedPrefs });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPrefsOpen(false);
  }, [selectedPrefs, updateProfile]);

  const handleJoinByCode = useCallback(async () => {
    const code = joinCode.trim();
    if (!code) return;
    if (!user) return;
    setJoinCodeStatus("loading");
    setJoinCodeError("");
    try {
      const lookupRes = await apiRequest("GET", `/api/share/${code}`);
      const lookupJson = await lookupRes.json();
      const sharedTrip = lookupJson.data || lookupJson;

      if (sharedTrip.userId === user.id) {
        setJoinCodeStatus("already");
        return;
      }
      if ((sharedTrip.companions || []).some((c: any) => String(c.userId) === String(user.id))) {
        setJoinCodeStatus("already");
        return;
      }
      if (sharedTrip.status === "completed") {
        setJoinCodeStatus("error");
        setJoinCodeError("Không thể tham gia chuyến đi đã hoàn thành.");
        return;
      }
      const role = sharedTrip.sharePermission || "viewer";
      const joinRes = await apiRequest("POST", "/api/share/join", {
        shareCode: code,
        userId: user.id,
        role,
      });
      const joinJson = await joinRes.json();
      const joinData = joinJson.data || joinJson;
      if (joinData.alreadyJoined) {
        setJoinCodeStatus("already");
        return;
      }
      await qc.invalidateQueries({ queryKey: queryKeys.trips() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoinCodeStatus("success");
      setJoinCode("");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("404")) {
        setJoinCodeStatus("error");
        setJoinCodeError(txt.itinerary.invalidCode);
      } else {
        setJoinCodeStatus("error");
        setJoinCodeError(msg || "Không thể tham gia. Vui lòng thử lại.");
      }
    }
  }, [joinCode, user, qc, txt]);

  const confirmLogout = useCallback(() => {
    setShowLogoutModal(false);
    logout();
  }, [logout]);

  // ─── Layout ──────────────────────────────────────────────
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const firstName = user?.fullName?.split(" ").slice(-1)[0] || user?.username || "Bạn";
  const avatarInitial = (
    user?.fullName?.charAt(0) ||
    user?.username?.charAt(0) ||
    "?"
  ).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ═══════ HERO (PlanGo signature gradient + decorative blobs) ═══════ */}
        <View style={[styles.hero, { paddingTop: insets.top + webTopInset + 12 }]}>
          {/* PlanGo signature gradient — Vietnamese sunset travel palette.
              Light: indigo → magenta → coral → amber (Hạ Long Bay sunset)
              Dark : navy → violet → magenta → burnt sienna (twilight)
              Diagonal flow + decorative blobs + airplane = "đi đâu cũng được" feel. */}
          <LinearGradient
            colors={
              isDark
                ? ["#1E1B4B", "#581C87", "#9D174D", "#B45309"]
                : ["#4338CA", "#A855F7", "#EC4899", "#F59E0B"]
            }
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1.1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Secondary radial-feel gradient overlay for depth & warmth */}
          <LinearGradient
            colors={["transparent", "rgba(251,191,36,0.18)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Decorative blobs — translucent circles for depth + brand identity */}
          <View style={styles.blob1} />
          <View style={styles.blob2} />
          <View style={styles.blob3} />
          {/* Travel iconography: airplane + palm tree silhouettes (very faint) */}
          <View style={styles.heroPlane}>
            <Ionicons name="airplane" size={130} color="rgba(255,255,255,0.1)" />
          </View>
          <View style={styles.heroPalm}>
            <MaterialCommunityIcons name="palm-tree" size={90} color="rgba(255,255,255,0.08)" />
          </View>

          {/* Top action bar */}
          <View style={styles.heroTopBar}>
            <View />
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Horizontal profile row: avatar (left) + name/email/meta (right) + edit */}
          <View style={styles.heroProfile}>
            <Pressable onPress={handlePickAvatar} style={styles.avatarWrap}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={12} color="#fff" />
                )}
              </View>
            </Pressable>

            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={1}>
                {user?.fullName || firstName}
              </Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {user?.email}
              </Text>
              <View style={styles.heroMetaRow}>
                <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroMetaText}>Thành viên từ {memberSince}</Text>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <MaterialCommunityIcons name="shield-crown" size={10} color="#FBBF24" />
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
            </View>

            <Pressable
              onPress={() => {
                setFullName(user?.fullName || "");
                setEmail(user?.email || "");
                setEditProfileOpen(true);
              }}
              style={({ pressed }) => [styles.heroEditIcon, { opacity: pressed ? 0.7 : 1 }]}
              hitSlop={6}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ═══════ STATS CARD (overlap) ═══════ */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <StatTile
            icon="briefcase"
            value={myTripsCount}
            label="Chuyến đi"
            color={colors.primary}
            colors={colors}
            onPress={() => router.push("/(tabs)/trips")}
          />
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <StatTile
            icon="star"
            value={myReviewsCount}
            label="Đánh giá"
            color="#F59E0B"
            colors={colors}
          />
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <StatTile
            icon="heart"
            value={favoritesCount}
            label="Đã lưu"
            color="#EF4444"
            colors={colors}
          />
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <StatTile
            icon="newspaper"
            value={myCommunityCount}
            label="Cộng đồng"
            color="#8B5CF6"
            colors={colors}
            onPress={() => router.push("/(tabs)/community")}
          />
        </View>

        {/* ═══════ WISHLIST ═══════ */}
        <SectionHeader
          icon="heart"
          iconColor="#EF4444"
          title="Điểm đến đã lưu"
          subtitle={
            wishlistDestinations.length > 0
              ? `${wishlistDestinations.length} điểm đã lưu`
              : "Chưa lưu điểm đến nào"
          }
          colors={colors}
        />
        {wishlistDestinations.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {wishlistDestinations.map((dest) => (
              <WishlistCard
                key={dest.id}
                destination={dest}
                colors={colors}
                onPress={() =>
                  router.push({ pathname: "/destination/[id]", params: { id: dest.id } })
                }
                onRemove={() => toggleFavorite(dest.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <Pressable
            onPress={() => router.push("/(tabs)")}
            style={({ pressed }) => [
              styles.emptyWishlist,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={[styles.emptyWishlistIcon, { backgroundColor: "#EF4444" + "15" }]}>
              <Ionicons name="heart-outline" size={24} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.emptyWishlistTitle, { color: colors.text }]}>
                Chưa có điểm đến yêu thích
              </Text>
              <Text style={[styles.emptyWishlistDesc, { color: colors.textTertiary }]}>
                Khám phá và tap ❤️ trên điểm đến để lưu lại
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </Pressable>
        )}

        {/* ═══════ QUICK ACTIONS ═══════ */}
        <SectionHeader
          icon="flash"
          iconColor={colors.accent}
          title="Hành động nhanh"
          colors={colors}
        />
        <View style={styles.actionsCard}>
          <ActionRow
            icon="key-outline"
            label="Tham gia chuyến đi"
            desc="Nhập mã mời để gia nhập trip của bạn bè"
            iconBg="#10B981"
            colors={colors}
            onPress={() => {
              setJoinCode("");
              setJoinCodeStatus("idle");
              setJoinCodeError("");
              setJoinCodeOpen(true);
            }}
          />
          <ActionRow
            icon="heart-outline"
            label="Sở thích du lịch"
            desc={
              selectedPrefs.length > 0
                ? `${selectedPrefs.length} sở thích đã chọn`
                : "Chưa chọn sở thích"
            }
            iconBg="#F97316"
            colors={colors}
            onPress={() => {
              setSelectedPrefs(user?.preferences || []);
              setPrefsOpen(true);
            }}
          />
          <ActionRow
            icon="lock-closed-outline"
            label="Đổi mật khẩu"
            desc="Cập nhật mật khẩu tài khoản"
            iconBg="#8B5CF6"
            colors={colors}
            onPress={() => {
              setCurrentPwd("");
              setNewPwd("");
              setConfirmPwd("");
              setPwdError("");
              setPasswordOpen(true);
            }}
            isLast
          />
        </View>

        {/* Admin panel link — desktop Vite at admin-plango/, not in mobile routes */}

        {/* ═══════ HELP & INFO ═══════ */}
        <SectionHeader
          icon="information-outline"
          iconColor={colors.textSecondary}
          title="Trợ giúp & thông tin"
          colors={colors}
        />
        <View style={styles.actionsCard}>
          <ActionRow
            icon="help-circle-outline"
            label="Câu hỏi thường gặp"
            desc="Hướng dẫn sử dụng PlanGo"
            iconBg={colors.primary}
            colors={colors}
          />
          <ActionRow
            icon="document-text-outline"
            label="Điều khoản & chính sách"
            desc="Điều khoản dịch vụ, bảo mật"
            iconBg={colors.textSecondary}
            colors={colors}
          />
          <ActionRow
            icon="information-circle-outline"
            label="Về PlanGo"
            desc="Phiên bản 1.0.0"
            iconBg={colors.success}
            colors={colors}
            isLast
          />
        </View>

        {/* ═══════ LOGOUT ═══════ */}
        <Pressable
          onPress={() => setShowLogoutModal(true)}
          style={({ pressed }) => [
            styles.logoutBtn,
            {
              backgroundColor: colors.card,
              borderColor: "#EF4444" + "40",
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>

      {/* ═══════ MODALS ═══════ */}
      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        fullName={fullName}
        setFullName={setFullName}
        email={email}
        setEmail={setEmail}
        onSave={handleSaveProfile}
        saving={savingProfile}
        colors={colors}
      />
      <PasswordModal
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        currentPwd={currentPwd}
        setCurrentPwd={setCurrentPwd}
        newPwd={newPwd}
        setNewPwd={setNewPwd}
        confirmPwd={confirmPwd}
        setConfirmPwd={setConfirmPwd}
        error={pwdError}
        submitting={pwdSubmitting}
        onSubmit={handleChangePassword}
        colors={colors}
        txt={txt}
      />
      <PrefsModal
        visible={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        selected={selectedPrefs}
        onToggle={togglePref}
        onSave={handleSavePrefs}
        colors={colors}
      />
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        colors={colors}
        txt={txt}
      />
      <JoinCodeModal
        visible={joinCodeOpen}
        onClose={() => {
          setJoinCodeOpen(false);
          setJoinCodeStatus("idle");
        }}
        code={joinCode}
        setCode={setJoinCode}
        status={joinCodeStatus}
        error={joinCodeError}
        onSubmit={handleJoinByCode}
        colors={colors}
      />
      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        colors={colors}
        txt={txt}
      />
      <AvatarPreviewModal
        visible={avatarPreviewOpen}
        picked={pickedAvatar}
        uploading={uploadingAvatar}
        onClose={() => {
          if (!uploadingAvatar) {
            setAvatarPreviewOpen(false);
            setPickedAvatar(null);
          }
        }}
        onPickAgain={async () => {
          setAvatarPreviewOpen(false);
          setPickedAvatar(null);
          setTimeout(() => handlePickAvatar(), 200);
        }}
        onConfirm={handleConfirmAvatar}
        colors={colors}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  iconColor,
  title,
  subtitle,
  colors,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
  color,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statTile, { opacity: pressed && onPress ? 0.7 : 1 }]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </Pressable>
  );
}

function WishlistCard({
  destination,
  colors,
  onPress,
  onRemove,
}: {
  destination: Destination;
  colors: ThemeColors;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wishlistCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={{ uri: destination.images[0] }}
          style={styles.wishlistImage}
          contentFit="cover"
        />
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={styles.wishlistRemoveBtn}
          hitSlop={6}
        >
          <Ionicons name="heart" size={14} color="#EF4444" />
        </Pressable>
      </View>
      <View style={styles.wishlistContent}>
        <Text style={[styles.wishlistName, { color: colors.text }]} numberOfLines={1}>
          {destination.name}
        </Text>
        <View style={styles.wishlistMeta}>
          {destination.reviewCount > 0 ? (
            <>
              <Ionicons name="star" size={11} color={colors.star} />
              <Text style={[styles.wishlistRating, { color: colors.text }]}>
                {formatRating(destination.rating)}
              </Text>
            </>
          ) : (
            <Text style={[styles.wishlistRating, { color: colors.textTertiary }]}>Mới</Text>
          )}
          <Text style={[styles.wishlistAddress, { color: colors.textSecondary }]} numberOfLines={1}>
            · {destination.address.split(",").slice(-2, -1)[0]?.trim() || destination.address}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  desc,
  iconBg,
  colors,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc?: string;
  iconBg: string;
  colors: ThemeColors;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        {
          backgroundColor: colors.card,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: iconBg + "1A" }]}>
        <Ionicons name={icon} size={18} color={iconBg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
        {desc ? (
          <Text style={[styles.actionDesc, { color: colors.textTertiary }]}>{desc}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────
// Modals
// ──────────────────────────────────────────────────────────────

function ModalShell({
  visible,
  onClose,
  title,
  children,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalHandle, { backgroundColor: colors.divider }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  colors,
  secure,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  colors: ThemeColors;
  secure?: boolean;
  keyboardType?: "email-address" | "default";
}) {
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secure}
        keyboardType={keyboardType || "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={[
          styles.formInput,
          { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, color: colors.text },
        ]}
      />
    </View>
  );
}

function EditProfileModal({
  visible,
  onClose,
  fullName,
  setFullName,
  email,
  setEmail,
  onSave,
  saving,
  colors,
}: any) {
  return (
    <ModalShell visible={visible} onClose={onClose} title="Chỉnh sửa hồ sơ" colors={colors}>
      <FormField
        label="Họ tên"
        value={fullName}
        onChange={setFullName}
        placeholder="Nguyễn Văn A"
        colors={colors}
      />
      <FormField
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="email@example.com"
        colors={colors}
        keyboardType="email-address"
      />
      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => [
          styles.modalPrimaryBtn,
          { backgroundColor: colors.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.modalPrimaryText}>Lưu thay đổi</Text>
        )}
      </Pressable>
    </ModalShell>
  );
}

function PasswordModal({
  visible,
  onClose,
  currentPwd,
  setCurrentPwd,
  newPwd,
  setNewPwd,
  confirmPwd,
  setConfirmPwd,
  error,
  submitting,
  onSubmit,
  colors,
  txt,
}: any) {
  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title={txt.profile.changePassword || "Đổi mật khẩu"}
      colors={colors}
    >
      <FormField
        label={txt.profile.currentPassword || "Mật khẩu hiện tại"}
        value={currentPwd}
        onChange={setCurrentPwd}
        placeholder="••••••••"
        colors={colors}
        secure
      />
      <FormField
        label={txt.profile.newPassword || "Mật khẩu mới"}
        value={newPwd}
        onChange={setNewPwd}
        placeholder="Ít nhất 6 ký tự"
        colors={colors}
        secure
      />
      <FormField
        label={txt.profile.confirmPassword || "Xác nhận mật khẩu"}
        value={confirmPwd}
        onChange={setConfirmPwd}
        placeholder="••••••••"
        colors={colors}
        secure
      />
      {error ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: "#EF4444" + "15", borderColor: "#EF4444" + "40" },
          ]}
        >
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={({ pressed }) => [
          styles.modalPrimaryBtn,
          { backgroundColor: colors.primary, opacity: submitting ? 0.6 : pressed ? 0.85 : 1 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.modalPrimaryText}>Cập nhật mật khẩu</Text>
        )}
      </Pressable>
    </ModalShell>
  );
}

function PrefsModal({ visible, onClose, selected, onToggle, onSave, colors }: any) {
  return (
    <ModalShell visible={visible} onClose={onClose} title="Sở thích du lịch" colors={colors}>
      <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
        Chọn các loại hình bạn thích để PlanGo gợi ý điểm đến phù hợp
      </Text>
      <View style={styles.prefsGrid}>
        {PREFERENCE_OPTIONS.map((pref) => {
          const active = selected.includes(pref);
          return (
            <Pressable
              key={pref}
              onPress={() => onToggle(pref)}
              style={[
                styles.prefChip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.prefChipText, { color: active ? "#fff" : colors.text }]}>
                {pref}
              </Text>
              {active && <Ionicons name="checkmark" size={14} color="#fff" />}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={onSave}
        style={({ pressed }) => [
          styles.modalPrimaryBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.modalPrimaryText}>Lưu sở thích</Text>
      </Pressable>
    </ModalShell>
  );
}

function SettingsModal({ visible, onClose, themeMode, setThemeMode, colors, txt }: any) {
  const themeModes: {
    key: "system" | "light" | "dark";
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "system", label: txt.settings.system || "Hệ thống", icon: "phone-portrait-outline" },
    { key: "light", label: txt.settings.light || "Sáng", icon: "sunny-outline" },
    { key: "dark", label: txt.settings.dark || "Tối", icon: "moon-outline" },
  ];
  return (
    <ModalShell visible={visible} onClose={onClose} title="Cài đặt" colors={colors}>
      <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>Giao diện</Text>
      <View style={styles.themeRow}>
        {themeModes.map((m) => {
          const active = themeMode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setThemeMode(m.key)}
              style={[
                styles.themeOption,
                {
                  backgroundColor: active ? colors.primary + "1A" : colors.card,
                  borderColor: active ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Ionicons
                name={m.icon}
                size={20}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.themeLabel, { color: active ? colors.primary : colors.text }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ModalShell>
  );
}

function JoinCodeModal({ visible, onClose, code, setCode, status, error, onSubmit, colors }: any) {
  return (
    <ModalShell visible={visible} onClose={onClose} title="Tham gia chuyến đi" colors={colors}>
      <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
        Nhập mã chia sẻ từ bạn bè để cùng tham gia chuyến đi
      </Text>
      <FormField
        label="Mã chia sẻ"
        value={code}
        onChange={setCode}
        placeholder="VD: ABC123"
        colors={colors}
      />
      {status === "error" && error ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: "#EF4444" + "15", borderColor: "#EF4444" + "40" },
          ]}
        >
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
      {status === "already" && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: "#F59E0B" + "15", borderColor: "#F59E0B" + "40" },
          ]}
        >
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={{ color: "#F59E0B", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>
            Bạn đã tham gia chuyến đi này rồi
          </Text>
        </View>
      )}
      {status === "success" && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: "#10B981" + "15", borderColor: "#10B981" + "40" },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={{ color: "#10B981", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>
            Tham gia chuyến đi thành công!
          </Text>
        </View>
      )}
      <Pressable
        onPress={onSubmit}
        disabled={status === "loading"}
        style={({ pressed }) => [
          styles.modalPrimaryBtn,
          {
            backgroundColor: colors.primary,
            opacity: status === "loading" ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {status === "loading" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.modalPrimaryText}>Tham gia</Text>
        )}
      </Pressable>
    </ModalShell>
  );
}

const CROP_SIZE = 280;

function AvatarPreviewModal({
  visible,
  picked,
  uploading,
  onClose,
  onPickAgain,
  onConfirm,
  colors,
}: {
  visible: boolean;
  picked: { uri: string; width: number; height: number } | null;
  uploading: boolean;
  onClose: () => void;
  onPickAgain: () => void;
  onConfirm: (croppedDataUri: string) => void;
  colors: ThemeColors;
}) {
  // Animated transform shared values — driven by pinch + pan gestures.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const [processing, setProcessing] = useState(false);

  // Reset transforms when a new image is picked.
  React.useEffect(() => {
    if (visible && picked) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTx.value = 0;
      savedTy.value = 0;
    }
  }, [visible, picked]);

  // ─── Compute initial "cover" scale: image must fully cover the square
  // viewport. If image aspect > 1, cover by HEIGHT; if < 1, cover by WIDTH.
  // (The picker returns ANY aspect ratio since we removed allowsEditing.)
  const baseWidth = picked?.width || 1;
  const baseHeight = picked?.height || 1;
  const aspectRatio = baseWidth / baseHeight;
  // Image is displayed at this size at scale=1 (covers the viewport)
  const initialDisplayWidth = aspectRatio >= 1 ? CROP_SIZE * aspectRatio : CROP_SIZE;
  const initialDisplayHeight = aspectRatio >= 1 ? CROP_SIZE : CROP_SIZE / aspectRatio;

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      "worklet";
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      "worklet";
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      "worklet";
      translateX.value = savedTx.value + e.translationX;
      translateY.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      "worklet";
      savedTx.value = translateX.value;
      savedTy.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleZoom = (delta: number) => {
    const next = Math.max(1, Math.min(scale.value + delta, 5));
    scale.value = withSpring(next, { damping: 18, stiffness: 200 });
    savedScale.value = next;
  };

  const handleReset = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const handleApply = async () => {
    if (!picked) return;
    setProcessing(true);
    try {
      // Read current transform values (off the worklet, on JS thread)
      const s = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;

      // Image displayed dimensions inside viewport at current transform
      const displayedW = initialDisplayWidth * s;
      const displayedH = initialDisplayHeight * s;

      // Top-left of displayed image relative to viewport's top-left
      // (image is centered in viewport, then translated by user)
      const imgLeft = (CROP_SIZE - displayedW) / 2 + tx;
      const imgTop = (CROP_SIZE - displayedH) / 2 + ty;

      // Map viewport's visible square (0..CROP_SIZE) → original asset coords
      const assetToDisplay = displayedW / baseWidth; // px-original-per-px-display
      let originX = -imgLeft / assetToDisplay;
      let originY = -imgTop / assetToDisplay;
      let cropW = CROP_SIZE / assetToDisplay;
      let cropH = CROP_SIZE / assetToDisplay;

      // Clamp to actual image bounds (in case user dragged past edges)
      originX = Math.max(0, Math.min(originX, baseWidth - cropW));
      originY = Math.max(0, Math.min(originY, baseHeight - cropH));
      cropW = Math.min(cropW, baseWidth - originX);
      cropH = Math.min(cropH, baseHeight - originY);
      // Force square crop (use smaller dim if there's drift)
      const finalSize = Math.min(cropW, cropH);

      const result = await ImageManipulator.manipulateAsync(
        picked.uri,
        [
          { crop: { originX, originY, width: finalSize, height: finalSize } },
          { resize: { width: 400, height: 400 } },
        ],
        {
          base64: true,
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      if (!result.base64) throw new Error("Crop không trả về dữ liệu");
      const dataUri = `data:image/jpeg;base64,${result.base64}`;
      onConfirm(dataUri);
    } catch (err: any) {
      console.warn("Crop error", err);
      const msg = err?.message || "Không cắt được ảnh";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("Lỗi", msg);
    } finally {
      setProcessing(false);
    }
  };

  const isWorking = uploading || processing;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isWorking ? undefined : onClose}
      statusBarTranslucent
    >
      <View style={styles.cropOverlay}>
        <View style={[styles.cropCard, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.cropHeader}>
            <Pressable onPress={isWorking ? undefined : onClose} hitSlop={8} disabled={isWorking}>
              <Ionicons
                name="close"
                size={24}
                color={isWorking ? colors.textTertiary : colors.text}
              />
            </Pressable>
            <Text style={[styles.cropTitle, { color: colors.text }]}>Cắt ảnh đại diện</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={[styles.cropHint, { color: colors.textSecondary }]}>
            Kéo để di chuyển · Chụm hai ngón để phóng to/thu nhỏ
          </Text>

          {/* ── Crop viewport (square, clips overflow). Image inside is freely
                transformable via pan + pinch gestures. ── */}
          <View style={styles.cropViewportWrap}>
            <View style={[styles.cropViewport, { backgroundColor: "#000" }]}>
              {picked ? (
                <GestureDetector gesture={gesture}>
                  <Animated.Image
                    source={{ uri: picked.uri }}
                    style={[
                      {
                        width: initialDisplayWidth,
                        height: initialDisplayHeight,
                        position: "absolute",
                        left: (CROP_SIZE - initialDisplayWidth) / 2,
                        top: (CROP_SIZE - initialDisplayHeight) / 2,
                      },
                      animatedStyle,
                    ]}
                    resizeMode="cover"
                  />
                </GestureDetector>
              ) : null}
              {/* Circle mask overlay (purely visual — final crop is still square) */}
              <View style={styles.cropCircleGuide} pointerEvents="none" />
              {/* Grid lines for composition */}
              <View style={[styles.cropGridV, { left: CROP_SIZE / 3 }]} pointerEvents="none" />
              <View
                style={[styles.cropGridV, { left: (CROP_SIZE * 2) / 3 }]}
                pointerEvents="none"
              />
              <View style={[styles.cropGridH, { top: CROP_SIZE / 3 }]} pointerEvents="none" />
              <View style={[styles.cropGridH, { top: (CROP_SIZE * 2) / 3 }]} pointerEvents="none" />
            </View>
          </View>

          {/* Zoom controls — icon-only for consistent sizing */}
          <View style={styles.cropControlsRow}>
            <Pressable
              onPress={() => handleZoom(-0.3)}
              disabled={isWorking}
              style={({ pressed }) => [
                styles.cropCtrlBtn,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={handleReset}
              disabled={isWorking}
              style={({ pressed }) => [
                styles.cropCtrlBtn,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="refresh" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => handleZoom(0.3)}
              disabled={isWorking}
              style={({ pressed }) => [
                styles.cropCtrlBtn,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Bottom action buttons */}
          <View style={styles.cropBtnRow}>
            <Pressable
              onPress={onPickAgain}
              disabled={isWorking}
              style={({ pressed }) => [
                styles.cropActionBtn,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  borderWidth: 1,
                  opacity: isWorking ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="images-outline" size={16} color={colors.text} />
              <Text style={[styles.cropActionText, { color: colors.text }]}>Đổi ảnh</Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              disabled={isWorking}
              style={({ pressed }) => [
                styles.cropActionBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isWorking ? 0.8 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isWorking ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.cropActionText, { color: "#fff" }]}>
                    {processing ? "Đang xử lý..." : "Đang lưu..."}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={[styles.cropActionText, { color: "#fff" }]}>Áp dụng</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LogoutModal({ visible, onClose, onConfirm, colors, txt }: any) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.confirmCard, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.confirmIcon, { backgroundColor: "#EF4444" + "15" }]}>
            <Ionicons name="log-out-outline" size={32} color="#EF4444" />
          </View>
          <Text style={[styles.confirmTitle, { color: colors.text }]}>Đăng xuất?</Text>
          <Text style={[styles.confirmDesc, { color: colors.textSecondary }]}>
            {txt.profile.logoutConfirm}
          </Text>
          <View style={styles.confirmBtnRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  borderWidth: 1,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.confirmBtnText, { color: colors.text }]}>
                {txt.common.cancel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: "#EF4444", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.confirmBtnText, { color: "#fff" }]}>Đăng xuất</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero (compact horizontal + signature gradient)
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  heroTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroProfile: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { width: 64, height: 64, position: "relative" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.95)",
  },
  avatarPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  heroInfo: { flex: 1, gap: 2 },
  heroName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  heroEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    flexWrap: "wrap",
  },
  heroMetaText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.9)" },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(251,191,36,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 4,
  },
  adminBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FBBF24" },
  heroEditIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Stats card (overlapping hero)
  statsCard: {
    marginHorizontal: 20,
    marginTop: -32,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statTile: { flex: 1, alignItems: "center", gap: 4 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 8 },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Wishlist
  wishlistCard: {
    width: 200,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  wishlistImage: { width: "100%", height: 110 },
  wishlistRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  wishlistContent: { padding: 10, gap: 4 },
  wishlistName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  wishlistMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  wishlistRating: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  wishlistAddress: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },

  emptyWishlist: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  emptyWishlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWishlistTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyWishlistDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Actions
  actionsCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  actionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#EF4444" },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "85%",
  },
  modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 18 },
  modalPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  modalPrimaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  formLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  formInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  prefsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  prefChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  prefChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  themeRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  themeOption: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Confirm modal (centered)
  confirmCard: {
    marginHorizontal: 36,
    padding: 24,
    borderRadius: 20,
    alignSelf: "center",
    width: undefined,
    minWidth: 280,
    maxWidth: 360,
    alignItems: "center",
    gap: 10,
    marginTop: "auto",
    marginBottom: "auto",
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  confirmDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  confirmBtnRow: { flexDirection: "row", gap: 10, marginTop: 14, width: "100%" },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  confirmBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  // Avatar crop modal (Facebook-style interactive crop)
  cropOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cropCard: {
    width: "100%",
    maxWidth: 400,
    padding: 18,
    borderRadius: 24,
    gap: 10,
  },
  cropHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cropTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  cropHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  cropViewportWrap: { alignItems: "center", marginVertical: 8 },
  cropViewport: {
    width: 280,
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  cropCircleGuide: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    margin: 4,
  },
  cropGridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  cropGridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  cropControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  cropCtrlBtn: {
    width: 40,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cropBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cropActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  cropActionText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  // Decorative blobs in hero gradient — tuned to sunset palette
  blob1: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(254,215,170,0.35)", // warm amber glow (sun)
  },
  blob2: {
    position: "absolute",
    bottom: -70,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(167,139,250,0.3)", // violet
  },
  blob3: {
    position: "absolute",
    top: 60,
    left: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(244,114,182,0.3)", // pink accent
  },
  heroPlane: {
    position: "absolute",
    top: 0,
    right: -10,
    transform: [{ rotate: "-20deg" }],
  },
  heroPalm: {
    position: "absolute",
    bottom: -10,
    left: 8,
    transform: [{ rotate: "-8deg" }],
  },
});
