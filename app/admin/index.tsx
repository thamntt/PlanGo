import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useThemeColors } from "@/constants/colors";
import { getUsers, saveUsers, type UserData } from "@/lib/storage";
import { validateDestinationName, validateAddress, validateRequired } from "@/lib/validation";

type Tab = "dashboard" | "users" | "destinations" | "reviews";

interface DestFormErrors {
  name?: string;
  address?: string;
  description?: string;
}

function StatCard({ icon, label, value, color, colors }: { icon: string; label: string; value: number; color: string; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={[adminStyles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[adminStyles.statIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[adminStyles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[adminStyles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n${message}`);
    if (confirmed) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onConfirm },
    ]);
  }
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { user: currentUser, isAdmin } = useAuth();
  const { destinations, itineraries, reviews, deleteDestination, deleteReview, updateDestination, addDestination } = useData();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const [destModalVisible, setDestModalVisible] = useState(false);
  const [editingDestId, setEditingDestId] = useState<string | null>(null);
  const [destName, setDestName] = useState("");
  const [destDesc, setDestDesc] = useState("");
  const [destAddr, setDestAddr] = useState("");
  const [destCategory, setDestCategory] = useState("City");
  const [destErrors, setDestErrors] = useState<DestFormErrors>({});

  const categories = ["City", "Beach", "Mountain", "Heritage", "Nature", "Island"];

  const loadUsers = useCallback(async () => {
    const u = await getUsers();
    setUsers(u);
    setUsersLoaded(true);
  }, []);

  if (activeTab === "users" && !usersLoaded) {
    loadUsers();
  }

  const toggleLock = async (userId: string) => {
    const allUsers = await getUsers();
    const idx = allUsers.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    allUsers[idx].isLocked = !allUsers[idx].isLocked;
    await saveUsers(allUsers);
    setUsers([...allUsers]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openAddDest = () => {
    setEditingDestId(null);
    setDestName("");
    setDestDesc("");
    setDestAddr("");
    setDestCategory("City");
    setDestErrors({});
    setDestModalVisible(true);
  };

  const openEditDest = (id: string) => {
    const dest = destinations.find((d) => d.id === id);
    if (!dest) return;
    setEditingDestId(id);
    setDestName(dest.name);
    setDestDesc(dest.description);
    setDestAddr(dest.address);
    setDestCategory(dest.category);
    setDestErrors({});
    setDestModalVisible(true);
  };

  const validateDestForm = (): boolean => {
    const newErrors: DestFormErrors = {};
    const nameErr = validateDestinationName(destName);
    if (nameErr) newErrors.name = nameErr;
    const addrErr = validateAddress(destAddr);
    if (addrErr) newErrors.address = addrErr;
    setDestErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDest = async () => {
    if (!validateDestForm()) return;

    if (editingDestId) {
      await updateDestination(editingDestId, {
        name: destName.trim(),
        description: destDesc.trim() || "A beautiful destination",
        address: destAddr.trim(),
        category: destCategory,
      });
    } else {
      await addDestination({
        name: destName.trim(),
        description: destDesc.trim() || "A beautiful destination",
        images: ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"],
        category: destCategory,
        address: destAddr.trim(),
        latitude: 16.0 + Math.random() * 6,
        longitude: 105.0 + Math.random() * 5,
        priceRange: "2-5M VND",
        tags: [destCategory],
        openHours: "Open 24 hours",
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDestModalVisible(false);
  };

  const handleDeleteDest = (id: string, name: string) => {
    confirmAction("Delete Destination", `Are you sure you want to delete "${name}"? This action cannot be undone.`, () => {
      deleteDestination(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const handleDeleteReview = (id: string) => {
    confirmAction("Delete Review", "Are you sure you want to delete this review? This action cannot be undone.", () => {
      deleteReview(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  if (!isAdmin) {
    return (
      <View style={[adminStyles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="lock-closed" size={48} color={colors.error} />
        <Text style={[adminStyles.accessDenied, { color: colors.error }]}>Access Denied</Text>
      </View>
    );
  }

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "dashboard", icon: "grid-outline", label: "Dashboard" },
    { key: "users", icon: "people-outline", label: "Users" },
    { key: "destinations", icon: "location-outline", label: "Places" },
    { key: "reviews", icon: "chatbubbles-outline", label: "Reviews" },
  ];

  return (
    <View style={[adminStyles.container, { backgroundColor: colors.background }]}>
      <View style={[adminStyles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[adminStyles.headerTitle, { color: colors.text }]}>Admin</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={adminStyles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.key);
              if (tab.key === "users") loadUsers();
            }}
            style={[
              adminStyles.tab,
              { borderBottomColor: activeTab === tab.key ? colors.primary : "transparent" },
            ]}
          >
            <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? colors.primary : colors.textTertiary} />
            <Text style={[adminStyles.tabText, { color: activeTab === tab.key ? colors.primary : colors.textTertiary }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={adminStyles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === "dashboard" && (
          <>
            <View style={adminStyles.statsGrid}>
              <StatCard icon="people" label="Users" value={users.length || 0} color="#3B82F6" colors={colors} />
              <StatCard icon="location" label="Destinations" value={destinations.length} color="#10B981" colors={colors} />
              <StatCard icon="map" label="Itineraries" value={itineraries.length} color="#F59E0B" colors={colors} />
              <StatCard icon="chatbubble" label="Reviews" value={reviews.length} color="#EF4444" colors={colors} />
            </View>
            <View style={[adminStyles.activityCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[adminStyles.activityTitle, { color: colors.text }]}>Recent Activity</Text>
              {itineraries.slice(0, 5).map((itin) => (
                <View key={itin.id} style={[adminStyles.activityRow, { borderColor: colors.divider }]}>
                  <Ionicons name="map-outline" size={16} color={colors.primary} />
                  <Text style={[adminStyles.activityText, { color: colors.textSecondary }]} numberOfLines={1}>
                    New trip: {itin.title}
                  </Text>
                  <Text style={[adminStyles.activityDate, { color: colors.textTertiary }]}>
                    {new Date(itin.createdAt).toLocaleDateString("vi-VN")}
                  </Text>
                </View>
              ))}
              {itineraries.length === 0 && (
                <Text style={[adminStyles.noData, { color: colors.textTertiary }]}>No recent activity</Text>
              )}
            </View>
          </>
        )}

        {activeTab === "users" && (
          <>
            {users.map((u) => (
              <View key={u.id} style={[adminStyles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={[adminStyles.userAvatar, { backgroundColor: u.role === "admin" ? colors.accent : colors.primary }]}>
                  <Text style={adminStyles.userAvatarText}>{u.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[adminStyles.itemTitle, { color: colors.text }]}>{u.fullName}</Text>
                  <Text style={[adminStyles.itemSub, { color: colors.textSecondary }]}>@{u.username} - {u.role}{u.isLocked ? " (Locked)" : ""}</Text>
                </View>
                {u.id !== currentUser?.id && (
                  <Pressable
                    onPress={() => toggleLock(u.id)}
                    style={[adminStyles.lockBtn, { backgroundColor: u.isLocked ? colors.error + "20" : colors.success + "20" }]}
                  >
                    <Ionicons name={u.isLocked ? "lock-closed" : "lock-open"} size={16} color={u.isLocked ? colors.error : colors.success} />
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}

        {activeTab === "destinations" && (
          <>
            <Pressable
              onPress={openAddDest}
              style={({ pressed }) => [
                adminStyles.addBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={adminStyles.addBtnText}>Add Destination</Text>
            </Pressable>
            {destinations.map((d) => (
              <View key={d.id} style={[adminStyles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[adminStyles.itemTitle, { color: colors.text }]}>{d.name}</Text>
                  <Text style={[adminStyles.itemSub, { color: colors.textSecondary }]}>{d.category} - {d.address}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => openEditDest(d.id)} hitSlop={8}>
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteDest(d.id, d.name)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === "reviews" && (
          <>
            {reviews.length === 0 ? (
              <View style={adminStyles.emptyState}>
                <Ionicons name="chatbubble-outline" size={48} color={colors.textTertiary} />
                <Text style={[adminStyles.noData, { color: colors.textTertiary }]}>No reviews yet</Text>
              </View>
            ) : (
              reviews.map((r) => {
                const dest = destinations.find((d) => d.id === r.destinationId);
                return (
                  <View key={r.id} style={[adminStyles.itemCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[adminStyles.itemTitle, { color: colors.text }]}>{r.userName}</Text>
                      <Text style={[adminStyles.itemSub, { color: colors.textSecondary }]}>
                        {dest?.name} - {r.rating}/5
                      </Text>
                      <Text style={[adminStyles.reviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                        {r.comment}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleDeleteReview(r.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={destModalVisible} animationType="slide" transparent>
        <View style={adminStyles.modalOverlay}>
          <View style={[adminStyles.modalContent, { backgroundColor: colors.card }]}>
            <View style={adminStyles.modalHeader}>
              <Text style={[adminStyles.modalTitle, { color: colors.text }]}>
                {editingDestId ? "Edit Destination" : "Add Destination"}
              </Text>
              <Pressable onPress={() => setDestModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
              <View>
                <TextInput
                  style={[adminStyles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: destErrors.name ? colors.error : colors.inputBorder }]}
                  placeholder="Destination name *"
                  placeholderTextColor={colors.textTertiary}
                  value={destName}
                  onChangeText={(t) => { setDestName(t); if (destErrors.name) setDestErrors((e) => ({ ...e, name: undefined })); }}
                />
                {destErrors.name && <Text style={[adminStyles.fieldError, { color: colors.error }]}>{destErrors.name}</Text>}
              </View>
              <View>
                <TextInput
                  style={[adminStyles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: destErrors.address ? colors.error : colors.inputBorder }]}
                  placeholder="Address *"
                  placeholderTextColor={colors.textTertiary}
                  value={destAddr}
                  onChangeText={(t) => { setDestAddr(t); if (destErrors.address) setDestErrors((e) => ({ ...e, address: undefined })); }}
                />
                {destErrors.address && <Text style={[adminStyles.fieldError, { color: colors.error }]}>{destErrors.address}</Text>}
              </View>
              <TextInput
                style={[adminStyles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, minHeight: 80 }]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textTertiary}
                value={destDesc}
                onChangeText={setDestDesc}
                multiline
              />
              <Text style={[adminStyles.categoryLabel, { color: colors.text }]}>Category</Text>
              <View style={adminStyles.categoryGrid}>
                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setDestCategory(cat)}
                    style={[
                      adminStyles.categoryChip,
                      {
                        backgroundColor: destCategory === cat ? colors.primary : colors.inputBg,
                        borderColor: destCategory === cat ? colors.primary : colors.inputBorder,
                      },
                    ]}
                  >
                    <Text style={[adminStyles.categoryChipText, { color: destCategory === cat ? "#fff" : colors.textSecondary }]}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={handleSaveDest}
                style={({ pressed }) => [
                  adminStyles.modalSaveBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={adminStyles.modalSaveBtnText}>{editingDestId ? "Update" : "Save"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const adminStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  accessDenied: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  tabBar: { flexDirection: "row", paddingHorizontal: 12 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    gap: 4,
  },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 12, paddingTop: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47%" as any,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  activityCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  activityTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 0.5 },
  activityText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  activityDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noData: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 16 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  itemTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  reviewText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  lockBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "70%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  modalInput: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, marginLeft: 4 },
  categoryLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  categoryChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalSaveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  modalSaveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
