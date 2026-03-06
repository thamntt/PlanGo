# PlanGo - Travel Itinerary Planner

## Overview
PlanGo is a personalized travel itinerary suggestion mobile app built with Expo (React Native) + Express backend. It helps users plan trips to Vietnamese destinations with auto-generated itineraries based on preferences.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, Expo Router (file-based routing)
- **Backend**: Express.js (TypeScript) on port 5000
- **State**: AsyncStorage (local persistence), React Context
- **Styling**: React Native StyleSheet with custom theme system
- **Fonts**: Inter (pre-loaded)

## Project Structure
```
app/
  _layout.tsx          - Root layout with providers (Auth, Data, Query)
  index.tsx            - Auth redirect screen
  (auth)/              - Auth screens (login, register)
  (tabs)/              - Main tab navigation
    index.tsx          - Explore/search destinations
    trips.tsx          - My trips list
    map.tsx            - Location/GPS tracking
    profile.tsx        - User profile & preferences
  destination/[id].tsx - Destination detail + reviews
  itinerary/[id].tsx   - Itinerary detail with timeline
  create-trip.tsx      - Trip planning form
  admin/               - Admin dashboard (users, destinations, reviews)
contexts/
  AuthContext.tsx       - Authentication state (login/register/logout)
  DataContext.tsx       - App data (destinations, itineraries, reviews)
constants/
  colors.ts            - Theme colors (light/dark)
lib/
  storage.ts           - AsyncStorage helpers & data types
  seed-data.ts         - Seed destinations & constants
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
- **Auth**: Register/login with AsyncStorage, admin role
- **Explore**: Browse & search 10 Vietnamese destinations by category
- **Trip Planning**: Create trip requests → auto-generate itineraries
- **Itinerary**: Day-by-day timeline with activities, share, status management
- **Reviews**: Rate & review destinations (star rating)
- **GPS**: Location tracking with expo-location
- **Admin**: Dashboard stats, user management (lock/unlock), destination CRUD, review moderation
- **Theme**: Light/dark mode support

## Default Accounts
- Admin: username `admin`, password `admin123`

## Workflows
- `Start Backend`: `npm run server:dev` (port 5000)
- `Start Frontend`: `npm run expo:dev` (port 8081)
