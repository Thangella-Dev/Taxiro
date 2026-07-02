# Taxiro Progress Report - 08 June 2026 to 02 July 2026

## Executive Summary

Taxiro is a map-first bike taxi web MVP for India built with Next.js, React, TypeScript, Tailwind CSS, Supabase, PostGIS, Leaflet, OpenStreetMap, Nominatim, and OSRM.

As of 02 July 2026, the local application supports authentication and role separation, ride-now and advance booking, self/other passenger booking, current-location/search/map selection, timed ready signals, rider availability, demand signals, ride acceptance, private confirmation codes, assigned chat, foreground GPS tracking, phase-aware pickup/drop routes, SOS safety-alert foundations, ride cancellation, ratings, distance/peak fare locking, rider earning splits, rider UPI setup, payment-confirmed completion, a redesigned admin command center, and information/policy pages.

## Major Product Capabilities

### User Experience

- Supabase-backed signup, sign-in, profile, and role protection.
- Ride-now and advance-booking flows.
- Bike, Auto, and Car vehicle selection with vehicle-specific pricing.
- Booking-for selection: customer can book for themselves or another passenger.
- Passenger name/phone capture for someone-else bookings.
- Pickup using GPS detection, search, or map selection; drop using search or map selection.
- Current-device detect is disabled for someone-else bookings to avoid incorrect pickup location.
- Route distance, ETA, fare estimate, fare rate, payment preference, and rider note before booking.
- Standard fare at Rs 7/km and peak fare at Rs 8/km for configured IST peak windows.
- Vehicle fare uplift: Bike base, Auto + Rs 1/km, and Car + Rs 2/km for both standard and peak rides.
- Timed I'm Ready activation with 15, 30, and 60 minute signal duration choices.
- Rider assignment, private 4-digit code, live rider tracking, and assigned chat.
- Rider-to-pickup tracking before code verification and destination tracking after trip start.
- SOS safety alert foundation for active assigned/started rides.
- Cancellation reasons and eligible accepted-ride fine warnings.
- Active, scheduled, completed, and cancelled ride history.
- Fare/payment state visibility and completed-ride rating support.

### Rider Experience

- Online/offline availability and persisted foreground GPS tracking.
- Verified active vehicle switching across Bike, Auto, and Car.
- Desktop rider home with Ready Jobs, Demand Signals, and On-The-Way route visible together.
- Mobile rider work panels with map-first collapsed/expanded behavior.
- Ready and scheduled demand signals with map markers and request summaries.
- Demand cards and popups include fare, rider earning, rate, passenger context, pickup, drop, and schedule details.
- Ride acceptance, customer coordination, code verification, and phase-aware navigation.
- Accepted-ride cancellation before trip start.
- Fare, 7% Taxiro share, 93% rider earning, payment method, and pickup-note visibility.
- Reached-drop and payment-confirmation controls before ride completion.
- UPI ID and QR image profile settings plus cash collection guidance.
- Per-vehicle Bike/Auto/Car licence and registration verification, job history, support, rules, and account settings.

### Admin And Operations

- Redesigned command-center admin dashboard.
- Live operations hero with active trips, ready signals, verification queue, gross fare, Taxiro share, and rider earnings.
- Sticky section navigation for Overview, Command, Verification, People, and Rides.
- User/rider/ride counts, active rider visibility, scheduled demand, guest-booking, peak-rate, awaiting-payment, and suspended-account stats.
- Broadcast notification center with audience targeting for all accounts, users, or riders.
- Safety command center for SOS, delayed-trip, and route-change alerts with acknowledge/resolve actions.
- People control for account suspension and reactivation.
- Rider identity and per-vehicle verification review with live selfie preview.
- Ride search by ride ID, pickup, drop, passenger name, passenger phone, or vehicle type.
- Ride status filtering and responsive ride audit cards.
- Realtime subscriptions for operational data.

### Realtime, Maps, And Tracking

- Supabase Realtime subscriptions for rides, codes, rider locations, chat, admin data, rider profiles, and ride detail updates.
- Browser reconnect and tab-visibility resync behavior.
- Leaflet maps, OpenStreetMap tiles, Nominatim geocoding, and OSRM route distance/ETA.
- GPS accuracy, heading, speed, last-seen, route freshness, and stale-location states.
- Precise-fix progress, weak-fix rejection, movement filtering, write throttling, and rider tracking heartbeats.
- Desktop side panels can collapse sideways; mobile sheets can pull down to reveal map and pull up to restore controls.
- Accidental page zoom is guarded and Leaflet scroll-wheel zoom is disabled for embedded maps.

### Production SEO, Icons, And Discovery

- App icon source from `public/App Icon.jpeg` is now used for favicon, Apple icon, web app icons, PWA icons, and Microsoft tile icons.
- Generated `public/og/taxiro-og.png` for Open Graph and Twitter sharing.
- Added Next.js metadata for canonical URL, keywords, app icons, Apple web app mode, Open Graph, Twitter card, and India/Hyderabad geo tags.
- Added JSON-LD structured data for Organization, WebApplication, and Service.
- Added `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/humans.txt`, and `/browserconfig.xml`.
- Added `NEXT_PUBLIC_SITE_URL` to `.env.example` so deployed canonical and sitemap URLs can point to the final production domain.

### Safety, Policy, And Support

- Structured cancellation reasons and event history.
- Rs 50 accepted-ride cancellation fine from the user's 3rd cancellation onward.
- Safety alert tables and client helpers for SOS, late-trip, and route-change alert scenarios.
- In-app emergency-contact notification foundation using matching Taxiro profile phone numbers.
- About, Help and Support, Privacy Policy, and Rules and Regulations pages.
- Role-aware menus and support guidance.
- Supabase RLS and role-controlled RPC access.

## June 30 Enhancements

- Added timed ready-signal fields and expiry logic.
- Added safety-alert and app-notification database foundations.
- Added exact distance/peak fare logic: Rs 7/km standard and Rs 8/km during configured peak windows.
- Added `fare_rate_per_km` and `fare_pricing_period` to ride records.
- Added `booking_for`, `passenger_name`, and `passenger_phone` to ride records.
- Added user booking UI requiring either Myself or Someone else.
- Added guest-passenger validation and prevented device GPS detection for someone-else bookings.
- Added responsive side/collapsible ride sheet behavior for desktop and mobile.
- Added realtime updates to `/rides/[id]`.
- Added passenger/fare-rate/payment split context to ride details and shared ride cards.
- Added passenger/fare-rate context to rider demand cards and map popups.
- Added admin search for passenger name/phone plus guest-booking and peak-rate stats.
- Updated Help and Privacy content for peak pricing and passenger data handling.
- Added production SEO, PWA icon, social sharing, geo metadata, and LLM discovery files.
- Repaired Ready/Cancel action failures by adding `ride_status_events.actor_id` and redeploying compatible RPCs.
- Added `rider_vehicles`, active verified vehicle switching, and vehicle-aware rider matching.
- Added signup/profile validation for user, rider, passenger, UPI, licence, and vehicle details.

## June 30 Database Additions

- `20260630093000_signal_expiry_and_safety_alerts.sql`
  - Ready signal duration and expiry fields.
  - Updated ready/accept/expiry RPC behavior.
  - Safety alert and app notification tables.
  - Safety alert creation RPC and RLS policies.
- `20260630130000_distance_pricing_and_passenger_details.sql`
  - Fare rate and pricing period fields.
  - Booking-for and passenger contact fields.
  - Additive constraints and comments.
  - Backfill for self bookings from profiles where possible.
- `20260630190000_vehicle_matching_and_action_schema_repair.sql`
  - Missing `ride_status_events.actor_id` repair.
  - Bike/Auto/Car ride vehicle fields and validation.
  - `rider_vehicles` table and per-vehicle verification policies.
  - Verified-only active rider vehicle switching.
  - Vehicle-aware ready ride acceptance.

All June 30 migrations are additive and preserve existing tables and data.


## July 1 Enhancements

- Rebuilt the admin dashboard into a professional command-center layout.
- Added a dark operations hero with live platform health, active trips, ready signals, verification queue, gross fare, Taxiro share, and rider earnings.
- Added a sticky admin navigation bar for faster movement between command sections.
- Redesigned KPI cards for customers, riders, online riders, scheduled rides, awaiting payment, guest rides, peak-rate rides, and suspended accounts.
- Added a platform snapshot panel for active ride load, ready demand, online supply, verification queue, total accounts, and latest ride context.
- Redesigned the admin notification center into a broadcast console with audience selection, delivery feedback, and recent broadcast history.
- Redesigned the admin safety center with urgent alert cards, open/active counts, delivery status, coordinates, acknowledge, and resolve actions.
- Improved people management with clearer account status and Suspend/Activate controls.
- Improved rider verification with identity/vehicle review sections, pending counts, live selfie preview, and clear status badges.
- Improved ride operations with a dispatch/audit header, search, status filter, and responsive ride-card grid.
## Current Status And Known Blocker

The June 29, June 30, July 1, and July 2 application code is present locally. The June 30 ready/safety, fare/passenger, Ready/Cancel repair, and vehicle-matching migrations have been applied to remote Supabase. Remote verification confirmed the required fields, `ride_status_events.actor_id`, `rider_vehicles`, and key RPCs. The July 1 admin command-center upgrade is a frontend/admin UX upgrade on top of the existing Supabase-backed operations data.

The application is stronger as a realistic MVP, but it is not yet ready for unrestricted daily production use. Multi-device lifecycle testing, security review, automated E2E coverage, production notifications, support operations, and payment/legal compliance work remain necessary.

## Verification

Completed through 02 July 2026:

- `npx tsc --noEmit` passed.
- Focused ESLint for changed user/rider/admin/ride-detail/map/demand/fare files passed.
- `npm run build` passed on Next.js 16.2.7.
- Focused July 1 ESLint for `src/app/dashboard/admin/page.tsx`, `src/components/AdminNotificationCenter.tsx`, and `src/components/AdminSafetyCenter.tsx` passed.
- All 17 application routes compiled/generated successfully.
- Fare boundary checks passed for standard and peak windows.
- `git diff --check` passed after formatting cleanup.
- Metadata route type validation passed for manifest, robots, sitemap, and global metadata.
- Earlier route smoke checks, Supabase Realtime publication verification, Git secret-tracking cleanup, and dependency audit checks remain recorded from prior sessions.

Pending for the July 2 release candidate:

- Complete deployed two-account/two-device QA with the remote schema now applied.
- Verify UPI Storage upload and access policies.
- Run a complete ride on separate authenticated user and rider devices.
- Verify ready signal expiry, passenger booking, realtime tracking, chat, code, payment, completion, cancellation fines, and SOS alerts without manual refresh.
- Validate responsive behavior, denied GPS permission, weak GPS, offline/reconnect, and slow-network cases.

## Immediate Next Steps

1. Complete two-device user/rider lifecycle testing against the updated remote Supabase schema.
2. Verify Ready, Cancel, rider pre-code cancellation, Bike/Auto/Car matching, and vehicle verification from real accounts.
3. Validate fare rate boundaries and admin financial totals on live data.
4. Run final responsive browser QA across small mobile, tablet, laptop, and desktop sizes.
5. Add automated E2E coverage and production monitoring before public launch.

## July 2 Enhancements

- Fixed user side-menu My Rides navigation during active trips.
- Forced the responsive ride sheet open when switching between ride history and the live trip.
- Added a Back to live trip action from history.
- Added geolocation=(self) Permissions-Policy for production responses.
- Improved installed Chrome/Safari PWA location requests and permission guidance.
- Removed stale cached-position fallback from current-location detection.
- Enabled user current-location refresh while a trip is active.
- Repositioned the live rider tracking pill below iPhone safe-area/header controls.
- Added explicit Ready demand and Advance demand labels to map signals.
- Kept assigned rider Bike, Auto, and Car map markers phase-aware and live.
- Added real rider reputation synchronization from completed rides and submitted ratings.
- Replaced synthetic 5.0 rating behavior with New rider for unrated riders.
- Applied migration 20260702153000_real_rider_reputation_stats.sql to remote Supabase.
- Verified 5 completed rides, zero count mismatches, and active ride/rating synchronization triggers.

## July 2 Verification

- TypeScript passed.
- Focused ESLint passed.
- Git diff validation passed.
- Production build passed on Next.js 16.2.7.
- All 17 routes compiled successfully.
- Production home response returned HTTP 200.
- Geolocation Permissions-Policy and standalone PWA manifest checks passed.
- Live Supabase rider-stat consistency and trigger checks passed.

## Status After July 2

Taxiro now has clearer demand-map semantics, truthful rider reputation data, a working active-trip-to-history navigation path, and stronger installed-web-app location behavior. The remaining production gap is primarily field reliability: authenticated two-device testing, native/background tracking, external push/SMS escalation, payment operations, observability, automated E2E coverage, and formal security/compliance review.
