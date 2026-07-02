# Taxiro Daily Update - 02 July 2026

## Summary

Today focused on reliability and mobile usability in the customer ride experience, installed-app location access, rider tracking presentation, demand-signal clarity, and truthful rider reputation data.

## Completed Work

### User My Rides and mobile sheet behavior

- Fixed the user side-menu My Rides action during an active trip.
- Ride history now takes priority when explicitly opened instead of being overridden by the active-trip panel.
- Switching to My Rides remounts the responsive sheet in its open state, so a previously collapsed mobile sheet cannot hide the requested view.
- Added a clear Back to live trip action when ride history is opened during an active ride.
- Existing Active, Upcoming, Completed, and Cancelled ride groups remain scrollable and Supabase-backed.

### Installed PWA location access

- Added the production Permissions-Policy header geolocation=(self).
- Changed current-location detection to invoke the Geolocation API directly from the user's tap, including installed Chrome and Safari home-screen mode.
- Removed the stale one-minute fallback location cache; fallback fixes now also require a fresh position.
- Added installed-app-specific permission guidance for denied location access.
- Enabled the top location action during an active trip so the user can refresh the current device position.
- Preserved manual search and choose-on-map fallback behavior.

### Live rider tracking layout

- Moved the assigned-rider live status pill below the mobile safe area and map header controls.
- The tracking pill no longer sits behind the Trip in progress header.
- The pill continues to show the real assigned vehicle, current pickup/drop phase, and live route ETA.
- Bike, Auto, and Car map markers remain vehicle-specific.

### Demand signal clarity

- Added permanent Ready demand and Advance demand labels to rider map signals.
- Preserved urgency circles, popup fare/earning data, scheduled time, vehicle type, pickup, and drop context.

### Real rider reputation

- Added migration 20260702153000_real_rider_reputation_stats.sql.
- Removed the synthetic 5.0 default for new rider profiles.
- Backfilled completed-rides totals from real completed ride_requests.
- Backfilled average ratings from real ride_ratings.
- Added database triggers that recalculate rider statistics whenever rides or ratings change.
- Updated the customer assigned-rider card and ride detail screen to show New rider when no rating exists.
- Applied the migration to the connected Supabase project.

## Live Database Verification

- Rider profiles found: 1.
- Real completed rides recorded: 5.
- Riders with submitted ratings: 0.
- Completed-ride count mismatches: 0.
- Ride-stat synchronization trigger: active.
- Rating-stat synchronization trigger: active.

No demo rider rating or completed-ride count was introduced.

## Verification

- npx tsc --noEmit: passed.
- Focused ESLint for changed user, ride-detail, map, tracking, and type files: passed.
- git diff --check: passed.
- npm run build: passed on Next.js 16.2.7.
- All 17 application routes compiled successfully.
- Production home response: HTTP 200.
- Permissions-Policy response: geolocation=(self).
- PWA manifest response: HTTP 200, standalone display and root start URL confirmed.
- Live Supabase migration and trigger verification: passed.

## Current Limitations

- A user who previously denied location must enable it in device/browser settings; web code cannot override an OS-level denial.
- Foreground browser tracking works while Taxiro is open. Reliable background tracking and closed-app alerts require native mobile capabilities and push notification services.
- Full authenticated two-device visual QA remains required before a public production launch.
