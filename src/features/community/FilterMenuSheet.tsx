import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export type FilterMode = "all" | "following" | "liked" | "bookmarked" | "mine";

interface MenuItem {
  key: FilterMode;
  label: string;
  desc: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  requireLogin?: boolean;
}

const ITEMS: MenuItem[] = [
  {
    key: "all",
    label: "Tất cả",
    desc: "Bài viết & câu hỏi mới nhất",
    icon: "earth",
    color: "#0EA5E9",
  },
  {
    key: "following",
    label: "Đang theo dõi",
    desc: "Chỉ từ tác giả bạn theo dõi",
    icon: "account-multiple-check",
    color: "#A855F7",
    requireLogin: true,
  },
  {
    key: "liked",
    label: "Đã thích",
    desc: "Bài bạn đã tim",
    icon: "heart",
    color: "#EF4444",
    requireLogin: true,
  },
  {
    key: "bookmarked",
    label: "Đã lưu",
    desc: "Bài đã bookmark để đọc lại",
    icon: "bookmark",
    color: "#F59E0B",
    requireLogin: true,
  },
];

const SCREEN_W = Dimensions.get("window").width;
const DRAWER_W = Math.min(SCREEN_W * 0.85, 360);

export function FilterMenuSheet({
  visible,
  onClose,
  current,
  onSelect,
  isLoggedIn,
}: {
  visible: boolean;
  onClose: () => void;
  current: FilterMode;
  onSelect: (m: FilterMode) => void;
  isLoggedIn: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_W, 0],
  });
  const backdropOpacity = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const handlePick = (item: MenuItem) => {
    if (item.requireLogin && !isLoggedIn) {
      onClose();
      router.push("/(auth)/login");
      return;
    }
    Haptics.selectionAsync();
    onSelect(item.key);
    onClose();
  };

  const goToProfile = () => {
    if (!user) {
      onClose();
      router.push("/(auth)/login");
      return;
    }
    onClose();
    router.push({ pathname: "/user/[id]", params: { id: String(user.id) } });
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_W,
              backgroundColor: colors.background,
              borderRightColor: colors.cardBorder,
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Header with profile snapshot */}
          <View style={[styles.header, { paddingTop: insets.top + webTopInset + 14 }]}>
            <Pressable onPress={goToProfile} style={styles.profileRow}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" />
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
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 20 }}>
                    {user?.fullName?.charAt(0).toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {user?.fullName || "Khách"}
                </Text>
                <Text style={[styles.userSub, { color: colors.textSecondary }]}>
                  {user ? "Xem trang công khai" : "Đăng nhập để xem"}
                </Text>
              </View>
              {user && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
            </Pressable>
          </View>

          {/* Items */}
          <View style={styles.items}>
            {ITEMS.map((it) => {
              const active = current === it.key;
              return (
                <Pressable
                  key={it.key}
                  onPress={() => handlePick(it)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: active ? it.color + "12" : "transparent",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: it.color + "1A" }]}>
                    <MaterialCommunityIcons name={it.icon} size={20} color={it.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{it.label}</Text>
                    <Text
                      style={[styles.rowDesc, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {it.desc}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={20} color={it.color} />
                  ) : it.requireLogin && !isLoggedIn ? (
                    <Ionicons name="lock-closed" size={13} color={colors.textTertiary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.divider, paddingBottom: insets.bottom + 14 },
            ]}
          >
            <Pressable
              onPress={() => {
                onClose();
                router.push("/community/rules");
              }}
              style={styles.footerRow}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant"
                size={18}
                color={colors.textSecondary}
              />
              <Text style={[styles.footerText, { color: colors.text }]}>Quy tắc cộng đồng</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },

  header: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  userName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  userSub: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },

  items: { flex: 1, paddingTop: 10, paddingHorizontal: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  rowDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  footerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
