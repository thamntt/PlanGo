import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  serial,
  real,
  boolean,
  timestamp,
  jsonb,
  time,
  date,
  decimal,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==============================================================================
// BẢNG ĐỘC LẬP (Không chứa Foreign Key)
// ==============================================================================

export const users = pgTable("users", {
  userId: serial("user_id").primaryKey(),
  userName: varchar("user_name", { length: 255 }).notNull(),
  // Display name with diacritics + spaces (e.g. "Thắm Nguyễn"). Defaults to userName.
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // Password is bcrypt-hashed. NULL allowed for social-login-only accounts.
  password: varchar("password", { length: 255 }),
  role: varchar("role", { length: 50 }),
  status: varchar("status", { length: 50 }),
  // OAuth provider linkage. NULL = email/password account.
  provider: varchar("provider", { length: 50 }), // "google" | "facebook" | "apple" | NULL
  providerUserId: varchar("provider_user_id", { length: 255 }), // sub from provider
  // TEXT (unbounded) so we can store base64 data URIs for MVP. Phase 2: move
  // to file upload + CDN URL (~80 chars), can revert to varchar then.
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").default(false),
  // Password reset token (single-use, expires in 1h)
  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  // Phase 1.5 reviewer stats — derived materialized fields. Updated via cron
  // (helpful_received) or trigger (review_count). Used for badges + sorting.
  reviewCount: integer("review_count").default(0),
  helpfulReceived: integer("helpful_received").default(0),
  reviewerLevel: varchar("reviewer_level", { length: 20 }), // 'newcomer'|'active'|'top'|'legend'
  bio: text("bio"), // Short self-introduction shown on profile
  createdAt: timestamp("created_at").defaultNow(),
});

export const destinationType = pgTable("destination_type", {
  destinationtypeId: serial("destinationtype_id").primaryKey(),
  typeName: varchar("type_name", { length: 255 }).notNull(),
  description: text("description"),
});

export const poiType = pgTable("poi_type", {
  poitypeId: serial("poitype_id").primaryKey(),
  typeName: varchar("type_name", { length: 255 }).notNull(),
  description: text("description"),
});

export const preferences = pgTable("preferences", {
  preferenceId: serial("preference_id").primaryKey(),
  preferenceName: varchar("preference_name", { length: 255 }).notNull(),
});

export const expenseType = pgTable("expensetype", {
  expenseTypeId: serial("expense_type_id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
});

// ==============================================================================
// BẢNG CẤP 1 (Chứa Foreign Key tham chiếu đến bảng độc lập)
// ==============================================================================

export const destinations = pgTable("destinations", {
  destinationId: serial("destination_id").primaryKey(),
  destinationTypeId: integer("destinationtype_id").references(
    () => destinationType.destinationtypeId,
  ),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  googlePlaceId: varchar("google_place_id", { length: 255 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  images: jsonb("images"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  reviewCounts: integer("review_counts").default(0),
  active: boolean("active").default(true),
});

// ==============================================================================
// BẢNG CẤP 2
// ==============================================================================

export const pois = pgTable("pois", {
  poiId: serial("poi_id").primaryKey(),
  poitypeId: integer("poitype_id").references(() => poiType.poitypeId),
  destinationId: integer("destination_id").references(() => destinations.destinationId),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  address: text("address"),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  reviewCounts: integer("review_counts").default(0),
  googlePlaceId: varchar("google_place_id", { length: 255 }),
  description: text("description"),
  // SerpAPI Google Maps reviews cache. TTL ~180 days, lazy refresh on view.
  // Saves 1 paid SerpAPI call per repeat open + cross-user share.
  serpReviewsJson: jsonb("serp_reviews_json"),
  serpPlaceInfoJson: jsonb("serp_place_info_json"),
  serpFetchedAt: timestamp("serp_fetched_at"),
  serpViewCount: integer("serp_view_count").default(0).notNull(),
});

export const trips = pgTable("trips", {
  tripId: serial("trip_id").primaryKey(),
  destinationId: integer("destination_id").references(() => destinations.destinationId),
  ownerId: integer("owner_id").references(() => users.userId),
  title: varchar("title", { length: 255 }).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  numPeople: integer("num_people"),
  status: varchar("status", { length: 50 }),
  // Was this trip generated by AI? Drives whether the Edit form opens in AI
  // mode (re-generate) or manual mode (free-form editor).
  generatedByAi: boolean("generated_by_ai").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  invitationToken: varchar("invitation_token", { length: 255 }),
  sharePermission: varchar("share_permission", { length: 50 }),
});

// ==============================================================================
// BẢNG CẤP 3
// ==============================================================================

export const poiOpeningHours = pgTable(
  "poi_opening_hours",
  {
    poiId: integer("poi_id")
      .notNull()
      .references(() => pois.poiId, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    openTime: time("open_time"),
    closeTime: time("close_time"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.poiId, table.dayOfWeek] }),
  }),
);

export const poiPreferences = pgTable(
  "poi_preferences",
  {
    poiId: integer("poi_id")
      .notNull()
      .references(() => pois.poiId, { onDelete: "cascade" }),
    preferenceId: integer("preference_id")
      .notNull()
      .references(() => preferences.preferenceId, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.poiId, table.preferenceId] }),
  }),
);

export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.tripId, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tripId, table.userId] }),
  }),
);

export const tripPreferences = pgTable(
  "trip_preferences",
  {
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.tripId, { onDelete: "cascade" }),
    preferenceId: integer("preference_id")
      .notNull()
      .references(() => preferences.preferenceId, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tripId, table.preferenceId] }),
  }),
);

export const itineraryDay = pgTable("itineraryday", {
  dayId: serial("day_id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "cascade" }),
  date: date("date"),
  dayIndex: integer("day_index"),
  // Human-readable header for each day (e.g. "Khám phá Đà Nẵng cổ kính").
  // Falls back to "Ngày N" on the FE if empty.
  title: varchar("title", { length: 255 }),
});

export const tripReviews = pgTable(
  "trip_reviews",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.tripId, { onDelete: "cascade" }),
    rating: decimal("rating", { precision: 3, scale: 2 }),
    comment: text("comment"),
    // Phase 1.5: array of photo URLs / base64 data URIs (max 10/review enforced at app layer)
    photos: jsonb("photos"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.tripId] }),
  }),
);

// ──────────────────────────────────────────────────────────────
// Review engagement tables (Phase 1.5 community features)
// ──────────────────────────────────────────────────────────────

/** Per-user upvote / downvote on someone else's review (helpful or not). */
export const reviewVotes = pgTable(
  "review_votes",
  {
    reviewUserId: integer("review_user_id").notNull(),
    reviewTripId: integer("review_trip_id").notNull(),
    voterUserId: integer("voter_user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    voteType: varchar("vote_type", { length: 20 }).notNull(), // 'helpful' | 'not_helpful'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reviewUserId, table.reviewTripId, table.voterUserId] }),
  }),
);

/** Threaded reply / discussion under a review. */
export const reviewReplies = pgTable("review_replies", {
  replyId: serial("reply_id").primaryKey(),
  parentReviewUserId: integer("parent_review_user_id").notNull(),
  parentReviewTripId: integer("parent_review_trip_id").notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Generic content moderation report (review / reply / blog / Q&A). */
export const contentReports = pgTable("content_reports", {
  reportId: serial("report_id").primaryKey(),
  contentType: varchar("content_type", { length: 50 }).notNull(), // 'review'|'reply'|'blog'|'qa'
  contentRefId: varchar("content_ref_id", { length: 100 }).notNull(), // freeform — composite key encoded as string
  reporterId: integer("reporter_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  details: text("details"),
  status: varchar("status", { length: 30 }).default("pending"), // pending/reviewed/resolved/dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

/** Per-category ratings on a review (Airbnb-style breakdown).
 *  Categories: 'experience'/'value'/'cleanliness'/'safety'/'service' */
export const reviewCategories = pgTable(
  "review_categories",
  {
    reviewUserId: integer("review_user_id").notNull(),
    reviewTripId: integer("review_trip_id").notNull(),
    categoryName: varchar("category_name", { length: 50 }).notNull(),
    rating: decimal("rating", { precision: 3, scale: 2 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reviewUserId, table.reviewTripId, table.categoryName] }),
  }),
);

// ══════════════════════════════════════════════════════════════════════════════
// COMMUNITY MODULES — Blog + Forum (Phase 2 production)
// ══════════════════════════════════════════════════════════════════════════════

/** Blog posts authored by users. Linked to destinations + optional trip recap. */
export const blogPosts = pgTable("blog_posts", {
  postId: serial("post_id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 280 }).notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  images: jsonb("images"), // array of image URLs / base64
  category: varchar("category", { length: 50 }), // 'guide' | 'review' | 'food' | 'tips' | 'experience'
  readMinutes: integer("read_minutes").default(5),
  status: varchar("status", { length: 20 }).default("published"), // 'draft' | 'published' | 'hidden'
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  bookmarkCount: integer("bookmark_count").default(0),
  referencedTripId: integer("referenced_trip_id").references(() => trips.tripId, {
    onDelete: "set null",
  }),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Tags for blog posts (shared with forum threads). */
export const communityTags = pgTable("community_tags", {
  tagId: serial("tag_id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  color: varchar("color", { length: 20 }), // hex
  description: text("description"),
  usageCount: integer("usage_count").default(0),
});

/** Many-to-many: blog posts ↔ tags */
export const blogPostTags = pgTable(
  "blog_post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.postId, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => communityTags.tagId, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
  }),
);

/** Many-to-many: blog posts ↔ destinations (a guide can cover multiple cities) */
export const blogPostDestinations = pgTable(
  "blog_post_destinations",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.postId, { onDelete: "cascade" }),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinations.destinationId, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.destinationId] }),
  }),
);

/** User likes on blog posts (toggle). */
export const blogLikes = pgTable(
  "blog_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.postId, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
  }),
);

/** Bookmarks / saved posts for later reading. */
export const blogBookmarks = pgTable(
  "blog_bookmarks",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => blogPosts.postId, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
  }),
);

/** Comments on blog posts (nested via parent_id, 1 level deep usually). */
export const blogComments = pgTable("blog_comments", {
  commentId: serial("comment_id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => blogPosts.postId, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  parentCommentId: integer("parent_comment_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0),
  // Author/admin can pin one comment to the top per post
  isPinned: boolean("is_pinned").default(false).notNull(),
  pinnedAt: timestamp("pinned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // Set when user edits — used to show "Đã chỉnh sửa" indicator
  updatedAt: timestamp("updated_at"),
});

/** User likes on individual blog comments (toggle, like FB reactions). */
export const blogCommentLikes = pgTable(
  "blog_comment_likes",
  {
    commentId: integer("comment_id")
      .notNull()
      .references(() => blogComments.commentId, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.commentId, table.userId] }),
  }),
);

// ─── Forum ────────────────────────────────────────────────────

/** Forum discussion threads — questions / discussions. */
export const forumThreads = pgTable("forum_threads", {
  threadId: serial("thread_id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  destinationId: integer("destination_id").references(() => destinations.destinationId, {
    onDelete: "set null",
  }),
  category: varchar("category", { length: 50 }), // 'question' | 'discussion' | 'tip' | 'recommendation'
  status: varchar("status", { length: 20 }).default("open"), // 'open' | 'solved' | 'closed' | 'locked'
  acceptedReplyId: integer("accepted_reply_id"),
  viewCount: integer("view_count").default(0),
  replyCount: integer("reply_count").default(0),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  isPinned: boolean("is_pinned").default(false),
  lastReplyAt: timestamp("last_reply_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

/** Forum thread tags (reuses community_tags). */
export const forumThreadTags = pgTable(
  "forum_thread_tags",
  {
    threadId: integer("thread_id")
      .notNull()
      .references(() => forumThreads.threadId, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => communityTags.tagId, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.threadId, table.tagId] }),
  }),
);

/** Replies on a forum thread (nested via parent_reply_id, 1 level). */
export const forumReplies = pgTable("forum_replies", {
  replyId: serial("reply_id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => forumThreads.threadId, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  parentReplyId: integer("parent_reply_id"),
  body: text("body").notNull(),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

/** Generic vote table for threads + replies. */
export const forumVotes = pgTable(
  "forum_votes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    targetType: varchar("target_type", { length: 20 }).notNull(), // 'thread' | 'reply'
    targetId: integer("target_id").notNull(),
    voteType: varchar("vote_type", { length: 10 }).notNull(), // 'up' | 'down'
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.targetType, table.targetId] }),
  }),
);

/** Optional poll attached to a forum thread (1-per-thread). */
export const forumPolls = pgTable("forum_polls", {
  pollId: serial("poll_id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .unique()
    .references(() => forumThreads.threadId, { onDelete: "cascade" }),
  question: varchar("question", { length: 280 }), // null → reuses thread.title
  closesAt: timestamp("closes_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Poll options — 2-6 per poll, ordered by position. */
export const forumPollOptions = pgTable("forum_poll_options", {
  optionId: serial("option_id").primaryKey(),
  pollId: integer("poll_id")
    .notNull()
    .references(() => forumPolls.pollId, { onDelete: "cascade" }),
  optionText: varchar("option_text", { length: 200 }).notNull(),
  position: integer("position").notNull().default(0),
  voteCount: integer("vote_count").notNull().default(0),
});

/** A user's vote on a poll — single-choice (PK enforces 1 vote per user per poll). */
export const forumPollVotes = pgTable(
  "forum_poll_votes",
  {
    pollId: integer("poll_id")
      .notNull()
      .references(() => forumPolls.pollId, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    optionId: integer("option_id")
      .notNull()
      .references(() => forumPollOptions.optionId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pollId, table.userId] }),
  }),
);

export const notifications = pgTable("notifications", {
  notificationId: serial("notification_id").primaryKey(),
  userId: integer("user_id").references(() => users.userId, { onDelete: "cascade" }),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "set null" }), // NULLable
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  type: varchar("type", { length: 50 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==============================================================================
// BẢNG CẤP 4
// ==============================================================================

export const itineraryItems = pgTable("itinerary_items", {
  itemId: serial("item_id").primaryKey(),
  dayId: integer("day_id").references(() => itineraryDay.dayId, { onDelete: "cascade" }),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "cascade" }),
  poiId: integer("poi_id").references(() => pois.poiId),

  customName: varchar("custom_name", { length: 255 }),
  startTime: time("start_time"),
  duration: integer("duration"),
  orderIndex: integer("order_index"),
  note: text("note"),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 50 }),
  expenseTypeId: integer("expense_type_id").references(() => expenseType.expenseTypeId),
  activityType: varchar("activity_type", { length: 50 }),
});

export const itemReviews = pgTable(
  "item_reviews",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => itineraryItems.itemId, { onDelete: "cascade" }),
    rating: decimal("rating", { precision: 3, scale: 2 }),
    comment: text("comment"),
    // Mirrors tripReviews.photos — array of photo URLs / data URIs.
    photos: jsonb("photos"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.itemId] }),
  }),
);

// ──────────────────────────────────────────────────────────────────────────
// Trip invitations — explicit invite/accept/decline flow. Replaces the
// previous "owner direct-adds" behavior so the invitee gets a notification
// and can choose to join. Sent invitations show up in the inviter's view;
// received ones surface on the invitee's Trips screen.
// ──────────────────────────────────────────────────────────────────────────
export const tripInvitations = pgTable(
  "trip_invitations",
  {
    invitationId: serial("invitation_id").primaryKey(),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.tripId, { onDelete: "cascade" }),
    inviterUserId: integer("inviter_user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    inviteeUserId: integer("invitee_user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("viewer").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    message: text("message"),
    createdAt: timestamp("created_at").defaultNow(),
    respondedAt: timestamp("responded_at"),
  },
  (table) => ({
    // Index so /api/invitations/received and /api/invitations/sent stay fast
    // when the table grows.
    inviteeIdx: index("trip_invitations_invitee_idx").on(
      table.inviteeUserId,
      table.status,
    ),
    inviterIdx: index("trip_invitations_inviter_idx").on(
      table.inviterUserId,
      table.status,
    ),
  }),
);

// ──────────────────────────────────────────────────────────────────────────
// Trip tasks / checklist — preparation + during + after a trip.
// Inspired by Wanderlog Notes/Checklist + TripIt confirmations: each trip
// gets a lightweight todo list shared among members. Categories let users
// group tasks (chuẩn bị / trong chuyến / sau chuyến). Assignee + due date
// are optional. Soft cascade: deleting the trip removes its tasks.
// ──────────────────────────────────────────────────────────────────────────
export const tripTasks = pgTable("trip_tasks", {
  taskId: serial("task_id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => trips.tripId, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }), // "prep" | "during" | "after" | null
  assigneeUserId: integer("assignee_user_id").references(() => users.userId, {
    onDelete: "set null",
  }),
  dueDate: timestamp("due_date"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  completedByUserId: integer("completed_by_user_id").references(() => users.userId, {
    onDelete: "set null",
  }),
  createdByUserId: integer("created_by_user_id").references(() => users.userId, {
    onDelete: "set null",
  }),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  expenseId: serial("expense_id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.tripId, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => itineraryItems.itemId, { onDelete: "set null" }),
  paidBy: integer("paid_by").references(() => users.userId),
  expenseTypeId: integer("expense_type_id").references(() => expenseType.expenseTypeId),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  splitMethod: varchar("split_method", { length: 50 }),
});

// ==============================================================================
// BẢNG CẤP 5
// ==============================================================================

export const expenseSplits = pgTable("expense_splits", {
  splitId: serial("split_id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.expenseId, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.userId, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
});

export const notes = pgTable("notes", {
  noteId: serial("note_id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.expenseId, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => itineraryItems.itemId, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.userId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userFollows = pgTable(
  "user_follows",
  {
    followerId: integer("follower_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    followedId: integer("followed_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.followerId, t.followedId] }) }),
);

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type DestinationType = typeof destinationType.$inferSelect;
export type InsertDestinationType = typeof destinationType.$inferInsert;

export type PoiType = typeof poiType.$inferSelect;
export type InsertPoiType = typeof poiType.$inferInsert;

export type Preference = typeof preferences.$inferSelect;
export type InsertPreference = typeof preferences.$inferInsert;

export type ExpenseType = typeof expenseType.$inferSelect;
export type InsertExpenseType = typeof expenseType.$inferInsert;

export type Destination = typeof destinations.$inferSelect;
export type InsertDestination = typeof destinations.$inferInsert;

export type Poi = typeof pois.$inferSelect;
export type InsertPoi = typeof pois.$inferInsert;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

export type PoiOpeningHours = typeof poiOpeningHours.$inferSelect;
export type InsertPoiOpeningHours = typeof poiOpeningHours.$inferInsert;

export type PoiPreference = typeof poiPreferences.$inferSelect;
export type InsertPoiPreference = typeof poiPreferences.$inferInsert;

export type TripMember = typeof tripMembers.$inferSelect;
export type InsertTripMember = typeof tripMembers.$inferInsert;

export type TripPreference = typeof tripPreferences.$inferSelect;
export type InsertTripPreference = typeof tripPreferences.$inferInsert;

export type ItineraryDay = typeof itineraryDay.$inferSelect;
export type InsertItineraryDay = typeof itineraryDay.$inferInsert;

export type TripReview = typeof tripReviews.$inferSelect;
export type InsertTripReview = typeof tripReviews.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type InsertItineraryItem = typeof itineraryItems.$inferInsert;

export type TripTask = typeof tripTasks.$inferSelect;
export type InsertTripTask = typeof tripTasks.$inferInsert;

export type TripInvitation = typeof tripInvitations.$inferSelect;
export type InsertTripInvitation = typeof tripInvitations.$inferInsert;

export type ItemReview = typeof itemReviews.$inferSelect;
export type InsertItemReview = typeof itemReviews.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type InsertExpenseSplit = typeof expenseSplits.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

// ==============================================================================
// RELATIONS
// ==============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripMembers: many(tripMembers),
  tripReviews: many(tripReviews),
  notifications: many(notifications),
  paidExpenses: many(expenses),
  expenseSplits: many(expenseSplits),
  notes: many(notes),
  itemReviews: many(itemReviews),
}));

export const destinationTypeRelations = relations(destinationType, ({ many }) => ({
  destinations: many(destinations),
}));

export const poiTypeRelations = relations(poiType, ({ many }) => ({
  pois: many(pois),
}));

export const destinationsRelations = relations(destinations, ({ one, many }) => ({
  destinationType: one(destinationType, {
    fields: [destinations.destinationTypeId],
    references: [destinationType.destinationtypeId],
  }),
  pois: many(pois),
  trips: many(trips),
}));

export const poisRelations = relations(pois, ({ one, many }) => ({
  poiType: one(poiType, {
    fields: [pois.poitypeId],
    references: [poiType.poitypeId],
  }),
  destination: one(destinations, {
    fields: [pois.destinationId],
    references: [destinations.destinationId],
  }),
  openingHours: many(poiOpeningHours),
  poiPreferences: many(poiPreferences),
  itineraryItems: many(itineraryItems),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  destination: one(destinations, {
    fields: [trips.destinationId],
    references: [destinations.destinationId],
  }),
  owner: one(users, {
    fields: [trips.ownerId],
    references: [users.userId],
  }),
  members: many(tripMembers),
  tripPreferences: many(tripPreferences),
  days: many(itineraryDay),
  reviews: many(tripReviews),
  notifications: many(notifications),
  expenses: many(expenses),
}));

export const itineraryDayRelations = relations(itineraryDay, ({ one, many }) => ({
  trip: one(trips, {
    fields: [itineraryDay.tripId],
    references: [trips.tripId],
  }),
  items: many(itineraryItems),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one, many }) => ({
  day: one(itineraryDay, {
    fields: [itineraryItems.dayId],
    references: [itineraryDay.dayId],
  }),
  poi: one(pois, {
    fields: [itineraryItems.poiId],
    references: [pois.poiId],
  }),
  itemReviews: many(itemReviews),
  expenses: many(expenses),
  notes: many(notes),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(trips, {
    fields: [expenses.tripId],
    references: [trips.tripId],
  }),
  item: one(itineraryItems, {
    fields: [expenses.itemId],
    references: [itineraryItems.itemId],
  }),
  paidByInfo: one(users, {
    fields: [expenses.paidBy],
    references: [users.userId],
  }),
  expenseType: one(expenseType, {
    fields: [expenses.expenseTypeId],
    references: [expenseType.expenseTypeId],
  }),
  splits: many(expenseSplits),
  notes: many(notes),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.expenseId],
  }),
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.userId],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  expense: one(expenses, {
    fields: [notes.expenseId],
    references: [expenses.expenseId],
  }),
  item: one(itineraryItems, {
    fields: [notes.itemId],
    references: [itineraryItems.itemId],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.userId],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.userId],
  }),
  trip: one(trips, {
    fields: [notifications.tripId],
    references: [trips.tripId],
  }),
}));

export const itemReviewsRelations = relations(itemReviews, ({ one }) => ({
  user: one(users, {
    fields: [itemReviews.userId],
    references: [users.userId],
  }),
  item: one(itineraryItems, {
    fields: [itemReviews.itemId],
    references: [itineraryItems.itemId],
  }),
}));

export const tripReviewsRelations = relations(tripReviews, ({ one }) => ({
  user: one(users, {
    fields: [tripReviews.userId],
    references: [users.userId],
  }),
  trip: one(trips, {
    fields: [tripReviews.tripId],
    references: [trips.tripId],
  }),
}));

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  trip: one(trips, {
    fields: [tripMembers.tripId],
    references: [trips.tripId],
  }),
  user: one(users, {
    fields: [tripMembers.userId],
    references: [users.userId],
  }),
}));

export const poiPreferencesRelations = relations(poiPreferences, ({ one }) => ({
  poi: one(pois, {
    fields: [poiPreferences.poiId],
    references: [pois.poiId],
  }),
  preference: one(preferences, {
    fields: [poiPreferences.preferenceId],
    references: [preferences.preferenceId],
  }),
}));

export const tripPreferencesRelations = relations(tripPreferences, ({ one }) => ({
  trip: one(trips, {
    fields: [tripPreferences.tripId],
    references: [trips.tripId],
  }),
  preference: one(preferences, {
    fields: [tripPreferences.preferenceId],
    references: [preferences.preferenceId],
  }),
}));
