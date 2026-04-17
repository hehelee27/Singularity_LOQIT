# LOQIT — Secure Phone Ownership & Recovery System

## Overview
A full-stack device recovery platform for citizens and law enforcement. Enables users to register devices, report them as lost, and use BLE for detection and secure finder-owner communication.

## Project Structure

- **`/` (Root):** Expo/React Native mobile application (for EAS cloud builds only — not run on Replit)
- **`web/`:** Vite/React web dashboard + animated landing page — **this is what runs on Replit**
  - `web/src/pages/LandingPage.tsx` - Animated public landing page with BLE particles
  - `web/src/pages/` - Civilian pages (devices, chat, alerts, profile)
  - `web/src/pages/police/` - Police portal (dashboard, cases, chats, analytics)
  - `web/src/services/aiService.ts` - Groq AI chat risk analysis
  - `web/src/lib/supabase.ts` - Supabase client config
- **`supabase/`:** SQL migrations and Edge Functions (run manually in Supabase dashboard)
- **`scripts/`:** Utility scripts

## Running the App

The workflow `Start application` runs `cd web && npm run dev` on port 5000. It serves the Vite+React web dashboard.

## Routing

- `/` — Landing page (public, unauthenticated)
- `/login` — Auth page (civilian + police toggle)
- `/dashboard` — Civilian home (protected)
- `/devices`, `/add-device`, `/chat`, `/alerts`, `/profile` — Civilian features
- `/police` — Police command center (role-protected)
- `/police/reports`, `/police/chats`, `/police/analytics`, etc.

## Technologies
- **Web Frontend:** React + Vite + framer-motion (TypeScript), port 5000
- **Mobile:** React Native + Expo SDK 55 with BLE libraries (built via EAS, not on Replit)
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Edge Functions)
- **AI:** Groq API (Llama-3.3-70b) for chat risk analysis
- **Maps/Geocoding:** LocationIQ

## Auth Routes (must be in Supabase Redirect URLs)
Add both of these to Supabase → Authentication → URL Configuration → Redirect URLs:
- `https://93e1fe7a-6c9c-4a22-9518-c90b5818d9ea-00-1l2pedhrkj7bq.worf.replit.dev/auth/callback` — Google OAuth callback
- `https://93e1fe7a-6c9c-4a22-9518-c90b5818d9ea-00-1l2pedhrkj7bq.worf.replit.dev/auth/reset-password` — Forgot password email link

## Features Built
- **Live Map** (`/map`): Full-screen Leaflet map with device location markers (color-coded by status), beacon history dots, left panel with filter/device list, click-to-focus, detail popups — route in Sidebar + App.tsx
- **Web-native redesign**: HomePage (compact stats strip, recent devices table, quick action panel), DevicesPage (data table with search/filter + slide-out detail panel), ProfilePage (compact header bar replacing giant mobile avatar) — all use horizontal space properly
- **Device type extended**: Added `last_seen_lat` and `last_seen_lng` to `Device` type
- Animated landing page with BLE particle canvas, scroll-driven story, live stats counter, interactive demo walkthrough, download section
- Case assignment workflow: officers assigned to reports, status tracking (unassigned → under_investigation → resolved → closed), case notes
- AI auto-risk scoring: chats auto-analyzed on open, risk badge on chat list, full analysis panel
- Duplicate IMEI detection: real-time check on device registration with fraud warning
- Police-only route guard (PoliceRoute component)
- Anti-theft mode: SIM watch, motion watch, camera capture, BLE broadcast

## Database Migrations
All migrations are in `supabase/` and must be run manually in the Supabase SQL editor:
- `supabase/fix_all_database_issues.sql` — Comprehensive idempotent script (run this first)
- `supabase/anti_theft_schema.sql` — Anti-theft tables

## Environment Variables

Set in Replit Secrets:
```
VITE_SUPABASE_ANON_KEY   # Supabase public/anon key
VITE_GROQ_API_KEY        # Groq API key for AI chat analysis
```

Set as Replit env var (shared):
```
VITE_SUPABASE_URL        # https://qnyukwxgrvrfwhrsaepj.supabase.co
```

Mobile app (EAS build) additionally needs:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_LOCATIONIQ_API_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
