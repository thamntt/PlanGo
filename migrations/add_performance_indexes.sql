-- Performance indexes for foreign key columns.
-- PostgreSQL does NOT auto-create indexes on FK columns (only on the referenced PK),
-- so without these every JOIN/WHERE on an FK column does a sequential scan.
-- Run once: psql $DATABASE_URL -f migrations/add_performance_indexes.sql
-- All statements are idempotent (`IF NOT EXISTS`), safe to re-run.

-- ─── Trips: filter by owner, lookup by share token ───
CREATE INDEX IF NOT EXISTS idx_trips_owner_id ON trips (owner_id);
CREATE INDEX IF NOT EXISTS idx_trips_destination_id ON trips (destination_id);
CREATE INDEX IF NOT EXISTS idx_trips_invitation_token ON trips (invitation_token);
CREATE INDEX IF NOT EXISTS idx_trips_status_created_at ON trips (status, created_at DESC);

-- ─── Itinerary: nested fetches per trip / per day ───
CREATE INDEX IF NOT EXISTS idx_itinerary_day_trip_id ON itinerary_day (trip_id, day_index);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_day_id ON itinerary_items (day_id, order_index);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_id ON itinerary_items (trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_poi_id ON itinerary_items (poi_id);

-- ─── Expenses + splits ───
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses (trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_item_id ON expenses (item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses (paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits (user_id);

-- ─── Reviews ───
CREATE INDEX IF NOT EXISTS idx_trip_reviews_trip_user ON trip_reviews (trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trip_reviews_user_id ON trip_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_item_reviews_item_user ON item_reviews (item_id, user_id);
CREATE INDEX IF NOT EXISTS idx_item_reviews_user_id ON item_reviews (user_id);

-- ─── Trip members + preferences ───
CREATE INDEX IF NOT EXISTS idx_trip_members_user_id ON trip_members (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_user ON trip_members (trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trip_preferences_trip_id ON trip_preferences (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_preferences_preference_id ON trip_preferences (preference_id);

-- ─── POIs ───
CREATE INDEX IF NOT EXISTS idx_pois_destination_id ON pois (destination_id);
CREATE INDEX IF NOT EXISTS idx_pois_google_place_id ON pois (google_place_id);
CREATE INDEX IF NOT EXISTS idx_pois_name ON pois (name);
CREATE INDEX IF NOT EXISTS idx_poi_preferences_poi_id ON poi_preferences (poi_id);
CREATE INDEX IF NOT EXISTS idx_poi_preferences_preference_id ON poi_preferences (preference_id);
CREATE INDEX IF NOT EXISTS idx_poi_opening_hours_poi_id ON poi_opening_hours (poi_id);

-- ─── Notifications ───
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_trip_id ON notifications (trip_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- ─── Users: lookups by email/username already use UNIQUE constraints (implicit btree). ───

ANALYZE; -- refresh planner stats so the new indexes get picked up immediately
