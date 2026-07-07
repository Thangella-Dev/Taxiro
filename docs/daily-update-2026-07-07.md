# Taxiro Daily Update - 07 July 2026

## Summary

Today focused on making Taxiro more operationally controlled and closer to pilot readiness. The work added service-area aware booking, configurable pricing foundations, suspicious rider-location anomaly reporting, and a new Admin Controls section for service areas, pricing rules, and fraud review.

## Completed Work

### Service area and pricing enforcement

- Added shared operational helpers for service-area checks, distance calculation, configured pricing, and GPS jump detection.
- Added optional service-area enforcement to user booking.
- If active service areas exist, Taxiro now verifies that pickup and destination are inside the same supported Taxiro service area before creating a ride.
- If service areas are not configured yet, the existing fallback fare flow continues to work.
- Added configured pricing support using `pricing_rules`.
- Ride bookings can now save matched `service_area_id` and `pricing_rule_id` for admin audit.
- Extended fare split calculation to support configurable company commission rates while keeping the default 7% Taxiro commission.

### Admin operational controls

- Added a new Admin Controls workspace inside `/dashboard/admin`.
- Admins can create service areas with center latitude, longitude, radius, active status, and supported Bike/Auto/Car vehicles.
- Admins can create pricing rules per service area and vehicle type.
- Admin pricing rules include base fare, per-km rate, per-minute rate, minimum fare, and company commission rate.
- Added a fare split preview for configured commission values.
- Added fraud signal review cards with evidence display and Review/Dismiss/Confirm actions.

### Location anomaly foundation

- Added rider tracking anomaly reporting for suspicious GPS jumps.
- Rider GPS jump evidence includes accuracy, elapsed time, expected movement allowance, and actual movement.
- Added additive Supabase RPCs for recording and reviewing fraud signals.
- Location anomaly records dedupe repeated signals to reduce admin noise.

### Database work

- Added additive migration `20260706100000_operational_enforcement_and_fraud.sql`.
- Added optional `service_area_id` and `pricing_rule_id` fields to `ride_requests`.
- Added `record_location_anomaly` RPC.
- Added `admin_review_fraud_signal` RPC.
- Added Realtime publication entries for service areas, pricing rules, and fraud signals where available.
- No destructive schema changes were added.


### Admin verification UI polish

- Fixed oversized rider identity images in the admin verification section.
- Replaced full-width selfie display with compact thumbnails.
- Added identity and vehicle verification counters.
- Split identity and vehicle review into cleaner scroll-contained queues.
- Improved vehicle review cards with registration, rider, active matching, rejection, and identity-before-vehicle status.
### Testing and verification

- Added unit tests for service area matching, destination rejection, configured fare calculation, and location jump detection.
- Full local check passed:
  - `npm run db:validate`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run perf:budget`
- Production dependency audit passed with zero vulnerabilities.

## Verification Details

- Supabase migration validation passed for 27 additive migrations.
- TypeScript passed.
- ESLint passed.
- Vitest passed: 3 test files and 11 tests.
- Next.js 16.2.7 production build passed.
- Build emitted 21 app routes.
- Performance budget passed with 34 chunks, 2,278,886 total JS bytes, and 355,987 bytes as the largest chunk.
- `npm audit --omit=dev` reported zero vulnerabilities.

## Deployment Notes

- The new migration is created locally and must be applied to Supabase before the Admin Controls service-area/pricing/fraud features work against production data.
- After migration, create at least one active service area and one pricing rule per active vehicle type before relying on configured fare enforcement.
- Continue two-device QA for user/rider booking, ready signal, rider acceptance, tracking, cancellation, payment completion, and SOS behavior.

## Next Work

- Apply the operational enforcement migration to staging/production Supabase.
- Validate Admin Controls with real admin account data.
- Add richer admin editing/deactivation for service areas and pricing rules.
- Continue decomposing large dashboard files into smaller feature components.
- Add authenticated E2E coverage for full user/rider lifecycle flows.

