import React, { useEffect, useRef, useState } from "react";
import { Tabs, router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet, View, Pressable, Text, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { TabBarProvider, useTabBar } from "@/contexts/TabBarContext";
import { t } from "@/lib/i18n";

// ──────────────────────────────────────────────────────────────
// Tab config — Map intentionally excluded from nav.
// ──────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  index: { label: "Khám phá", outlineIcon: "compass-outline", filledIcon: "compass" },
  community: { label: "Cộng đồng", outlineIcon: "people-outline", filledIcon: "people" },
  trips: { label: "Chuyến đi", outlineIcon: "briefcase-outline", filledIcon: "briefcase" },
  profile: { label: "Tôi", outlineIcon: "person-outline", filledIcon: "person" },
} as const;

const VISIBLE_TABS: (keyof typeof TAB_CONFIG)[] = ["index", "community", "trips", "profile"];

type ThemeColors = ReturnType<typeof useThemeColors>;

// ──────────────────────────────────────────────────────────────
// Speed-Dial FAB — Material Design pattern.
// Tap → 3 mini action cards fan out upward, backdrop dims background.
// Tap × or backdrop → collapse back to "+" icon.
// ──────────────────────────────────────────────────────────────

interface FabAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconBg: string;
  enabled: boolean;
  badge?: string;
  onPress?: () => void;
}

function FabSpeedDial({
  open,
  onClose,
  colors,
  bottom,
}: {
  open: boolean;
  onClose: () => void;
  colors: ThemeColors;
  bottom: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 9,
    }).start();
  }, [open, anim]);

  const actions: FabAction[] = [
    {
      key: "question",
      icon: "help-circle",
      label: "Đặt câu hỏi",
      iconBg: "#8B5CF6",
      enabled: true,
      onPress: () => router.push("/community/forum/create"),
    },
    {
      key: "blog",
      icon: "newspaper",
      label: "Đăng bài blog",
      iconBg: "#F97316",
      enabled: true,
      onPress: () => router.push("/community/blog/create"),
    },
    {
      key: "trip",
      icon: "airplane",
      label: "Tạo chuyến đi",
      iconBg: colors.primary,
      enabled: true,
      onPress: () => router.push("/create-trip"),
    },
  ];

  // Backdrop opacity (dim background when open)
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  return (
    <>
      {/* Backdrop — full screen, tap to close. pointerEvents="auto" only when open. */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Mini action cards — stacked upward from main FAB position */}
      <View
        style={[styles.miniActionsContainer, { bottom }]}
        pointerEvents={open ? "box-none" : "none"}
      >
        {actions.map((act, idx) => {
          const distance = 76 * (idx + 1); // stagger upward (closest = first = "trip")
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -distance],
          });
          const opacity = anim.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [0, 0, 1],
          });
          return (
            <Animated.View
              key={act.key}
              style={[
                styles.miniAction,
                {
                  opacity,
                  transform: [{ translateY }, { scale: anim }],
                },
              ]}
              pointerEvents={open ? "box-none" : "none"}
            >
              <Pressable
                onPress={() => {
                  if (!act.enabled) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    return;
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                  setTimeout(() => act.onPress?.(), 150);
                }}
                style={({ pressed }) => [
                  styles.miniActionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    opacity: act.enabled ? (pressed ? 0.85 : 1) : 0.85,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.miniActionLabel,
                    { color: act.enabled ? colors.text : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {act.label}
                </Text>
                {act.badge && (
                  <View style={[styles.miniBadge, { backgroundColor: colors.accent + "20" }]}>
                    <Text style={[styles.miniBadgeText, { color: colors.accent }]}>
                      {act.badge}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.miniActionIcon,
                    { backgroundColor: act.enabled ? act.iconBg : colors.textTertiary },
                  ]}
                >
                  <Ionicons name={act.icon} size={18} color="#fff" />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Custom Tab Bar — 4 tabs (2 left + spacer + 2 right) + center FAB
// ──────────────────────────────────────────────────────────────

function CustomTabBar({
  state,
  navigation,
  colors,
  isDark,
  fabOpen,
  setFabOpen,
}: BottomTabBarProps & {
  colors: ThemeColors;
  isDark: boolean;
  fabOpen: boolean;
  setFabOpen: (v: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabs = VISIBLE_TABS.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is NonNullable<typeof r> => !!r,
  );

  const renderTab = (route: (typeof tabs)[number]) => {
    const cfg = TAB_CONFIG[route.name as keyof typeof TAB_CONFIG];
    if (!cfg) return null;
    const realIdx = state.routes.findIndex((r) => r.name === route.name);
    const isFocused = state.index === realIdx;
    const isProfileTab = route.name === "profile";

    const handlePress = () => {
      // Close FAB menu if open when switching tabs
      if (fabOpen) setFabOpen(false);
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        Haptics.selectionAsync();
        navigation.navigate(route.name as never);
      }
    };

    // For profile tab: render user's avatar (icon-only, no label)
    if (isProfileTab) {
      return (
        <Pressable
          key={route.key}
          onPress={handlePress}
          style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View
            style={[
              styles.avatarTabWrap,
              {
                borderColor: isFocused ? colors.primary : "transparent",
                borderWidth: isFocused ? 2 : 0,
              },
            ]}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarTabImg} contentFit="cover" />
            ) : (
              <View
                style={[
                  styles.avatarTabImg,
                  {
                    backgroundColor: isFocused ? colors.primary : colors.inputBg,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Ionicons
                  name="person"
                  size={18}
                  color={isFocused ? "#fff" : colors.tabIconDefault}
                />
              </View>
            )}
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        key={route.key}
        onPress={handlePress}
        style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View
          style={[
            styles.tabIconWrap,
            {
              width: isFocused ? 48 : 32,
              backgroundColor: isFocused ? colors.primary + "1A" : "transparent",
            },
          ]}
        >
          <Ionicons
            name={(isFocused ? cfg.filledIcon : cfg.outlineIcon) as keyof typeof Ionicons.glyphMap}
            size={24}
            color={isFocused ? colors.primary : colors.tabIconDefault}
          />
        </View>
      </Pressable>
    );
  };

  const { translateY } = useTabBar();

  return (
    <Animated.View
      style={[
        styles.tabBar,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopColor: colors.divider,
          shadowOpacity: isDark ? 0.4 : 0.08,
          transform: [{ translateY }],
        },
      ]}
    >
      {isIOS && (
        <BlurView
          intensity={100}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      )}
      {isWeb && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />}

      <View style={styles.tabsRow}>
        {tabs.slice(0, 2).map(renderTab)}
        <View style={styles.fabSlot} pointerEvents="none" />
        {tabs.slice(2).map(renderTab)}
      </View>
    </Animated.View>
  );
}

// Standalone FAB component — rendered at TabLayout level (above backdrop)
// so it stays on top of the dim overlay when menu is open.
function FabButton({
  open,
  onToggle,
  colors,
  bottom,
}: {
  open: boolean;
  onToggle: () => void;
  colors: ThemeColors;
  bottom: number;
}) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { translateY } = useTabBar();

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 9,
    }).start();
  }, [open, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });

  return (
    <Animated.View
      style={[
        styles.fab,
        {
          bottom,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onToggle();
        }}
        style={({ pressed }) => [
          {
            width: "100%",
            height: "100%",
            borderRadius: FAB_SIZE / 2,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="add" size={28} color="#fff" />
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────
// Layout
// ──────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const [fabOpen, setFabOpen] = useState(false);

  const fabBottom = (insets.bottom > 0 ? insets.bottom : 10) + 12;

  return (
    <TabBarProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => (
            <CustomTabBar
              {...props}
              colors={colors}
              isDark={isDark}
              fabOpen={fabOpen}
              setFabOpen={setFabOpen}
            />
          )}
        >
          <Tabs.Screen name="index" options={{ title: TAB_CONFIG.index.label }} />
          <Tabs.Screen name="community" options={{ title: TAB_CONFIG.community.label }} />
          <Tabs.Screen name="trips" options={{ title: TAB_CONFIG.trips.label }} />
          <Tabs.Screen name="profile" options={{ title: TAB_CONFIG.profile.label }} />
          <Tabs.Screen name="map" />
        </Tabs>

        <FabSpeedDial
          open={fabOpen}
          onClose={() => setFabOpen(false)}
          colors={colors}
          bottom={fabBottom}
        />

        <FabButton
          open={fabOpen}
          onToggle={() => setFabOpen(!fabOpen)}
          colors={colors}
          bottom={fabBottom}
        />
      </View>
    </TabBarProvider>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = 56;
const FAB_SIZE = 60;

const styles = StyleSheet.create({
  // Tab bar
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 12,
    elevation: 14,
    zIndex: 10,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  tabIconWrap: {
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  avatarTabWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    padding: 1,
  },
  avatarTabImg: { width: "100%", height: "100%", borderRadius: 14 },
  fabSlot: { width: 80, height: TAB_BAR_HEIGHT },

  // FAB
  fab: {
    position: "absolute",
    alignSelf: "center",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowColor: "#0891B2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 16,
    zIndex: 20,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },

  // Speed-dial backdrop (dims background behind floating mini fabs)
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 5,
  },

  // Mini action cards container — positioned above the main FAB
  miniActionsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 15,
  },
  miniAction: {
    position: "absolute",
    bottom: 0,
  },
  miniActionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 32,
    borderWidth: 1,
    minWidth: 220,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  miniActionLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  miniActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
