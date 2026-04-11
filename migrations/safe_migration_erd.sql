-- ====================================================================
-- Safe Migration: Add new tables from ERD diagram
-- This script uses IF NOT EXISTS / IF NOT EXISTS checks so it can be
-- run multiple times without error.
-- ====================================================================

-- ── Lookup / Type Tables ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "destination_type" (
	"destinationtype_id" serial PRIMARY KEY NOT NULL,
	"type_name" text NOT NULL,
	"description" text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "poi_type" (
	"poitype_id" serial PRIMARY KEY NOT NULL,
	"type_name" text NOT NULL,
	"description" text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "expense_type" (
	"expense_type_id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "preferences" (
	"preference_id" serial PRIMARY KEY NOT NULL,
	"preference_name" text NOT NULL
);

-- ── Users: add status column if missing ──────────────────────────────

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active';

-- ── Destinations: add new columns if missing ─────────────────────────

ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "destination_type_id" integer;
ALTER TABLE "destinations" ADD COLUMN IF NOT EXISTS "review_counts" integer DEFAULT 0;

-- ── POIs: add new columns, remove legacy jsonb columns safely ─────────

ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "poitype_id" integer;
ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "review_counts" integer DEFAULT 0;
-- Note: legacy columns (type, openHours, openingHours, description, images, tags, etc.)
-- are LEFT in place to avoid data loss. They can be dropped manually after data migration.

-- ── POI Opening Hours ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "poi_opening_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"poi_id" varchar NOT NULL,
	"day_of_week" text NOT NULL,
	"open_time" text NOT NULL,
	"close_time" text NOT NULL
);

-- ── POI Preferences ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "poi_preferences" (
	"poi_id" varchar NOT NULL,
	"preference_id" integer NOT NULL
);

-- ── Trips ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trips" (
	"trip_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination_id" varchar,
	"owner_id" varchar NOT NULL,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"num_people" integer DEFAULT 1,
	"budget" integer DEFAULT 0,
	"status" text DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"invitation_token" text
);

-- ── Trip Members ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trip_members" (
	"trip_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member',
	"joined_st" timestamp DEFAULT now()
);

-- ── Trip Preferences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trip_preferences" (
	"trip_id" varchar NOT NULL,
	"preference_id" integer NOT NULL
);

-- ── Trip Reviews ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "trip_reviews" (
	"user_id" varchar NOT NULL,
	"trip_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT ''
);

-- ── Itinerary Days ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "itinerary_day" (
	"day_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"date" text NOT NULL,
	"day_index" integer NOT NULL
);

-- ── Itinerary Items ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "itinerary_items" (
	"item_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_id" varchar NOT NULL,
	"poi_id" varchar,
	"custom_name" text DEFAULT '',
	"start_time" text,
	"duration" integer,
	"order_index" integer DEFAULT 0,
	"note" text DEFAULT '',
	"estimated_cost" integer DEFAULT 0,
	"actual_cost" integer DEFAULT 0,
	"status" text DEFAULT 'pending'
);

-- ── Item Reviews ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "item_reviews" (
	"user_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text DEFAULT ''
);

-- ── Expenses ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "expenses" (
	"expense_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"item_id" varchar,
	"paid_by" varchar NOT NULL,
	"expense_type_id" integer,
	"amount" integer NOT NULL,
	"description" text DEFAULT '',
	"split_method" text DEFAULT 'equal',
	"created_at" timestamp DEFAULT now()
);

-- ── Expense Splits ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "expense_splits" (
	"split_id" serial PRIMARY KEY NOT NULL,
	"expense_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL
);

-- ── Notes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notes" (
	"note_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" varchar,
	"item_id" varchar,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- ── Notifications: add trip_id FK column if missing ───────────────────

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "trip_id" varchar;

-- ====================================================================
-- Foreign Key Constraints (add only if not already present)
-- ====================================================================

DO $$
BEGIN
  -- destinations → destination_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'destinations_destination_type_id_fk'
  ) THEN
    ALTER TABLE "destinations"
      ADD CONSTRAINT "destinations_destination_type_id_fk"
      FOREIGN KEY ("destination_type_id")
      REFERENCES "destination_type"("destinationtype_id");
  END IF;

  -- pois → poi_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pois_poitype_id_fk'
  ) THEN
    ALTER TABLE "pois"
      ADD CONSTRAINT "pois_poitype_id_fk"
      FOREIGN KEY ("poitype_id")
      REFERENCES "poi_type"("poitype_id");
  END IF;

  -- poi_opening_hours → pois
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'poi_opening_hours_poi_id_fk'
  ) THEN
    ALTER TABLE "poi_opening_hours"
      ADD CONSTRAINT "poi_opening_hours_poi_id_fk"
      FOREIGN KEY ("poi_id") REFERENCES "pois"("poi_id") ON DELETE CASCADE;
  END IF;

  -- poi_preferences → pois
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'poi_preferences_poi_id_fk'
  ) THEN
    ALTER TABLE "poi_preferences"
      ADD CONSTRAINT "poi_preferences_poi_id_fk"
      FOREIGN KEY ("poi_id") REFERENCES "pois"("poi_id") ON DELETE CASCADE;
  END IF;

  -- poi_preferences → preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'poi_preferences_preference_id_fk'
  ) THEN
    ALTER TABLE "poi_preferences"
      ADD CONSTRAINT "poi_preferences_preference_id_fk"
      FOREIGN KEY ("preference_id") REFERENCES "preferences"("preference_id") ON DELETE CASCADE;
  END IF;

  -- trips → destinations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trips_destination_id_fk'
  ) THEN
    ALTER TABLE "trips"
      ADD CONSTRAINT "trips_destination_id_fk"
      FOREIGN KEY ("destination_id") REFERENCES "destinations"("id");
  END IF;

  -- trip_members → trips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trip_members_trip_id_fk'
  ) THEN
    ALTER TABLE "trip_members"
      ADD CONSTRAINT "trip_members_trip_id_fk"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE;
  END IF;

  -- trip_preferences → trips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trip_preferences_trip_id_fk'
  ) THEN
    ALTER TABLE "trip_preferences"
      ADD CONSTRAINT "trip_preferences_trip_id_fk"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE;
  END IF;

  -- trip_preferences → preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trip_preferences_preference_id_fk'
  ) THEN
    ALTER TABLE "trip_preferences"
      ADD CONSTRAINT "trip_preferences_preference_id_fk"
      FOREIGN KEY ("preference_id") REFERENCES "preferences"("preference_id") ON DELETE CASCADE;
  END IF;

  -- trip_reviews → trips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'trip_reviews_trip_id_fk'
  ) THEN
    ALTER TABLE "trip_reviews"
      ADD CONSTRAINT "trip_reviews_trip_id_fk"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE;
  END IF;

  -- itinerary_day → trips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'itinerary_day_trip_id_fk'
  ) THEN
    ALTER TABLE "itinerary_day"
      ADD CONSTRAINT "itinerary_day_trip_id_fk"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE;
  END IF;

  -- itinerary_items → itinerary_day
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'itinerary_items_day_id_fk'
  ) THEN
    ALTER TABLE "itinerary_items"
      ADD CONSTRAINT "itinerary_items_day_id_fk"
      FOREIGN KEY ("day_id") REFERENCES "itinerary_day"("day_id") ON DELETE CASCADE;
  END IF;

  -- itinerary_items → pois
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'itinerary_items_poi_id_fk'
  ) THEN
    ALTER TABLE "itinerary_items"
      ADD CONSTRAINT "itinerary_items_poi_id_fk"
      FOREIGN KEY ("poi_id") REFERENCES "pois"("poi_id");
  END IF;

  -- item_reviews → itinerary_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'item_reviews_item_id_fk'
  ) THEN
    ALTER TABLE "item_reviews"
      ADD CONSTRAINT "item_reviews_item_id_fk"
      FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("item_id") ON DELETE CASCADE;
  END IF;

  -- expenses → trips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_trip_id_fk'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_trip_id_fk"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE CASCADE;
  END IF;

  -- expenses → itinerary_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_item_id_fk'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_item_id_fk"
      FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("item_id");
  END IF;

  -- expenses → expense_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_expense_type_id_fk'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_expense_type_id_fk"
      FOREIGN KEY ("expense_type_id") REFERENCES "expense_type"("expense_type_id");
  END IF;

  -- expense_splits → expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'expense_splits_expense_id_fk'
  ) THEN
    ALTER TABLE "expense_splits"
      ADD CONSTRAINT "expense_splits_expense_id_fk"
      FOREIGN KEY ("expense_id") REFERENCES "expenses"("expense_id") ON DELETE CASCADE;
  END IF;

  -- notes → expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_expense_id_fk'
  ) THEN
    ALTER TABLE "notes"
      ADD CONSTRAINT "notes_expense_id_fk"
      FOREIGN KEY ("expense_id") REFERENCES "expenses"("expense_id") ON DELETE CASCADE;
  END IF;

  -- notes → itinerary_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_item_id_fk'
  ) THEN
    ALTER TABLE "notes"
      ADD CONSTRAINT "notes_item_id_fk"
      FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("item_id") ON DELETE CASCADE;
  END IF;

  -- notifications → trips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_trip_id_fk'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_trip_id_fk"
      FOREIGN KEY ("trip_id") REFERENCES "trips"("trip_id") ON DELETE SET NULL;
  END IF;

END $$;
