# PlanGo - Travel Itinerary Planner

## Overview
PlanGo is a personalized travel itinerary suggestion mobile app built with Expo (React Native) + Express backend. It helps users plan trips to Vietnamese destinations with auto-generated itineraries, budget tracking, activity management, and deep links to Google Maps and Grab.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **State**: AsyncStorage (local persistence), React Context
- **Styling**: React Native StyleSheet with custom theme system
- **Fonts**: Inter (pre-loaded)
- **i18n**: Centralized text in `lib/i18n.ts` (Vietnamese default)

## Project Structure
```
app/
  _layout.tsx          - Root layout with providers (Auth, Data, Settings, Query) + AuthGate
  index.tsx            - Auth redirect screen
  (auth)/              - Auth screens (login, register)
  (tabs)/              - Main tab navigation
    index.tsx          - Explore/search destinations (with notification bell + badge)
    trips.tsx          - My trips list
    map.tsx            - Location/GPS tracking
    profile.tsx        - User profile, preferences, settings (dark mode), change password
  destination/[id].tsx - Destination detail + sample reviews (Google/TripAdvisor) + user reviews + Maps/Grab deep links
  itinerary/[id].tsx   - Itinerary detail with two-tab layout (Lịch trình/Chi phí), editable time slots with auto-cascade, activity costs/notes/completion, separate expenses CRUD, deep links, reorder
  create-trip.tsx      - Trip planning form (starting point, numeric budget with VND formatting)
  notifications.tsx    - Notifications screen (mark read, clear all)
  admin/               - Admin dashboard (users, destinations, reviews)
contexts/
  AuthContext.tsx       - Authentication state (login/register/logout/changePassword)
  DataContext.tsx       - App data (destinations, itineraries, reviews, notifications) + itinerary generation
  SettingsContext.tsx   - Theme mode (system/light/dark), persisted in AsyncStorage
constants/
  colors.ts            - Theme colors (light/dark), useThemeColors(isDark)
lib/
  i18n.ts              - All UI text strings (Vietnamese), change this file to switch language
  validation.ts        - Reusable form validators
  storage.ts           - AsyncStorage helpers & data types (ItineraryActivity with costs/notes/completion, Expense with CRUD/notes/paidBy, Notification)
  seed-data.ts         - 10 Vietnamese destinations with estimatedCostPerPerson, sampleReviews, nearbyFood
  query-client.ts      - React Query client
components/
  ErrorBoundary.tsx     - Error boundary wrapper
  ErrorFallback.tsx     - Error fallback UI
server/
  index.ts             - Express server setup
  routes.ts            - API routes
  storage.ts           - Server storage
```

## Key Features
- **Auth**: Register/login with AsyncStorage, admin role, AuthGate in root layout for auto-redirect, change password
- **Validation**: Reusable validators in `lib/validation.ts` — inline field errors across all forms
- **i18n**: All UI text centralized in `lib/i18n.ts` — change this file to switch language
- **Dark Mode**: System/Light/Dark toggle in Profile > Settings, persisted in AsyncStorage via SettingsContext
- **Explore**: Browse & search 10 Vietnamese destinations by category, notification bell with unread count badge
- **Trip Planning**: Create trip with starting point, numeric VND budget (thousand-separator formatting), destination, dates, traveler count, preferences → auto-generate itineraries
- **Itinerary Generation**: Geo-sorted by proximity from starting point (haversine), activities within each day sorted by nearest-neighbor proximity, granular time slots (07:00-20:00), food activities with restaurant suggestions, estimated costs per activity × numPeople
- **Travel Connectors**: Between activities in itinerary detail, shows estimated travel time/distance with transport mode (car, motorbike, walking). Default: car for >1km, walking for ≤1km. Tappable to expand and see all transport mode options
- **Itinerary Detail**: Budget tracking card (total/spent/remaining with progress bar), activity completion checkboxes, edit actual cost + paidBy, add notes, reorder activities, add custom expenses, Google Maps & Grab deep links, share as formatted text, edit trip info modal
- **Budget Tracking**: Real-time budget progress, warnings when exceeding budget, cost per activity
- **Reviews**: Rate & review destinations (star rating), sample reviews from Google/TripAdvisor displayed with badges
- **Notifications**: Trip created/started/completed, budget warnings, activity completion — bell icon with unread badge, mark read/clear all
- **Deep Links**: Google Maps directions, Grab booking for destinations and itinerary activities
- **GPS**: Location tracking with expo-location
- **Admin**: Dashboard stats, user management, destination CRUD with validation, review moderation

## Data Model Highlights
- **ItineraryActivity**: estimatedCost, actualCost, paidBy, note, isCompleted, activityType (sightseeing/food/transport/shopping/other), address, lat/lng
- **Itinerary**: totalBudget (numeric VND), spentAmount, startingPoint, budget (display string)
- **Notification**: userId, title, message, type (info/warning/success), isRead
- **Destination**: estimatedCostPerPerson, sampleReviews (with source badge), nearbyFood (with coordinates/cost)
- Budget stored as `totalBudget: number` (VND integer), display via `formatVND()` from `lib/storage.ts`

## Theme System
- All screens use `useSettings()` from `SettingsContext` for `isDark`
- `useThemeColors(isDark)` returns the correct color palette
- Profile > Settings section has 3 buttons: System / Light / Dark

## Language System
- `lib/i18n.ts` exports `t()` function returning all text strings
- To change language: edit the `vi` object in `lib/i18n.ts` or create a new translation object
- Text organized by section: auth, explore, trips, map, destination, createTrip, itinerary, profile, settings, admin, validation, common, categories, preferences, tabs, notifications

## Default Accounts
- Admin: username `admin`, password `admin123`

## Workflows
- `Start Backend`: `npm run server:dev` (port 5000)
- `Start Frontend`: `npm run expo:dev` (port 8081)
