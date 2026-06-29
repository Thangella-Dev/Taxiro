# Taxiro Progress Report - 08 June 2026 to 24 June 2026

## Executive Summary

Taxiro is a predictive bike taxi MVP for India using a free/open stack: Next.js, Supabase, PostGIS, OpenStreetMap, Nominatim, OSRM, Leaflet, and Vercel.

As of 24 June 2026, the MVP includes authentication, user/rider/admin role separation, ride booking, advance booking, rider availability, ready ride acceptance, private confirmation code, live foreground rider tracking, phase-aware route display, ride chat, ride cancellation, rating foundations, rider verification foundations, admin operations views, and Supabase Realtime-backed updates.

The most recent development focus was fixing realtime behavior so the app no longer depends on manual refreshes to show ride, rider, admin, and chat updates.

## Major Completed Work

### Core Platform

- Created the Taxiro Next.js App Router project.
- Added Supabase authentication and role-based app routing.
- Added user, rider, and admin dashboard areas.
- Added Tailwind CSS, local shadcn-style UI primitives, Lucide icons, Leaflet maps, Nominatim search, and OSRM routing.
- Added Supabase SQL schema, migrations, RLS policies, triggers, and RPC functions.

### User Ride Flow

- User sign up and sign in.
- User profile foundation.
- Ride-now booking.
- Advance booking.
- Pickup and drop search.
- Pickup current-location detection.
- Pickup/drop map selection.
- Focused choose-on-map mode.
- Fare estimate, distance, ETA, payment preference, and rider note.
- `I'm Ready` activation.
- Private confirmation code display.
- Active ride status and progress.
- Ride cancellation before trip start.
- Ride history sections.
- Ride detail screen.
- Completed-ride rating foundation.

### Rider Ride Flow

- Rider role-protected dashboard.
- Online/offline availability.
- Foreground GPS tracking while the rider app is open.
- Manual map-tap/refresh fallback.
- Ready ride request list.
- Rider acceptance of ready rides.
- Rider navigation to pickup/drop.
- Confirmation code verification.
- Trip start.
- Trip completion.
- Accepted-ride cancellation before trip start.
- Rider identity and vehicle verification foundation.
- Rider menu and job history.

### Live Tracking And Routing

- Added rider GPS metadata: accuracy, heading, speed, last seen time.
- Added phase-aware route display.
- Before pickup: rider-to-pickup route.
- After code verification: route toward destination.
- Added live ETA and distance summaries.
- Added assigned rider marker and freshness information.

### Chat And Coordination

- Added assigned-ride chat between the user and rider.
- Added role-aware and phase-aware quick messages.
- Added chat sender labels and sent state.
- Improved chat realtime behavior on 24 June 2026 so messages update live and recover on browser reconnect/tab visibility.

### Demand Signals

- Added rider map demand signals for scheduled and ready rides.
- Added stronger visual signals for ready-now rides.
- Added softer scheduled demand indicators.
- Hid demand clutter when rider has an active job.

### Admin Operations

- Added admin dashboard.
- Added user/rider counts.
- Added scheduled ride and active rider counts.
- Added ride search and status filtering.
- Added rider verification review foundation.
- Added realtime admin updates for rides, profiles, rider locations, and rider verification data.

### Mobile UI/UX

- Converted the experience toward a map-first app layout.
- Improved bottom-sheet behavior on mobile.
- Removed horizontal side scrolling.
- Reduced oversized dashboard sections.
- Fixed rider mobile empty-space behavior.
- Added device-width-safe layout constraints.
- Added accidental zoom prevention and iPhone input-focus zoom prevention.
- Improved compact user booking and rider work panels.

### Realtime Infrastructure

- Added foreground live rider tracking.
- Added Supabase Realtime subscriptions in user/rider/admin/chat flows.
- Enabled required Taxiro database tables in Supabase `supabase_realtime` publication.
- Added replica identity metadata for reliable update/delete payloads.
- Added reconnect messaging for realtime interruptions.

### GitHub And Deployment Readiness

- Removed `.mcp.json` from Git tracking after GitHub push protection detected a Supabase Personal Access Token.
- Added `.mcp.json` to `.gitignore`.
- Confirmed `.env.local` remains ignored.
- Amended the commit so local MCP credentials are not present in the committed tree.
- Confirmed Vercel should receive only public frontend env variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_NOMINATIM_BASE_URL`
  - `NEXT_PUBLIC_OSRM_BASE_URL`
- Confirmed no service-role key or Supabase personal access token should be added to frontend/Vercel public env.

## Verification Status

Latest verification completed on 24 June 2026:

- `npx tsc --noEmit`: passed.
- Focused ESLint checks: passed.
- `npm run build`: passed.
- Supabase MCP table inspection completed.
- Supabase Realtime publication verification completed.
- Git tracking check confirmed `.mcp.json`, `.env`, and `.env.local` are not tracked.
- Secret pattern scan confirmed the committed tree no longer includes the Supabase personal access token pattern.

## Current Status

Taxiro is a strong MVP foundation with realistic ride-hailing flows and live Supabase-backed state updates. The app is closer to an Uber/Ola-style flow than the initial dashboard-style prototype.

It is not yet final production-ready. It still needs real multi-device QA, stronger offline/reconnect handling, security review, automated E2E tests, notification support, and production-grade geocoding/routing decisions.

## Immediate Next Steps

1. Rotate the exposed Supabase Personal Access Token.
2. Push the cleaned commit to GitHub from an authenticated local terminal.
3. Add required public environment variables to Vercel.
4. Deploy Taxiro to Vercel.
5. Run two-device user/rider end-to-end QA.
6. Confirm realtime status, GPS, chat, code, admin, and ride updates without page refresh.
7. Test GPS denied, stale GPS, poor accuracy, offline, reconnect, and slow-network scenarios.
8. Add automated E2E tests for the complete ride lifecycle.
