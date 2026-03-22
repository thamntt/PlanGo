import React from "react";
import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

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
      (function() {
        var marker = L.marker([${p.lat}, ${p.lng}], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer">${label}</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(map).bindPopup('<b>${label}. ${p.name.replace(/'/g, "\\'")}</b>');
        marker.on('click', function() {
          var msg = JSON.stringify({ type: 'markerPress', point: { lat: ${p.lat}, lng: ${p.lng}, name: '${p.name.replace(/'/g, "\\\'")}', type: '${p.type || "other"}', index: ${i} } });
          window.parent.postMessage(msg, '*');
          if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
        });
      })();
    `;
    })
    .join("\n");

  // Build OSRM routing JS — fetches real road directions between all points
  const routeJs = showRoute && points.length > 1
    ? `
      // Build OSRM waypoints string: lng,lat;lng,lat;...
      var waypoints = [${points.map((p) => `[${p.lng}, ${p.lat}]`).join(",")}];
      var waypointStr = waypoints.map(function(w) { return w[0] + ',' + w[1]; }).join(';');
      var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + waypointStr + '?overview=full&geometries=geojson&steps=true';

      fetch(osrmUrl)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            var route = data.routes[0];
            var coords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });

            // Draw the actual road route
            L.polyline(coords, {
              color: '#4F46E5',
              weight: 4,
              opacity: 0.85,
              smoothFactor: 1
            }).addTo(map);

            // Add distance/duration info between consecutive points
            var legs = route.legs;
            for (var i = 0; i < legs.length; i++) {
              var leg = legs[i];
              var distKm = (leg.distance / 1000).toFixed(1);
              var durMin = Math.round(leg.duration / 60);
              var midIdx = Math.floor(leg.steps.length / 2);
              var midStep = leg.steps[midIdx];
              var midCoord = midStep ? midStep.maneuver.location : null;

              if (midCoord) {
                var label = distKm + ' km • ' + durMin + ' phút';
                L.marker([midCoord[1], midCoord[0]], {
                  icon: L.divIcon({
                    className: 'route-info',
                    html: '<div style="background:rgba(79,70,229,0.9);color:#fff;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">' + label + '</div>',
                    iconSize: [80, 20],
                    iconAnchor: [40, 10]
                  })
                }).addTo(map);
              }
            }
          } else {
            // Fallback: draw straight dashed lines if OSRM fails
            var fallbackCoords = [${points.map((p) => `[${p.lat},${p.lng}]`).join(",")}];
            L.polyline(fallbackCoords, {
              color: '#4F46E5',
              weight: 3,
              opacity: 0.7,
              dashArray: '8, 8'
            }).addTo(map);
          }
        })
        .catch(function() {
          // Fallback on error
          var fallbackCoords = [${points.map((p) => `[${p.lat},${p.lng}]`).join(",")}];
          L.polyline(fallbackCoords, {
            color: '#4F46E5',
            weight: 3,
            opacity: 0.7,
            dashArray: '8, 8'
          }).addTo(map);
        });
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
    .route-info { background: none !important; border: none !important; }
    .leaflet-popup-content-wrapper { border-radius: 10px; }
    .leaflet-popup-content { margin: 10px 14px; font-family: -apple-system, sans-serif; font-size: 13px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${centerLat}, ${centerLng}], ${zoom});
    // Tile layer with fallback: Goong → OpenStreetMap
    var goongKey = '';
    try { goongKey = '${process.env.GOONG_MAPTILES_KEY || process.env.GOONG_API_KEY || ""}'; } catch(e) {}

    if (goongKey) {
      // Cách 1: Goong Map Tiles (tốt cho Việt Nam)
      var goongLayer = L.tileLayer('https://tiles.goong.io/assets/goong_map_web/{z}/{x}/{y}.png?api_key=' + goongKey, {
        maxZoom: 19,
        attribution: '© Goong'
      });
      goongLayer.on('tileerror', function() {
        // Cách 2: Fallback sang OpenStreetMap nếu Goong lỗi
        map.removeLayer(goongLayer);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
      });
      goongLayer.addTo(map);
    } else {
      // Cách 2: OpenStreetMap tiles (miễn phí, luôn khả dụng)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);
    }
    ${markersJs}
    ${routeJs}
    ${userMarkerJs}
    ${points.length > 1 ? `map.fitBounds([${points.map((p) => `[${p.lat},${p.lng}]`).join(",")}], { padding: [50, 50] });` : ""}
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
  onMarkerPress,
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

  const html = generateLeafletHtml(points, showRoute, userLocation);

  // Handle postMessage from iframe / WebView marker clicks
  const handleMessage = React.useCallback(
    (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "markerPress" && parsed.point && onMarkerPress) {
          onMarkerPress(parsed.point);
        }
      } catch {}
    },
    [onMarkerPress]
  );

  // Web: listen to iframe postMessage
  React.useEffect(() => {
    if (Platform.OS !== "web" || !onMarkerPress) return;
    const listener = (e: MessageEvent) => {
      if (typeof e.data === "string") handleMessage(e.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [handleMessage, onMarkerPress]);

  if (Platform.OS === "web") {
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

  // Native: render actual map using WebView with Leaflet + OSRM routing
  return (
    <View style={[mapStyles.container, { height, borderRadius: 14, overflow: "hidden" }]}>
      <WebView
        source={{ html }}
        style={{ flex: 1, borderRadius: 14 }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={["*"]}
        mixedContentMode="always"
        onMessage={(event) => handleMessage(event.nativeEvent.data)}
      />
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
});
