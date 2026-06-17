/**
 * Domain types for PlanGo mobile app. These are the FE-side shape definitions
 * — the server returns API responses that get mapped (via `src/lib/mappers`)
 * into these types. Do NOT import server-side types here.
 */

export interface DestinationType {
  id: string;
  typeName: string;
  description?: string;
}

export interface PoiType {
  id: string;
  typeName: string;
  description?: string;
}

export interface ExpenseType {
  id: string;
  name: string;
  description?: string;
}

export interface Preference {
  id: string;
  preferenceName: string;
  description?: string;
}

export interface UserData {
  id: string;
  username: string;
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
  nearbyFood?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    costPerPerson: number;
    cuisine: string;
  }[];
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
  activityType: string;
  expenseTypeId?: string | number;
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
  expenseTypeId?: string | number;
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
  ownerName?: string;
  /** Was this trip created via AI generation? Drives edit-form default mode. */
  generatedByAi?: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  destinationId: string;
  poiId?: string;
  poiName?: string;
  activityId?: string;
  activityTitle?: string;
  itineraryId?: string;
  rating: number;
  comment: string;
  createdAt: string;
  // Trip visit context (TripAdvisor pattern — each review is one visit)
  tripTitle?: string;
  tripStartDate?: string;
  tripEndDate?: string;
  tripNumPeople?: number;
  // Phase 1.5 engagement
  photos?: string[];
  userReviewerLevel?: "newcomer" | "active" | "top" | "legend" | null;
  userReviewCount?: number;
  helpfulCount?: number;
  viewerVotedHelpful?: boolean;
}

export interface TripInvitation {
  id: string;
  tripId: string;
  inviterUserId: string;
  inviteeUserId: string;
  role: "viewer" | "editor";
  status: "pending" | "accepted" | "declined" | "cancelled";
  message?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  // Joined / hydrated fields
  tripTitle?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  tripStatus?: string | null;
  tripInvitationToken?: string | null;
  inviterName?: string | null;
  inviterUserName?: string | null;
  inviterAvatarUrl?: string | null;
  inviteeName?: string | null;
  inviteeUserName?: string | null;
  inviteeAvatarUrl?: string | null;
}

export interface TripTask {
  id: string;
  tripId: string;
  title: string;
  description?: string | null;
  category?: "prep" | "during" | "after" | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  assigneeAvatarUrl?: string | null;
  dueDate?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
  completedByUserId?: string | null;
  createdByUserId?: string | null;
  orderIndex: number;
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
