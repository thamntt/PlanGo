import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  CURRENT_USER: "@plango_current_user",
  USERS: "@plango_users",
  DESTINATIONS: "@plango_destinations",
  ITINERARIES: "@plango_itineraries",
  REVIEWS: "@plango_reviews",
  NOTIFICATIONS: "@plango_notifications",
  POIS: "@plango_pois",
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
  priceRange?: string;
  tags: string[];
  openHours?: string;
  isActive: boolean;
  highlights?: string[];
  tips?: string[];
  bestTimeToVisit?: string;
  estimatedCostPerPerson?: number;
  sampleReviews?: { author: string; rating: number; comment: string; source: string }[];
  nearbyFood?: { name: string; address: string; latitude: number; longitude: number; costPerPerson: number; cuisine: string }[];
  // Google Places fields
  googlePlaceId?: string;
  googlePhotos?: { name: string; attributions: string[] }[];
  googleReviews?: { author: string; rating: number; text: string; time: string }[];
}

export interface POI {
  id: string;
  destinationId: string;
  name: string;
  type: "attraction" | "restaurant" | "cafe" | "hotel" | "shopping" | "other";
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  openHours?: string;
  openingHours?: string[];
  priceLevel?: number;
  estimatedCost?: number;
  estimatedDuration?: string;
  description?: string;
  images: string[];
  googlePlaceId?: string;
  googlePhotos?: { name: string; attributions: string[] }[];
  googleReviews?: { author: string; rating: number; text: string; time: string }[];
  tags?: string[];
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
  estimatedCost: number;
  actualCost?: number;
  paidBy?: string;
  note?: string;
  notes?: string[];
  isCompleted: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  activityType: "sightseeing" | "food" | "transport" | "shopping" | "other";
  poiId?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUrl?: string;
  googlePlaceId?: string;
  openHours?: string;
  openingHours?: string[];
  thumbnail?: string;
  placeType?: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  amount: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  type: "transport" | "shopping" | "food" | "sightseeing" | "other";
  paidBy?: string;
  paidByUserId?: string;
  splitType?: "none" | "equal" | "custom";
  splits?: ExpenseSplit[];
  notes?: string[];
  dayIndex?: number;
  activityId?: string;
  createdAt: string;
}

export interface TripCompanion {
  userId: string;
  userName: string;
  role: "editor" | "viewer";
  joinedAt: string;
}

export interface Itinerary {
  id: string;
  userId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: string;
  totalBudget: number;
  spentAmount: number;
  startingPoint: string;
  numPeople: number;
  preferences: string[];
  days: ItineraryDay[];
  expenses?: Expense[];
  companions?: TripCompanion[];
  shareCode?: string;
  sharePermission?: "editor" | "viewer";
  status: "draft" | "active" | "completed";
  resetCount?: number;
  isShared: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  destinationId: string;
  poiId?: string;
  poiName?: string;
  activityId?: string;
  activityTitle?: string;
  itineraryId?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  itineraryId?: string;
  createdAt: string;
  isRead: boolean;
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

export async function getNotifications(): Promise<Notification[]> {
  return getJSON<Notification[]>(KEYS.NOTIFICATIONS, []);
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  await setJSON(KEYS.NOTIFICATIONS, notifications);
}

export async function getPOIs(): Promise<POI[]> {
  return getJSON<POI[]>(KEYS.POIS, []);
}

export async function savePOIs(pois: POI[]): Promise<void> {
  await setJSON(KEYS.POIS, pois);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

export function formatVND(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " ₫";
}

export function parseVND(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}
