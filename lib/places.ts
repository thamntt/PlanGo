import { getApiUrl, getApiHeaders } from "./query-client";

const SERVER_URL = getApiUrl().replace(/\/$/, ""); // Remove trailing slash

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  types: string[];
  primaryType: string;
  primaryTypeDisplay: string;
  editorialSummary: string;
  photos: { name: string; attributions: string[] }[];
}

export interface PlaceDetails extends PlaceSearchResult {
  website: string;
  phone: string;
  priceLevel: number | null;
  reviews: PlaceReview[];
  openingHours: string[];
  openNow: boolean | null;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  time: string;
  profilePhoto: string;
}

// Map OSM/place types to our POI type categories
const TYPE_MAP: Record<string, string> = {
  tourist_attraction: "attraction",
  tourism: "attraction",
  attraction: "attraction",
  museum: "attraction",
  park: "attraction",
  amusement_park: "attraction",
  aquarium: "attraction",
  zoo: "attraction",
  art_gallery: "attraction",
  church: "attraction",
  hindu_temple: "attraction",
  mosque: "attraction",
  synagogue: "attraction",
  stadium: "attraction",
  monument: "attraction",
  national_park: "attraction",
  viewpoint: "attraction",
  
  restaurant: "restaurant",
  food: "restaurant",
  fast_food: "restaurant",
  meal_delivery: "restaurant",
  meal_takeaway: "restaurant",
  bakery: "restaurant",
  
  cafe: "cafe",
  coffee_shop: "cafe",
  coffee: "cafe",
  
  lodging: "hotel",
  hotel: "hotel",
  hostel: "hotel",
  guest_house: "hotel",
  
  shopping_mall: "shopping",
  clothing_store: "shopping",
  department_store: "shopping",
  jewelry_store: "shopping",
  shoe_store: "shopping",
  supermarket: "shopping",
  convenience_store: "shopping",
  store: "shopping",
  market: "shopping",
  marketplace: "shopping",
  mall: "shopping",
  shop: "shopping",
};

export function mapGoogleTypeToPOIType(types: string[], primaryType?: string): "attraction" | "restaurant" | "cafe" | "hotel" | "shopping" | "other" {
  // Check primary type first
  if (primaryType && TYPE_MAP[primaryType]) {
    return TYPE_MAP[primaryType] as any;
  }
  // Then check all types
  for (const type of types) {
    if (TYPE_MAP[type]) {
      return TYPE_MAP[type] as any;
    }
  }
  return "other";
}

export function getPOITypeLabel(type: string): string {
  const labels: Record<string, string> = {
    attraction: "Tham quan",
    restaurant: "Ăn uống",
    cafe: "Cà phê",
    hotel: "Lưu trú",
    shopping: "Mua sắm",
    other: "Khác",
  };
  return labels[type] || "Khác";
}

export function getPOITypeIcon(type: string): string {
  const icons: Record<string, string> = {
    attraction: "camera-outline",
    restaurant: "restaurant-outline",
    cafe: "cafe-outline",
    hotel: "bed-outline",
    shopping: "bag-outline",
    other: "ellipse-outline",
  };
  return icons[type] || "ellipse-outline";
}

export async function searchPlaces(query: string, language: string = "vi"): Promise<PlaceSearchResult[]> {
  try {
    const url = `${SERVER_URL}/api/places/search?query=${encodeURIComponent(query)}&language=${language}`;
    const response = await fetch(url, { headers: getApiHeaders() });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Search places error:", error);
      return [];
    }
    
    const data = await response.json();
    return data.places || [];
  } catch (error) {
    console.error("Search places error:", error);
    return [];
  }
}

export async function getPlaceDetails(placeId: string, language: string = "vi"): Promise<PlaceDetails | null> {
  try {
    const url = `${SERVER_URL}/api/places/details/${placeId}?language=${language}`;
    const response = await fetch(url, { headers: getApiHeaders() });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Place details error:", error);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Place details error:", error);
    return null;
  }
}

export function getPhotoUrl(photoName: string, maxWidth: number = 800): string {
  return `${SERVER_URL}/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
}

// Goong geocode — address to coordinates
export interface GeocodeResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult[]> {
  try {
    const url = `${SERVER_URL}/api/places/geocode?address=${encodeURIComponent(address)}`;
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Geocode error:", error);
    return [];
  }
}

// Goong directions — route between points
export interface DirectionRoute {
  legs: {
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    steps: any[];
  }[];
  overview_polyline: { points: string };
}

export async function getDirections(
  origin: string,
  destination: string,
  vehicle: string = "car"
): Promise<DirectionRoute | null> {
  try {
    const url = `${SERVER_URL}/api/places/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&vehicle=${vehicle}`;
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0];
    }
    return null;
  } catch (error) {
    console.error("Directions error:", error);
    return null;
  }
}
