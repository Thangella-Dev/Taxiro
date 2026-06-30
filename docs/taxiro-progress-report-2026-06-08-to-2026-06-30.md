# Taxiro Progress Report - 08 June 2026 to 30 June 2026

## Executive Summary

Taxiro is a map-first bike taxi web MVP for India built with Next.js, React, TypeScript, Tailwind CSS, Supabase, PostGIS, Leaflet, OpenStreetMap, Nominatim, and OSRM.

As of 30 June 2026, the local application supports authentication and role separation, ride-now and advance booking, self/other passenger booking, current-location/search/map selection, timed ready signals, rider availability, demand signals, ride acceptance, private confirmation codes, assigned chat, foreground GPS tracking, phase-aware pickup/drop routes, SOS safety-alert foundations, ride cancellation, ratings, distance/peak fare locking, rider earning splits, rider UPI setup, payment-confirmed completion, admin operations, and information/policy pages.

## Major Product Capabilities

### User Experience

- Supabase-backed signup, sign-in, profile, and role protection.
- Ride-now and advance-booking flows.
- Booking-for selection: customer can book for themselves or another passenger.
- Passenger name/phone capture for someone-else bookings.
- Pickup using GPS detection, search, or map selection; drop using search or map selection.
- Current-device detect is disabled for someone-else bookings to avoid incorrect pickup location.
- Route distance, ETA, fare estimate, fare rate, payment preference, and rider note before booking.
- Standard fare at Rs 7/km and peak fare at Rs 8/km for configured IST peak windows.
- Timed I'm Ready activation with 15, 30, and 60 minute signal duration choices.
- Rider assignment, private 4-digit code, live rider tracking, and assigned chat.
- Rider-to-pickup tracking before code verification and destination tracking after trip start.
- SOS safety alert foundation for active assigned/started rides.
- Cancellation reasons and eligible accepted-ride fine warnings.
- Active, scheduled, completed, and cancelled ride history.
- Fare/payment state visibility and completed-ride rating support.

### Rider Experience

- Online/offline availability and persisted foreground GPS tracking.
- Desktop rider home with Ready Jobs, Demand Signals, and On-The-Way route visible together.
- Mobile rider work panels with map-first collapsed/expanded behavior.
- Ready and scheduled demand signals with map markers and request summaries.
- Demand cards and popups include fare, rider earning, rate, passenger context, pickup, drop, and schedule details.
- Ride acceptance, customer coordination, code verification, and phase-aware navigation.
- Accepted-ride cancellation before trip start.
- Fare, 7% Taxiro share, 93% rider earning, payment method, and pickup-note visibility.
- Reached-drop and payment-confirmation controls before ride completion.
- UPI ID and QR image profile settings plus cash collection guidance.
- Vehicle/licence verification foundation, job history, support, rules, and account settings.

### Admin And Operations

- User/rider/ride counts, active rider visibility, and demand overview.
- Ride search by ride ID, pickup, drop, passenger name, or passenger phone.
- Ride status filtering.
- Guest-booking and peak-rate ride stats.
- Rider verification review.
- Gross fare, Taxiro commission, rider earnings, awaiting-payment, and paid summaries.
- Realtime subscriptions for operational data.

### Realtime, Maps, And Tracking

- Supabase Realtime subscriptions for rides, codes, rider locations, chat, admin data, rider profiles, and ride detail updates.
- Browser reconnect and tab-visibility resync behavior.
- Leaflet maps, OpenStreetMap tiles, Nominatim geocoding, and OSRM route distance/ETA.
- GPS accuracy, heading, speed, last-seen, route freshness, and stale-location states.
- Precise-fix progress, weak-fix rejection, movement filtering, write throttling, and rider tracking heartbeats.
- Desktop side panels can collapse sideways; mobile sheets can pull down to reveal map and pull up to restore controls.
- Accidental page zoom is guarded and Leaflet scroll-wheel zoom is disabled for embedded maps.

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

Both migrations are additive and preserve existing tables and data.

## Current Status And Known Blocker

The June 29 and June 30 application code and migrations are present locally. They still need to be applied to remote Supabase before the newest payment, UPI, ready-signal expiry, safety-alert, peak-pricing, and passenger-booking behavior can be live-verified.

The application is stronger as a realistic MVP, but it is not yet ready for unrestricted daily production use. Remote migration, multi-device lifecycle testing, security review, automated E2E coverage, production notifications, support operations, and payment/legal compliance work remain necessary.

## Verification

Completed through 30 June 2026:

- `npx tsc --noEmit` passed.
- Focused ESLint for changed user/rider/admin/ride-detail/map/demand/fare files passed.
- `npm run build` passed on Next.js 16.2.7.
- All 12 application routes compiled/generated successfully.
- Fare boundary checks passed for standard and peak windows.
- `git diff --check` passed after formatting cleanup.
- Earlier route smoke checks, Supabase Realtime publication verification, Git secret-tracking cleanup, and dependency audit checks remain recorded from prior sessions.

Pending for the June 30 release candidate:

- Apply pending migrations remotely and reload PostgREST schema.
- Verify UPI Storage upload and access policies.
- Run a complete ride on separate authenticated user and rider devices.
- Verify ready signal expiry, passenger booking, realtime tracking, chat, code, payment, completion, cancellation fines, and SOS alerts without manual refresh.
- Validate responsive behavior, denied GPS permission, weak GPS, offline/reconnect, and slow-network cases.

## Immediate Next Steps

1. Apply the June 29 and June 30 migrations to remote Supabase in timestamp order.
2. Resolve and verify schema-cache access for `upi_id`, `fare_rate_per_km`, `booking_for`, safety alerts, and app notifications.
3. Complete two-device user/rider lifecycle testing.
4. Validate fare rate boundaries and admin financial totals.
5. Run final responsive browser QA across small mobile, tablet, laptop, and desktop sizes.
6. Add automated E2E coverage and production monitoring before public launch.
