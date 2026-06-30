# Taxiro Daily Development Update - 30 June 2026

## Summary

Today's work focused on making Taxiro feel closer to a real daily-use ride app: clearer rider work surfaces, timed demand visibility, safer active rides, peak-time fare rules, self/other passenger booking, responsive map-first panels, and more complete operational visibility.

## Completed Today

- Added timed ready-signal support so users can publish an I'm Ready signal for **15, 30, or 60 minutes**.
- Added ready-signal expiry fields and RPC support so expired ready rides can return to scheduled state instead of staying visible forever.
- Improved the rider home experience so desktop riders can see Ready Jobs, Demand Signals, and On-The-Way route work together instead of hunting through hidden sections.
- Added safety-alert foundations with `safety_alerts` and `app_notifications` tables for SOS, late-trip, and route-change alert scenarios.
- Added in-app SOS behavior and emergency-contact notification design for contacts whose phone number matches a Taxiro profile.
- Improved location handling with permission-aware current-location logic, clearer fallback messaging, GPS accuracy display, and manual map selection fallback.
- Added exact distance-based bike fare calculation:
  - **Rs 7/km** for normal time.
  - **Rs 8/km** during peak windows: 9:00 AM-10:30 AM, 5:00 PM-6:00 PM, and 10:00 PM-midnight IST.
- Locked fare rate and pricing period at ride booking time so user and rider see the same saved fare.
- Added booking-for selection so the user must choose **Myself** or **Someone else** before booking.
- For someone-else bookings, added passenger name/phone capture and disabled current-device pickup detection to avoid using the booker's location by mistake.
- Added passenger information to user active rides, rider active jobs, shared ride cards, ride detail pages, and admin/search workflows.
- Added a responsive Taxiro ride sheet component:
  - Desktop sheets can hide/show sideways with an arrow control.
  - Mobile sheets can collapse by dragging down to reveal more map and expand by pulling/tapping up.
- Improved accidental zoom behavior by keeping page zoom guarded and disabling Leaflet scroll-wheel zoom on embedded maps.
- Added realtime ride-detail updates so `/rides/[id]` reflects ride changes without manual refresh.
- Expanded ride detail payment visibility with fare rate, payment status, and rider-only Taxiro/rider earning split.
- Improved rider demand signals and map popups with passenger context, fare rate, customer fare, and rider earning.
- Improved admin operations with passenger-name/phone search, guest-booking stats, and peak-rate ride stats.
- Updated Help and Privacy pages to explain peak pricing and passenger information storage.
- Added an additive Supabase migration for fare rate, pricing period, booking-for, and passenger contact fields.
- Updated the consolidated Supabase schema and TypeScript database types.

## Files And Migrations Added Today

- `src/components/ResponsiveRideSheet.tsx`
- `supabase/migrations/20260630093000_signal_expiry_and_safety_alerts.sql`
- `supabase/migrations/20260630130000_distance_pricing_and_passenger_details.sql`

## Verification Status

- `npx tsc --noEmit`: passed.
- Focused ESLint for changed dashboard, ride detail, map, demand, ride card, fare, and responsive sheet files: passed.
- `npm run build`: passed on Next.js 16.2.7.
- `git diff --check`: passed after formatting cleanup.
- Fare boundary checks passed for standard, morning peak, evening peak, night peak, and boundary transition times.

## Current Database Status

The June 30 migrations are implemented locally and are additive only. They still need to be applied in Supabase before live testing the new ready-signal expiry, safety-alert, peak-pricing, booking-for, and passenger-contact fields.

If the remote Supabase project has not applied the June 29 and June 30 migrations, the app may show schema-cache errors for fields such as `upi_id`, `fare_rate_per_km`, `booking_for`, or safety/notification tables until the migrations are run and PostgREST reloads its schema.

## Next Steps

1. Apply the pending June 29 and June 30 migrations in Supabase SQL Editor in timestamp order.
2. Run `notify pgrst, 'reload schema';` after migration execution.
3. Test a complete two-account ride: book, ready signal, rider accept, live pickup tracking, code verification, destination tracking, payment, and completion.
4. Test ready-signal expiry for 15, 30, and 60 minute choices.
5. Test booking for someone else and confirm rider/admin views show passenger name and phone correctly.
6. Test SOS/safety notification flow with an emergency contact account whose phone matches the saved contact number.
7. Run mobile and desktop visual QA after the remote database is current.

## Overall Status

Taxiro is now stronger as a real ride-hailing MVP: pricing is clearer, rider demand is more actionable, ride detail views update live, desktop/mobile panels are more app-like, and passenger/safety foundations are in place. The main blocker remains applying the pending Supabase migrations and running real two-device QA.
