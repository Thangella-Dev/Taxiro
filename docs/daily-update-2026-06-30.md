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
- Added production SEO, app icon, PWA, and AI discovery setup using `public/App Icon.jpeg` as the source image.
- Generated favicon, Apple icon, web app icons, social preview image, manifest, robots, sitemap, `llms.txt`, `llms-full.txt`, `humans.txt`, and browser tile config.
- Added canonical metadata, Open Graph, Twitter card metadata, Hyderabad geo tags, and JSON-LD structured data for Organization, WebApplication, and Service.

## Files And Migrations Added Today

- `src/components/ResponsiveRideSheet.tsx`
- `supabase/migrations/20260630093000_signal_expiry_and_safety_alerts.sql`
- `supabase/migrations/20260630130000_distance_pricing_and_passenger_details.sql`
- `supabase/migrations/20260630173000_repair_ready_and_cancel_actions.sql`
- `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`
- `public/llms.txt`, `public/llms-full.txt`, `public/humans.txt`, `public/browserconfig.xml`
- `public/icons/*`, `public/og/taxiro-og.png`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`

## Verification Status

- `npx tsc --noEmit`: passed.
- Focused ESLint for changed dashboard, ride detail, map, demand, ride card, fare, and responsive sheet files: passed.
- `npm run build`: passed on Next.js 16.2.7.
- `git diff --check`: passed after formatting cleanup.
- Fare boundary checks passed for standard, morning peak, evening peak, night peak, and boundary transition times.

## Current Database Status

The June 30 ready-signal/safety and distance-pricing/passenger migrations are now applied to the remote Supabase project. The ride-action compatibility repair is also deployed, and PostgREST was instructed to reload its schema.

Remote verification confirmed the required ready, fare, and passenger fields; `safety_alerts` and `app_notifications`; and the Ready, Cancel, and expiry RPCs. Real two-account/two-device ride QA remains the release gate.

## Next Steps

1. Test a complete two-account ride: book, ready signal, rider accept, live pickup tracking, code verification, destination tracking, payment, and completion.
2. Test both user cancellation and rider cancellation before confirmation-code verification.
3. Test ready-signal expiry for 15, 30, and 60 minute choices.
4. Test booking for someone else and confirm rider/admin views show passenger name and phone correctly.
5. Test SOS/safety notification flow with an emergency contact account whose phone matches the saved contact number.
6. Complete iOS Safari, Android Chrome, tablet, and desktop visual QA on the deployed Vercel build.

## Overall Status

Taxiro is now stronger as a real ride-hailing MVP: pricing is clearer, rider demand is more actionable, ride detail views update live, desktop/mobile panels are more app-like, and passenger/safety foundations are in place. The remaining release gate is real two-account/two-device QA and deployed-device visual validation.

## Late-Day Ride Action And Mobile Repair

- Investigated the live Supabase project and identified the exact **I'm Ready** failure: the remote project only exposed the older one-argument RPC while the app called the timed two-argument RPC.
- Applied the additive timed-ready/safety migration and distance-pricing/passenger migration to the remote Supabase project.
- Added and applied `20260630173000_repair_ready_and_cancel_actions.sql` to align Ready, expiry, and cancellation behavior.
- Verified remotely that ready-signal fields, fare/passenger fields, `safety_alerts`, `app_notifications`, and the required Ready/Cancel/expiry RPCs now exist.
- Added visible `Publishing...` state and clear success/error feedback to **I'm Ready**.
- Improved cancellation UX with `Cancelling...`, disabled duplicate submission, and inline database errors inside the dialog.
- Confirmed riders can release an accepted ride only before confirmation-code verification, and added rider-specific reasons for passenger, route, contact, vehicle, or safety issues.
- Moved the rider location status/control to the left on mobile so it no longer competes with Online and Menu controls.
- Added iPhone safe-area positioning to the public app header so it stays below the status bar/Dynamic Island.
- Re-ran TypeScript and focused ESLint successfully. A 430 x 932 Chrome mobile render returned HTTP 200 without a Next.js runtime error.

## Final Vehicle, Validation, And Ready/Cancel Repair

- Fixed the underlying Ready/Cancel database issue by adding the missing `ride_status_events.actor_id` column to the remote Supabase schema.
- Applied the additive vehicle matching migration to remote Supabase and verified the required columns, table, and RPCs are present.
- Added Bike, Auto, and Car selection for users before booking.
- Updated fare calculation so vehicle type changes the effective per-kilometre rate:
  - Bike: base rate.
  - Auto: base rate + Rs 1/km.
  - Car: base rate + Rs 2/km.
- Kept the same vehicle uplift during peak windows, so peak Bike is Rs 8/km, peak Auto is Rs 9/km, and peak Car is Rs 10/km.
- Added `rider_vehicles` for per-vehicle rider verification across Bike, Auto, and Car.
- Added rider active-vehicle switching, restricted to verified vehicles only.
- Updated ready-ride acceptance so riders can receive only rides that match their currently active verified vehicle.
- Added rider signup/profile vehicle fields for vehicle type, make, model, registration number, and driving licence.
- Added validation helpers for signup, signin, profile setup, passenger contact, UPI ID, vehicle details, and licence input.
- Updated admin vehicle verification so each rider vehicle can be verified or rejected separately.
- Fixed the rider GPS status UI spacing so the live GPS text no longer overlaps the Taxiro Rider header area.

Verification after this final pass:

- `npx tsc --noEmit`: passed.
- Focused ESLint across changed auth, user, rider, admin, ride-detail, component, validation, fare, and type files: passed.
- `npm run build`: passed.
- Remote Supabase check confirmed `ride_status_events.actor_id`, vehicle ride fields, `rider_profiles.active_vehicle_type`, `rider_vehicles`, and key Ready/Cancel/Accept/vehicle RPCs.