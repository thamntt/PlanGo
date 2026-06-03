"use no memo";
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useDestinations } from "@/hooks/queries/use-destinations";
import { useTrips } from "@/hooks/queries/use-trips";
import { t } from "@/lib/i18n";
import RouteMap from "@/components/RouteMap";
import type { Destination } from "@/types";
import { formatRating } from "@/features/reviews/components/StarRating";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const { data: destinations = [] } = useDestinations();
  const { data: itineraries = [] } = useTrips(user ? { memberId: Number(user.id) } : undefined);

  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const getLocation = async () => {
    setLoadingLocation(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc);
    } catch (e) {
      console.log("Location error:", e);
    }
    setLoadingLocation(false);
  };

  useEffect(() => {
    if (permission?.granted) {
      getLocation();
    }
  }, [permission?.granted]);

  const activeDestinations = destinations.filter((d) => d.isActive);
  const mapPoints = useMemo(
    () =>
      activeDestinations.map((d) => ({
        lat: d.latitude,
        lng: d.longitude,
        name: d.name,
        type: d.category.toLowerCase(),
        destId: d.id,
      })),
    [activeDestinations],
  );

  // Find the itinerary that contains a given destination
  const findItineraryForDestination = (destId: string, destName: string) => {
    // Only consider user's own itineraries
    const userItineraries = itineraries.filter((it) => it.userId === user?.id);
    // First try by destinationId in activities
    for (const it of userItineraries) {
      for (const day of it.days) {
        for (const act of day.activities) {
          if (act.destinationId === destId) return it.id;
        }
      }
    }
    // Fallback: match by activity title
    for (const it of userItineraries) {
      for (const day of it.days) {
        for (const act of day.activities) {
          if (act.title === destName) return it.id;
        }
      }
    }
    return null;
  };

  const handleMarkerPress = (point: { lat: number; lng: number; name: string; index?: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx =
      point.index ?? mapPoints.findIndex((p) => p.lat === point.lat && p.lng === point.lng);
    const dest = activeDestinations[idx];
    if (!dest) return;
    const itineraryId = findItineraryForDestination(dest.id, dest.name);
    if (itineraryId) {
      router.push({ pathname: "/itinerary/[id]", params: { id: itineraryId } });
    } else {
      router.push({ pathname: "/destination/[id]", params: { id: dest.id } });
    }
  };

  const userLoc = useMemo(
    () => (location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null),
    [location],
  );

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t().map.title}</Text>
        <View style={styles.headerActions}>
          <View style={[styles.viewToggle, { backgroundColor: colors.inputBg }]}>
            <Pressable
              onPress={() => {
                setViewMode("map");
                Haptics.selectionAsync();
              }}
              style={[
                styles.viewToggleBtn,
                viewMode === "map" && { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons
                name="map"
                size={16}
                color={viewMode === "map" ? "#fff" : colors.textSecondary}
              />
            </Pressable>
            <Pressable
              onPress={() => {
                setViewMode("list");
                Haptics.selectionAsync();
              }}
              style={[
                styles.viewToggleBtn,
                viewMode === "list" && { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === "list" ? "#fff" : colors.textSecondary}
              />
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (permission?.granted) {
                getLocation();
              } else {
                requestPermission();
              }
            }}
            style={({ pressed }) => [
              styles.refreshButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            {loadingLocation ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="locate" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      {!permission?.granted ? (
        <View
          style={[
            styles.permissionCard,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Ionicons name="location-outline" size={48} color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            {t().map.locationAccess}
          </Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            {t().map.locationDesc}
          </Text>
          <Pressable
            onPress={() => requestPermission()}
            style={({ pressed }) => [
              styles.permissionButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.permissionButtonText}>{t().map.enableLocation}</Text>
          </Pressable>
        </View>
      ) : viewMode === "map" ? (
        <View style={styles.mapContainer}>
          <RouteMap
            points={mapPoints}
            height={Platform.OS === "web" ? 500 : 400}
            colors={colors as any}
            showRoute={false}
            userLocation={userLoc}
            onMarkerPress={handleMarkerPress}
          />
          <View style={[styles.mapOverlay, { backgroundColor: colors.card + "E0" }]}>
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={[styles.mapOverlayText, { color: colors.text }]}>
              {activeDestinations.length} {t().map.totalDestinations}
            </Text>
            {userLoc && (
              <Text style={[styles.mapOverlayCoord, { color: colors.textSecondary }]}>
                📍 {userLoc.lat.toFixed(4)}, {userLoc.lng.toFixed(4)}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {userLoc && (
            <View
              style={[
                styles.locationCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={styles.locationHeader}>
                <Ionicons name="navigate" size={20} color={colors.primary} />
                <Text style={[styles.locationTitle, { color: colors.text }]}>
                  {t().map.yourLocation}
                </Text>
              </View>
              <View style={styles.coordsRow}>
                <View style={[styles.coordBox, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.coordLabel, { color: colors.textSecondary }]}>
                    {t().map.latitude}
                  </Text>
                  <Text style={[styles.coordValue, { color: colors.text }]}>
                    {userLoc.lat.toFixed(4)}
                  </Text>
                </View>
                <View style={[styles.coordBox, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.coordLabel, { color: colors.textSecondary }]}>
                    {t().map.longitude}
                  </Text>
                  <Text style={[styles.coordValue, { color: colors.text }]}>
                    {userLoc.lng.toFixed(4)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t().map.destinations}</Text>
          {activeDestinations.map((dest) => (
            <Pressable
              key={dest.id}
              style={({ pressed }) => [
                styles.destRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  opacity: pressed ? 0.95 : 1,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const itineraryId = findItineraryForDestination(dest.id, dest.name);
                if (itineraryId) {
                  router.push({ pathname: "/itinerary/[id]", params: { id: itineraryId } });
                } else {
                  router.push({ pathname: "/destination/[id]", params: { id: dest.id } });
                }
              }}
            >
              <View style={[styles.destIcon, { backgroundColor: colors.tagBg }]}>
                <Ionicons name="location" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.destName, { color: colors.text }]}>{dest.name}</Text>
                <Text
                  style={[styles.destAddress, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {dest.address}
                </Text>
                {dest.reviewCount > 0 && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                      {formatRating(dest.rating)} ({dest.reviewCount})
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.destCoords}>
                <Text style={[styles.destCoordText, { color: colors.textTertiary }]}>
                  {dest.latitude.toFixed(2)}, {dest.longitude.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 100,
    borderRadius: 14,
    overflow: "hidden",
  },
  mapOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapOverlayText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mapOverlayCoord: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  permissionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 40,
    marginHorizontal: 20,
  },
  permissionTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  permissionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  permissionButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  permissionButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  locationCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  locationHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  locationTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  coordsRow: { flexDirection: "row", gap: 12 },
  coordBox: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  coordLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  coordValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  destIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  destName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  destAddress: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  ratingText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  destCoords: {},
  destCoordText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
