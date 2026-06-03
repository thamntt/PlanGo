/**
 * Centralized react-query keys. Use these constants instead of inline string arrays
 * so cache invalidation stays consistent across the app.
 *
 * Convention: hierarchical arrays — invalidating `["trips"]` invalidates
 * `["trips", "list"]` and `["trips", "detail", id]` together.
 */
export const queryKeys = {
  // ── Auth / user ──
  currentUser: () => ["users", "me"] as const,

  // ── Trips ──
  trips: () => ["trips"] as const,
  tripList: (filters?: { ownerId?: number; memberId?: number }) =>
    ["trips", "list", filters ?? {}] as const,
  tripDetail: (id: string | number) => ["trips", "detail", String(id)] as const,
  tripDays: (tripId: string | number) => ["trips", "detail", String(tripId), "days"] as const,
  tripExpenses: (tripId: string | number) => ["trips", "detail", String(tripId), "expenses"] as const,

  // ── Destinations ──
  destinations: () => ["destinations"] as const,
  destinationList: (typeId?: number) => ["destinations", "list", typeId ?? "all"] as const,
  destinationDetail: (id: string | number) => ["destinations", "detail", String(id)] as const,
  destinationTypes: () => ["destination-types"] as const,

  // ── POIs ──
  pois: () => ["pois"] as const,
  poiList: (destinationId?: number) => ["pois", "list", destinationId ?? "all"] as const,
  poiDetail: (id: string | number) => ["pois", "detail", String(id)] as const,
  poiTypes: () => ["poi-types"] as const,

  // ── Reviews ──
  reviews: () => ["reviews"] as const,
  reviewList: (filters?: { tripId?: number; itemId?: number; destinationId?: number }) =>
    ["reviews", "list", filters ?? {}] as const,

  // ── Notifications ──
  notifications: () => ["notifications"] as const,
  notificationList: (userId?: number) => ["notifications", "list", userId ?? "all"] as const,

  // ── Lookups ──
  expenseTypes: () => ["expense-types"] as const,
  preferences: () => ["preferences"] as const,

  // ── Admin ──
  adminStats: () => ["admin", "stats"] as const,
} as const;
