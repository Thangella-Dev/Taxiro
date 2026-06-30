# Taxiro Progress Report - 08 June 2026 to 29 June 2026

> Note: This report is preserved as the 29 June snapshot. The latest full progress report is `docs/taxiro-progress-report-2026-06-08-to-2026-06-30.md`.

## Executive Summary

Taxiro is a map-first bike taxi web MVP for India built with Next.js, React, TypeScript, Tailwind CSS, Supabase, PostGIS, Leaflet, OpenStreetMap, Nominatim, and OSRM.

As of 29 June 2026, the local application supports real authentication and role separation, on-demand and advance booking, current-location/search/map selection, rider availability, demand signals, ride acceptance, private confirmation codes, assigned chat, foreground GPS tracking, phase-aware pickup/drop routes, ride cancellation, ratings, fare and rider earning splits, rider UPI setup, payment-confirmed completion, admin operations, and information/policy pages.

## Major Product Capabilities

### User Experience

- Supabase-backed signup, sign-in, profile, and role protection.
- Ride-now and advance-booking flows.
- Pickup using GPS detection, search, or map selection; drop using search or map selection.
- Route distance, ETA, fare estimate, payment preference, and rider note before booking.
- I’m Ready activation, rider assignment, private 4-digit code, live rider tracking, and assigned chat.
- Rider-to-pickup tracking before code verification and destination tracking after trip start.
- Cancellation reasons and eligible accepted-ride fine warnings.
- Active, scheduled, completed, and cancelled ride history.
- Fare/payment state visibility and completed-ride rating support.

### Rider Experience

- Online/offline availability and persisted foreground GPS tracking.
- Ready and scheduled demand signals with map markers and request summaries.
- Ride acceptance, customer coordination, code verification, and phase-aware navigation.
- Accepted-ride cancellation before trip start.
- Fare, 7% Taxiro share, 93% rider earning, payment method, and pickup-note visibility.
- Reached-drop and payment-confirmation controls before ride completion.
- UPI ID and QR image profile settings plus cash collection guidance.
- Vehicle/licence verification foundation, job history, support, rules, and account settings.

### Admin And Operations

- User/rider/ride counts, active rider visibility, and demand overview.
- Ride search and status filtering.
- Rider verification review.
- Gross fare, Taxiro commission, rider earnings, awaiting-payment, and paid summaries.
- Realtime subscriptions for operational data.

### Realtime, Maps, And Tracking

- Supabase Realtime subscriptions for rides, codes, rider locations, chat, admin data, and rider profiles.
- Browser reconnect and tab-visibility resync behavior.
- Leaflet maps, OpenStreetMap tiles, Nominatim geocoding, and OSRM route distance/ETA.
- GPS accuracy, heading, speed, last-seen, route freshness, and stale-location states.
- Precise-fix progress, weak-fix rejection, movement filtering, write throttling, and rider tracking heartbeats.

### Safety, Policy, And Support

- Structured cancellation reasons and event history.
- Rs 50 accepted-ride cancellation fine from the user’s 3rd cancellation onward.
- About, Help and Support, Privacy Policy, and Rules and Regulations pages.
- Role-aware menus and support guidance.
- Supabase RLS and role-controlled RPC access.

## June 29 Chat Session Enhancements And Maintenance

- Corrected the payment handoff: payment instructions are shown to the user, while the rider presents the configured UPI QR or cash option and confirms payment receipt.
- Added real-world map placement behavior using a fixed center pointer for pickup and drop confirmation.
- Made location search suggestions appear during typing instead of waiting for Enter or a separate Go action.
- Strengthened current-location acquisition for both roles with a 30-second high-accuracy window, approximately 25 m target accuracy, permission-specific errors, and rejection of user pickup fixes worse than 75 m.
- Fixed the rider refresh action so it obtains a fresh device fix rather than persisting stale coordinates.
- Stabilized live rider tracking by rejecting readings worse than 100 m, filtering sudden accuracy regressions, throttling movement writes, and preserving a periodic live heartbeat.
- Cleared live operational ride history on request: 15 rides, 8 chat messages, 15 confirmation-code rows, 50 status events, and 5 rider routes were removed; ratings were already empty. All these ride-related collections now contain 0 rows.
- Preserved authentication accounts, 5 profiles, 1 rider profile, and 1 current rider-location row during the cleanup.
- Reviewed application compatibility and performance. Full ESLint, TypeScript, and production builds passed, and the dependency audit found 0 known vulnerabilities.
- Recorded production follow-ups: policy-compliant geocoding/autocomplete, visible OpenStreetMap attribution, fewer duplicate OSRM requests, reduced redundant polling alongside realtime subscriptions, and stronger live RLS policy review.

## June 29 Database Additions

- `20260629093000_taxiro_fare_payment_flow.sql`
  - Company commission and rider earning fields.
  - Payment status and payment confirmation fields.
  - Rider UPI ID and QR image URL.
  - `rider-upi-qr` Storage bucket and rider-owned upload policies.
  - Reached-drop and payment-confirmed completion RPCs.
- `20260629113000_accepted_ride_cancellation_fine.sql`
  - Cancellation fee, reason, and actor fields.
  - Updated cancellation RPC with the 3rd-or-later accepted-ride fine rule.
  - Rider availability restoration and cancellation event logging.

Both migrations are additive and preserve existing tables and data.

## Current Status And Known Blocker

The June 29 application code and migrations are present locally. They have not yet been confirmed as applied to remote Supabase. The `upi_id` schema-cache error in rider profile setup is evidence that the remote migration is still pending.

The application is a strong MVP foundation but is not yet ready for unrestricted daily production use. Remote migration, multi-device lifecycle testing, security review, automated E2E coverage, notification delivery, production support operations, and payment/legal compliance work remain necessary.

## Verification

Completed through 29 June 2026:

- Current `npx tsc --noEmit` check passed.
- Focused ESLint for user dashboard, rider dashboard, and tracking helpers passed.
- Current Next.js 16.2.7 production build passed.
- All 12 application routes compiled/generated successfully.
- Route smoke checks.
- Supabase Realtime publication verification.
- Git secret-tracking cleanup checks.
- Live ride-history reset with account/profile preservation.
- Full-project ESLint and TypeScript verification after the final user/rider GPS update.
- Dependency security audit with 0 known vulnerabilities.

Pending for the June 29 release candidate:

- Apply both new migrations remotely and reload PostgREST schema.
- Verify UPI Storage upload and access policies.
- Run a complete ride on separate authenticated user and rider devices.
- Verify realtime tracking, chat, code, payment, completion, and cancellation fines without manual refresh.
- Validate responsive behavior, denied GPS permission, weak GPS, offline/reconnect, and slow-network cases.
- Resolve the geocoding usage-policy, map attribution, duplicate routing, polling/realtime overlap, and RLS findings before unrestricted production use.

## Immediate Next Steps

1. Apply the June 29 migrations to remote Supabase in timestamp order.
2. Resolve and verify the rider `upi_id`/`upi_qr_image_url` schema cache.
3. Complete the two-device user/rider payment lifecycle test.
4. Validate the cancellation-fine rules and admin financial totals.
5. Run final static checks, production build, and responsive browser QA.
6. Add automated E2E coverage and production monitoring before public launch.
