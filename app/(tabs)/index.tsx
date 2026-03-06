import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useThemeColors } from "@/constants/colors";
import { CATEGORIES } from "@/lib/seed-data";
import type { Destination } from "@/lib/storage";

function DestinationCard({ item, colors }: { item: Destination; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.95 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/destination/[id]", params: { id: item.id } });
      }}
    >
      <Image source={{ uri: item.images[0] }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={[styles.ratingText, { color: colors.text }]}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.cardLocationRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.cardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        <View style={styles.tagRow}>
          {item.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.tagBg }]}>
              <Text style={[styles.tagText, { color: colors.tagText }]}>{tag}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.cardPrice, { color: colors.primary }]}>{item.priceRange}</Text>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { destinations, refreshData, isLoading } = useData();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredDestinations = useMemo(() => {
    return destinations.filter((d) => {
      if (!d.isActive) return false;
      const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.address.toLowerCase().includes(search.toLowerCase()) ||
        d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = !selectedCategory || d.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [destinations, search, selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topSection, { paddingTop: insets.top + webTopInset + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Hello, {user?.fullName?.split(" ")[0] || "Traveler"}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Explore Vietnam</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/create-trip");
            }}
            style={({ pressed }) => [
              styles.createTripButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search destinations..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["All", ...CATEGORIES]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const isSelected = item === "All" ? !selectedCategory : selectedCategory === item;
            return (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(item === "All" ? null : item);
                }}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.inputBg,
                    borderColor: isSelected ? colors.primary : colors.inputBorder,
                  },
                ]}
              >
                <Text style={[styles.categoryChipText, { color: isSelected ? "#fff" : colors.textSecondary }]}>
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredDestinations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DestinationCard item={item} colors={colors} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="compass-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No destinations found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Try adjusting your search or filters</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { paddingHorizontal: 20, gap: 12, paddingBottom: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  createTripButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  categoryList: { gap: 8, paddingVertical: 4 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  listContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 16, paddingTop: 8 },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardImage: { width: "100%", height: 180 },
  cardContent: { padding: 14, gap: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  ratingText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardLocationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardLocation: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardPrice: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
