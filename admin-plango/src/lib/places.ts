import { apiRequest } from "./api";

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

export function mapGoogleTypeToPOIType(
  types: string[],
  primaryType?: string,
): "attraction" | "restaurant" | "cafe" | "hotel" | "shopping" | "other" {
  if (primaryType && TYPE_MAP[primaryType]) {
    return TYPE_MAP[primaryType] as any;
  }
  for (const type of types) {
    if (TYPE_MAP[type]) {
      return TYPE_MAP[type] as any;
    }
  }
  return "other";
}

export async function searchPlaces(
  query: string,
  language: string = "vi",
): Promise<PlaceSearchResult[]> {
  try {
    const url = `/api/places/search?query=${encodeURIComponent(query)}&language=${language}`;
    const data = await apiRequest("GET", url);
    return data.places || [];
  } catch (error) {
    console.error("Search places error:", error);
    return [];
  }
}

export async function getPlaceDetails(
  placeId: string,
  language: string = "vi",
): Promise<PlaceDetails | null> {
  try {
    const url = `/api/places/details/${placeId}?language=${language}`;
    const data = await apiRequest("GET", url);
    return data;
  } catch (error) {
    console.error("Place details error:", error);
    return null;
  }
}

export function getPhotoUrl(photoName: string, maxWidth: number = 800): string {
  // Use relative URL to be handled by Vite proxy
  return `/api/places/photo?name=${encodeURIComponent(photoName)}&maxWidth=${maxWidth}`;
}
