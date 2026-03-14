import React from "react";
import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface MapPoint {
  lat: number;
  lng: number;
  name: string;
  type?: string;
  index?: number;
}

interface RouteMapProps {
  points: MapPoint[];
  height?: number;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    cardBorder: string;
    inputBg: string;
  };
  showRoute?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onMarkerPress?: (point: MapPoint) => void;
}

function generateLeafletHtml(
  points: MapPoint[],
  showRoute: boolean,
  userLocation?: { lat: number; lng: number } | null
): string {
  if (points.length === 0) return "";

  const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const centerLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  // Calculate zoom based on spread
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const maxSpread = Math.max(latSpread, lngSpread);
  let zoom = 13;
  if (maxSpread > 5) zoom = 7;
  else if (maxSpread > 2) zoom = 8;
  else if (maxSpread > 1) zoom = 9;
  else if (maxSpread > 0.5) zoom = 10;
  else if (maxSpread > 0.2) zoom = 11;
  else if (maxSpread > 0.1) zoom = 12;

  const typeColors: Record<string, string> = {
    sightseeing: "#4F46E5",
    food: "#F59E0B",
    transport: "#10B981",
    shopping: "#EC4899",
    attraction: "#4F46E5",
    restaurant: "#F59E0B",
    cafe: "#8B5CF6",
    hotel: "#0EA5E9",
    other: "#6B7280",
  };

  const markersJs = points
    .map((p, i) => {
      const color = typeColors[p.type || "other"] || "#4F46E5";
      const label = p.index !== undefined ? p.index + 1 : i + 1;
      return `
      L.marker([${p.lat}, ${p.lng}], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(map).bindPopup('<b>${p.name.replace(/'/g, "\\'")}</b>');
    `;
    })
    .join("\n");

  const routeJs = showRoute && points.length > 1
    ? `
      var routeLine = L.polyline([${points.map((p) => `[${p.lat},${p.lng}]`).join(",")}], {
        color: '#4F46E5',
        weight: 3,
        opacity: 0.7,
        dashArray: '8, 8'
      }).addTo(map);
    `
    : "";

  const userMarkerJs = userLocation
    ? `
      L.marker([${userLocation.lat}, ${userLocation.lng}], {
        icon: L.divIcon({
          className: 'user-marker',
          html: '<div style="background:#3B82F6;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px rgba(59,130,246,0.5)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(map).bindPopup('<b>Vị trí của bạn</b>');
    `
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 100%; height: 100vh; }
    #map { width: 100%; height: 100%; }
    .custom-marker { background: none !important; border: none !important; }
    .user-marker { background: none !important; border: none !important; }
    .leaflet-popup-content-wrapper { border-radius: 10px; }
    .leaflet-popup-content { margin: 10px 14px; font-family: -apple-system, sans-serif; font-size: 13px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${centerLat}, ${centerLng}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);
    ${markersJs}
    ${routeJs}
    ${userMarkerJs}
    ${points.length > 1 ? `map.fitBounds([${points.map((p) => `[${p.lat},${p.lng}]`).join(",")}], { padding: [40, 40] });` : ""}
  </script>
</body>
</html>`;
}

export default function RouteMap({
  points,
  height = 300,
  colors,
  showRoute = true,
  userLocation,
}: RouteMapProps) {
  if (points.length === 0) {
    return (
      <View style={[mapStyles.empty, { backgroundColor: colors.inputBg, height }]}>
        <Ionicons name="map-outline" size={32} color={colors.textSecondary} />
        <Text style={[mapStyles.emptyText, { color: colors.textSecondary }]}>
          Không có địa điểm nào để hiển thị
        </Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    const html = generateLeafletHtml(points, showRoute, userLocation);
    return (
      <View style={[mapStyles.container, { height, borderRadius: 14, overflow: "hidden" }]}>
        <iframe
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 14 }}
          title="Route Map"
        />
      </View>
    );
  }

  // Native: show a simple visual list with link to open in Google Maps
  return (
    <View style={[mapStyles.nativeContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={mapStyles.nativeHeader}>
        <Ionicons name="map" size={20} color={colors.primary} />
        <Text style={[mapStyles.nativeTitle, { color: colors.text }]}>
          Bản đồ tuyến đường ({points.length} điểm)
        </Text>
      </View>
      {points.slice(0, 10).map((p, i) => (
        <View key={i} style={mapStyles.nativePoint}>
          <View style={[mapStyles.nativeMarker, { backgroundColor: colors.primary }]}>
            <Text style={mapStyles.nativeMarkerText}>{i + 1}</Text>
          </View>
          <Text style={[mapStyles.nativePointName, { color: colors.text }]} numberOfLines={1}>
            {p.name}
          </Text>
          {i < points.length - 1 && (
            <View style={mapStyles.nativeLine}>
              <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: { width: "100%", overflow: "hidden" },
  empty: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  nativeContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  nativeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  nativeTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nativePoint: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  nativeMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeMarkerText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  nativePointName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  nativeLine: { position: "absolute", left: 6, bottom: -8 },
});
