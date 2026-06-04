import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";

interface Item {
  key: string;
  label: string;
  desc?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  onPress: () => void;
  destructive?: boolean;
  adminOnly?: boolean;
}

const SCREEN_W = Dimensions.get("window").width;
const DRAWER_W = Math.min(SCREEN_W * 0.85, 360);

export function ProfileMenuDrawer({
  visible,
  onClose,
  onOpenSettings,
  onOpenEdit,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenEdit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user, logout } = useAuth();
  const slide = useRef(new Animated.Value(0)).current;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_W, 0],
  });
  const backdropOpacity = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const handleLogout = () => {
    onClose();
    const doLogout = async () => {
      await logout();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      if (confirm("Đăng xuất khỏi tài khoản?")) doLogout();
    } else {
      Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  const items: Item[] = [
    // ─── Account ───
    {
      key: "edit",
      label: "Chỉnh sửa profile",
      desc: "Tên, ảnh, email, mật khẩu",
      icon: "account-edit",
      color: "#0891B2",
      onPress: () => {
        onClose();
        router.push("/profile/edit");
      },
    },
    {
      key: "settings",
      label: "Cài đặt",
      desc: "Giao diện, ngôn ngữ, thông báo",
      icon: "cog",
      color: "#64748B",
      onPress: () => {
        onClose();
        setTimeout(onOpenSettings, 150);
      },
    },
    // ─── Saved content ───
    {
      key: "wishlist",
      label: "Điểm đến đã lưu",
      desc: "Wishlist địa danh muốn đi",
      icon: "heart-outline",
      color: "#EF4444",
      onPress: () => {
        onClose();
        router.push("/(tabs)/index" as any);
      },
    },
    {
      key: "saved",
      label: "Bài viết đã lưu",
      desc: "Bookmark blog cộng đồng",
      icon: "bookmark-outline",
      color: "#F59E0B",
      onPress: () => {
        onClose();
        router.push("/community/bookmarks");
      },
    },
    // ─── Help & policies ───
    {
      key: "rules",
      label: "Quy tắc cộng đồng",
      desc: "Tiêu chuẩn nội dung & xử lý vi phạm",
      icon: "book-open-page-variant",
      color: "#A855F7",
      onPress: () => {
        onClose();
        router.push("/community/rules");
      },
    },
    {
      key: "help",
      label: "Trợ giúp & thông tin",
      desc: "Hướng dẫn, điều khoản, liên hệ",
      icon: "help-circle-outline",
      color: "#10B981",
      onPress: () => {
        onClose();
        // Placeholder — future help screen
      },
    },
    // ─── Admin ───
    {
      key: "admin",
      label: "Quản trị PlanGo",
      desc: "Trang admin",
      icon: "shield-crown",
      color: "#FBBF24",
      adminOnly: true,
      onPress: () => {
        onClose();
        router.push("/admin" as any);
      },
    },
    // ─── Sign out ───
    {
      key: "logout",
      label: "Đăng xuất",
      icon: "logout",
      color: "#EF4444",
      destructive: true,
      onPress: handleLogout,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_W,
              backgroundColor: colors.background,
              borderLeftColor: colors.cardBorder,
              transform: [{ translateX }],
            },
          ]}
        >
          <View
            style={[
              styles.header,
              {
                paddingTop: Math.max(insets.top, 24) + 18,
                borderBottomColor: colors.divider,
              },
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.text }]}>Tài khoản</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.items}>
            {items
              .filter((i) => !i.adminOnly || isAdmin)
              .map((it) => (
                <Pressable
                  key={it.key}
                  onPress={it.onPress}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? colors.inputBg : "transparent" },
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: it.color + "1A" }]}>
                    <MaterialCommunityIcons name={it.icon} size={20} color={it.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.rowLabel, { color: it.destructive ? "#EF4444" : colors.text }]}
                    >
                      {it.label}
                    </Text>
                    {it.desc && (
                      <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                        {it.desc}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </Pressable>
              ))}
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
            <Text style={[styles.footerText, { color: colors.textTertiary }]}>
              PlanGo · Phiên bản 1.0
            </Text>
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
    right: 0,
    borderLeftWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },

  items: { flex: 1, paddingTop: 10, paddingHorizontal: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
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

  footer: { paddingHorizontal: 18, paddingTop: 14, alignItems: "center" },
  footerText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
