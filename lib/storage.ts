import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  CURRENT_USER: "@plango_current_user",
  USERS: "@plango_users",
  DESTINATIONS: "@plango_destinations",
  ITINERARIES: "@plango_itineraries",
  REVIEWS: "@plango_reviews",
};

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

async function setJSON(key: string, data: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export interface UserData {
  id: string;
  username: string;
  password: string;
  email: string;
  fullName: string;
  phone: string;
  avatar: string;
  role: "user" | "admin";
  isLocked: boolean;
  preferences: string[];
  createdAt: string;
}

export interface Destination {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  priceRange: string;
  tags: string[];
  openHours: string;
  isActive: boolean;
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: ItineraryActivity[];
}

export interface ItineraryActivity {
  id: string;
  time: string;
  title: string;
  description: string;
  destinationId?: string;
  duration: string;
}

export interface Itinerary {
  id: string;
  userId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: string;
  numPeople: number;
  preferences: string[];
  days: ItineraryDay[];
  status: "draft" | "active" | "completed";
  isShared: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  destinationId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export async function getUsers(): Promise<UserData[]> {
  return getJSON<UserData[]>(KEYS.USERS, []);
}

export async function saveUsers(users: UserData[]): Promise<void> {
  await setJSON(KEYS.USERS, users);
}

export async function getCurrentUser(): Promise<UserData | null> {
  return getJSON<UserData | null>(KEYS.CURRENT_USER, null);
}

export async function setCurrentUser(user: UserData | null): Promise<void> {
  await setJSON(KEYS.CURRENT_USER, user);
}

export async function getDestinations(): Promise<Destination[]> {
  return getJSON<Destination[]>(KEYS.DESTINATIONS, []);
}

export async function saveDestinations(destinations: Destination[]): Promise<void> {
  await setJSON(KEYS.DESTINATIONS, destinations);
}

export async function getItineraries(): Promise<Itinerary[]> {
  return getJSON<Itinerary[]>(KEYS.ITINERARIES, []);
}

export async function saveItineraries(itineraries: Itinerary[]): Promise<void> {
  await setJSON(KEYS.ITINERARIES, itineraries);
}

export async function getReviews(): Promise<Review[]> {
  return getJSON<Review[]>(KEYS.REVIEWS, []);
}

export async function saveReviews(reviews: Review[]): Promise<void> {
  await setJSON(KEYS.REVIEWS, reviews);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
