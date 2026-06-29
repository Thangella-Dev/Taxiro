# Taxiro Daily Development Update - 29 June 2026

## Summary

Today’s work focused on completing Taxiro’s fare, rider earnings, payment collection, cancellation policy, information pages, booking UX, demand visibility, realtime recovery, and GPS accuracy foundations.

## Completed Today

- Completed the application rename to **Taxiro** across package metadata, UI content, routes, documentation, and database comments.
- Added distance-based fare estimates that are locked into each ride when booked.
- Added a transparent fare split: **7% Taxiro company commission** and **93% rider earning**.
- Added fare, company share, rider earning, payment method, and payment status fields to the app data model.
- Added fare and payment information to user booking, rider requests, active rides, ride details, ride history, demand signals, and the admin dashboard.
- Added rider UPI ID and UPI QR image setup in rider account settings.
- Added the `rider-upi-qr` Supabase Storage bucket and rider-owned upload policies in an additive migration.
- Added the drop-off payment lifecycle: rider reaches drop, payment becomes awaiting payment, rider collects cash/UPI, rider confirms payment, and the ride completes.
- Added user-facing payment guidance and rider-facing UPI QR/cash collection controls.
- Added a cancellation fine policy for accepted rides: from the user’s 3rd cancellation onward, cancelling after rider acceptance records a **Rs 50 fine**.
- Added cancellation fee fields, cancellation actor tracking, fine reason storage, ride event logging, and UI warnings.
- Added About Taxiro, Help and Support, Privacy Policy, and Rules and Regulations pages.
- Added links to policy/support pages in user and rider menus.
- Improved location search behavior, map selection, demand/request cards, booking controls, and realtime resync behavior.
- Improved foreground GPS accuracy handling with precise-fix progress, weak-location rejection, permission-specific errors, movement filtering, reduced database writes, and rider heartbeat updates.
- Corrected the role-specific payment experience: the user is instructed to pay the rider, while the rider displays the configured UPI QR or cash guidance and confirms receipt before completing the ride.
- Improved pickup and drop selection with a fixed center pointer so the map position under the pointer becomes the selected location after confirmation.
- Improved typed location search so matching suggestions appear while the user types, without requiring Enter or a separate Go action first.
- Fixed the rider location refresh control, which previously saved the old coordinates again; it now requests a new high-accuracy device location.
- Updated user GPS detection to wait up to 30 seconds for a better fix, target approximately 25 m accuracy, and reject pickup fixes worse than 75 m instead of silently accepting readings such as +/-178 m.
- Updated live rider tracking to reject very weak readings, filter sudden accuracy regressions, publish movement updates at controlled intervals, and retain a periodic heartbeat without writing every browser GPS callback to Supabase.
- Cleared all existing ride-related history from the live Supabase project as requested while retaining authentication accounts, profiles, the rider profile, and the current rider-location record.
- Completed an application compatibility, security, and performance review covering frontend checks, dependency security, map/geocoding usage, realtime behavior, route requests, GPS write frequency, and Supabase access policies.
- Updated the consolidated Supabase schema and TypeScript database types.
- Created these additive migrations without deleting existing tables or ride data:
  - `20260629093000_taxiro_fare_payment_flow.sql`
  - `20260629113000_accepted_ride_cancellation_fine.sql`

## Current Database Status

### Live Ride-History Reset

The requested live ride-history cleanup was completed separately from the additive migrations. Before cleanup, the database contained 15 ride requests, 8 chat messages, 15 confirmation-code rows, 50 status-event rows, 5 rider-route rows, and 0 rating rows. After cleanup, all six ride-related collections contain 0 rows. User accounts, 5 profiles, 1 rider profile, and 1 current rider-location row were preserved.

The June 29 migrations are complete in the local repository but have not yet been confirmed as applied to the remote Supabase project.

The rider profile error `Could not find the 'upi_id' column of 'rider_profiles' in the schema cache` confirms that the remote database still needs the fare/payment migration, followed by a PostgREST schema reload.

Until that is completed, rider UPI profile saving, QR upload, payment completion, and cancellation-fine behavior cannot be considered live-verified.

## Verification Status

- `npx tsc --noEmit`: passed against the current code.
- Focused ESLint for the user dashboard, rider dashboard, and tracking helper: passed.
- `npm run build`: passed on Next.js 16.2.7.
- All 12 application routes compiled/generated successfully.
- Full project ESLint and `npx tsc --noEmit` passed after the final user/rider GPS changes.
- `npm audit` reported 0 known dependency vulnerabilities during the compatibility review.
- Final `git diff --check` passed for the GPS implementation.
- The SQL changes are additive and use `if not exists` safeguards where applicable.
- No destructive database commands were added.
- Remote migration application and two-account end-to-end payment testing remain pending.

## Next Steps

1. Apply both June 29 SQL migrations in the Supabase SQL Editor in timestamp order.
2. Run `notify pgrst, 'reload schema';` and verify `rider_profiles.upi_id` and `upi_qr_image_url`.
3. Verify the `rider-upi-qr` Storage bucket and upload policies.
4. Test a complete user/rider ride with fare agreement, code verification, destination tracking, UPI/cash collection, payment confirmation, and completion.
5. Test the 1st, 2nd, and 3rd accepted-ride user cancellation cases and verify the Rs 50 fine only applies to the eligible 3rd-or-later case.
6. Run final responsive browser and two-device realtime checks after the remote migrations are applied.
7. Replace public client-side Nominatim autocomplete with a policy-compliant geocoding setup before production-scale use, keep OpenStreetMap attribution visible, reduce duplicate OSRM route calls, and review live RLS policies before public launch.

## Overall Status

Taxiro now has the local product and database foundation for transparent fares, rider earnings, rider UPI collection, payment-confirmed completion, and accepted-ride cancellation fines. The immediate blocker is applying and validating the new migrations in remote Supabase.
