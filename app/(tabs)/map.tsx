import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
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
import { useData } from "@/contexts/DataContext";
import { useThemeColors } from "@/constants/colors";
import type { Destination } from "@/lib/storage";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useThemeColors(isDark);
  const { destinations } = useData();

  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

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

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Location</Text>
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
          <Ionicons name="refresh" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!permission?.granted ? (
          <View style={[styles.permissionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="location-outline" size={48} color={colors.primary} />
            <Text style={[styles.permissionTitle, { color: colors.text }]}>Location Access</Text>
            <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
              Allow location access to track your position and find nearby destinations
            </Text>
            <Pressable
              onPress={() => requestPermission()}
              style={({ pressed }) => [
                styles.permissionButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={styles.permissionButtonText}>Enable Location</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.locationHeader}>
                <Ionicons name="navigate" size={24} color={colors.primary} />
                <Text style={[styles.locationTitle, { color: colors.text }]}>Your Location</Text>
              </View>
              {loadingLocation ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
              ) : location ? (
                <View style={styles.coordsRow}>
                  <View style={[styles.coordBox, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.coordLabel, { color: colors.textSecondary }]}>Latitude</Text>
                    <Text style={[styles.coordValue, { color: colors.text }]}>
                      {location.coords.latitude.toFixed(4)}
                    </Text>
                  </View>
                  <View style={[styles.coordBox, { backgroundColor: colors.inputBg }]}>
                    <Text style={[styles.coordLabel, { color: colors.textSecondary }]}>Longitude</Text>
                    <Text style={[styles.coordValue, { color: colors.text }]}>
                      {location.coords.longitude.toFixed(4)}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.noLocation, { color: colors.textSecondary }]}>
                  Tap refresh to get your location
                </Text>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Destinations</Text>
            {destinations.filter((d) => d.isActive).map((dest) => (
              <Pressable
                key={dest.id}
                style={({ pressed }) => [
                  styles.destRow,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: pressed ? 0.95 : 1 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/destination/[id]", params: { id: dest.id } });
                }}
              >
                <View style={[styles.destIcon, { backgroundColor: colors.tagBg }]}>
                  <Ionicons name="location" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.destName, { color: colors.text }]}>{dest.name}</Text>
                  <Text style={[styles.destAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                    {dest.address}
                  </Text>
                </View>
                <View style={styles.destCoords}>
                  <Text style={[styles.destCoordText, { color: colors.textTertiary }]}>
                    {dest.latitude.toFixed(2)}, {dest.longitude.toFixed(2)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
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
  refreshButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  permissionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 40,
  },
  permissionTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  permissionText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  permissionButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  permissionButtonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  locationCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  locationHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  locationTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  coordsRow: { flexDirection: "row", gap: 12 },
  coordBox: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  coordLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  coordValue: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  noLocation: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  destIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  destName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  destAddress: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  destCoords: {},
  destCoordText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
