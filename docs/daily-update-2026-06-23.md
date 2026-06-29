# Taxiro Daily Development Update - 23 June 2026

## Summary

Today focused on live ride tracking, phase-aware navigation, real-time rider/customer coordination, and a major mobile UI/UX correction for the user and rider applications.

The application now has a stronger real-world ride lifecycle: the customer can follow the assigned rider approaching pickup, the rider verifies the customer code, and tracking then switches toward the drop destination. Mobile layouts were reworked from oversized dashboard-style screens into cleaner map-first app flows.

## Work Completed Today

### Live Rider Tracking

- Added foreground browser GPS tracking with `navigator.geolocation.watchPosition`.
- Rider GPS updates now persist to Supabase while the rider app is open.
- Stored tracking metadata includes latitude, longitude, accuracy, heading, speed, update time, and last-seen time.
- Kept manual map-tap and refresh behavior as a fallback when GPS is unavailable or denied.
- Added a Supabase Realtime subscription so the assigned customer receives rider location updates.
- Added rider freshness and GPS accuracy information to the live ride experience.

### Phase-Aware Ride Routing

- Added rider-to-pickup routing before confirmation-code verification.
- Added rider-to-destination routing after the ride starts.
- User map now shows the assigned rider and the correct route for the current ride phase.
- Rider primary navigation action changes from `Navigate to pickup` to `Navigate to drop` after code verification.
- Added live ETA and route-distance summaries using OSRM.
- Improved ride-state communication for assigned, arriving, started, and destination phases.

### Ride Confirmation And Chat

- Strengthened private ride-code loading and fallback repair behavior.
- Confirmation code remains visible only to the booking customer before trip start.
- Rider starts the trip only after entering and verifying the code.
- Improved assigned-ride chat with role-aware quick replies.
- Separated pickup conversation guidance from in-trip conversation guidance.
- Added clearer sender labels, sending state, sent state, and message-length handling.

### Rider Demand Experience

- Improved ready-now and scheduled-demand map signals.
- Added stronger visual urgency for ready requests and softer scheduled demand indicators.
- Demand signals are hidden while the rider has an active job to keep the map focused.
- Added ready, scheduled, and available-rider summaries to the rider work sheet.
- Kept rider request cards connected to real Supabase ride records.

### Mobile Layout And Scrolling Fixes

- Removed document-level horizontal scrolling from the user and rider applications.
- Replaced viewport-width sizing with parent-bounded, shrink-safe layouts.
- Added explicit mobile viewport configuration.
- Constrained Leaflet containers and map layers so transformed map content cannot widen the page.
- Added `min-width: 0`, maximum-width, wrapping, and truncation protections for long addresses and real database values.
- Fixed user/rider bottom sheets so they fit the device width.
- Fixed the rider screen's large empty vertical area caused by a full-viewport mobile wrapper.
- Reduced mobile map height to improve the balance between map context and actions.
- Preserved vertical page scrolling while preventing accidental side movement.

### Accidental Zoom Prevention

- Disabled accidental mobile pinch zoom and browser gesture zoom.
- Prevented Ctrl/Command plus mouse-wheel zoom.
- Prevented browser keyboard zoom shortcuts inside the application.
- Set mobile form fields to a 16px minimum font size to prevent iPhone input-focus auto-zoom.
- Preserved normal vertical scrolling and intentional map interactions.

### User Booking UX Upgrade

- Changed the booking heading to the more direct `Where are you going?` flow.
- Removed repeated pickup/drop summary information.
- Removed duplicate `From/Pickup` and `To/Drop` labels from search controls.
- Kept Detect and Map actions beside the correct pickup/drop field.
- Hidden secondary bike/fast/ready metric tiles on small screens.
- Added a clear low-GPS-accuracy state when detected accuracy is poor.
- Condensed current-ride guidance.
- Converted the rider pickup note into an expandable optional section.
- Made the main booking action easier to reach with a sticky mobile CTA.
- Preserved separate Ride Now and Advance Booking modes.

### Rider UX Upgrade

- Removed the unnecessary full-screen reservation below the ready-request panel.
- Brought demand and route tools directly after the live work panel.
- Tightened request summary spacing and mobile card sizing.
- Reduced internal request-list height to keep the primary workflow visible.
- Converted On-The-Way route setup into an expandable secondary tool.
- Improved GPS status positioning and mobile header sizing.

### Shared UI Hardening

- Updated shared Card, Input, Button, AppShell, map, and location-search components for mobile-safe sizing.
- Updated the dynamic map loading state so it does not reserve a full device viewport.
- Added safer handling for long location names and route content.
- Kept desktop overlay behavior while giving mobile a natural top-to-bottom flow.

## Database Update

Added and applied the additive Supabase migration:

- `supabase/migrations/20260623093000_live_tracking_metadata.sql`

The migration adds optional live-tracking metadata to `rider_locations`:

- `accuracy_m`
- `heading`
- `speed`
- `last_seen_at`

No existing tables or records were deleted.

## Files And Areas Updated

Primary areas updated today:

- `src/app/dashboard/user/page.tsx`
- `src/app/dashboard/rider/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/AppShell.tsx`
- `src/components/MapPicker.tsx`
- `src/components/DynamicMapPicker.tsx`
- `src/components/LocationSearch.tsx`
- `src/components/RideChatPanel.tsx`
- `src/components/RouteSetupForm.tsx`
- `src/components/DemandSignals.tsx`
- `src/components/RiderAvailabilityToggle.tsx`
- `src/components/ZoomGuard.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/lib/tracking.ts`
- `src/lib/maps.ts`
- Supabase live-tracking migration

## Verification Completed

- `npx tsc --noEmit`: passed.
- Focused ESLint checks for the modified dashboards and shared components: passed.
- `npm run build`: passed on Next.js 16.2.7.
- `/dashboard/user`: returned HTTP 200.
- `/dashboard/rider`: returned HTTP 200.
- All application routes compiled successfully.
- Supabase live-tracking migration was applied successfully.

## Current Product Status

Taxiro is now a stronger functional MVP with:

- Real Supabase authentication and role separation.
- User booking and advance booking.
- Rider availability and demand visibility.
- Secure ride acceptance and private confirmation code.
- Foreground live rider tracking.
- Pickup-phase and destination-phase routes.
- Assigned user/rider chat.
- Ride cancellation, start, completion, rating, and history foundations.
- Map-first responsive user and rider experiences.

The application is not yet production-ready for public daily use. It requires two-device end-to-end QA, reliability testing, security review, and stronger offline/notification support.

## Next Priorities

1. Test the complete user-to-rider lifecycle using two real authenticated devices.
2. Validate Supabase Realtime tracking and chat across separate sessions.
3. Test GPS denied, poor accuracy, stale location, offline, and reconnect cases.
4. Add automated end-to-end tests for booking, acceptance, code verification, start, chat, cancellation, and completion.
5. Perform final responsive QA on multiple Android phones, iPhones, tablets, and desktop browsers.
6. Add persistent notifications and stronger background/resume behavior.
7. Complete a focused Supabase RLS and authorization security review.
