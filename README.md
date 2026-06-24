# Taxidi - Predictive Bike Taxi MVP

**Taxidi** means **journey/trip** in Greek. Taxidi is a bike taxi web app MVP for India focused on scheduled demand, rider readiness, map-first booking, secure ride confirmation, and real Supabase-backed ride data.

The project is built as a free/open-stack MVP using Supabase, OpenStreetMap, Leaflet, Nominatim, and OSRM. It intentionally avoids paid map/payment APIs during this stage.

## Product Vision

Taxidi is designed around a practical ride-hailing flow:

1. A user creates an account.
2. The user books a ride now or schedules an advance booking.
3. The user selects pickup/drop through search, current location, or map selection.
4. The user taps **I'm Ready** when actually ready to travel.
5. Riders who are online can accept ready rides.
6. The user shares a private 4-digit confirmation code.
7. The rider verifies the code and starts the ride.
8. The rider completes the ride at drop-off.

This approach is intended to reduce fake demand and make scheduled ride demand more useful for riders.

## Current Status

The MVP currently includes:

- Real Supabase sign up and sign in.
- User/rider/admin role separation.
- User ride booking.
- Ride now and advance booking modes.
- Pickup/drop search with Nominatim.
- Pickup current-location detection.
- Pickup/drop map selection.
- Focused map-only selection mode.
- Scheduled ride creation.
- **I'm Ready** ride activation.
- Rider online/offline availability.
- Rider location update.
- Rider ride acceptance.
- Private ride confirmation code with repair fallback if the code row is missing or not returned.
- Ride start and completion.
- Ride cancellation for scheduled, ready, and accepted-before-start rides with structured cancellation reasons.
- User menu with profile, rides, settings, about, help/support, and sign out.
- Admin monitoring dashboard with ride search, status filters, and rider verification controls.
- Assigned-ride chat between user and rider.
- Rider map demand markers for scheduled and ready ride pickup signals.
- Fare estimate, distance, ETA, payment preference, and pickup note capture before booking.
- Completed-ride rating and feedback capture.
- Rider vehicle identity, licence details, verification status, rating, and completed-rides foundation.
- Mobile compatibility improvements across the main app surfaces, including corrected vertical flow and side-scroll prevention.
- OSRM route polylines with automatic map fitting.
- Editable user and rider profile settings.
- Rider account menu with history, safety guidance, support, and sign out.
- Foreground rider GPS tracking with Supabase persistence and Realtime customer updates.
- Rider GPS accuracy, heading, speed, last-seen time, and freshness status.
- Phase-aware routing: rider-to-pickup before code verification and rider-to-drop after trip start.
- Live route ETA and distance for the current ride phase.
- Role-aware and ride-phase-aware user/rider chat quick messages.
- Urgency-based rider demand signals for ready-now and scheduled rides.
- Mobile map-first layouts with vertical-only document scrolling, device-width-safe sheets, and corrected rider empty-space behavior.
- Accidental page zoom and iPhone input-focus zoom prevention.
- Compact user booking flow with duplicate-label cleanup, expandable pickup note, low-GPS-accuracy warning, and sticky booking action.
- Compact rider workflow with expandable On-The-Way route setup.

## Main Routes

- Landing page: `/`
- Auth: `/auth`
- User app: `/dashboard/user`
- Rider app: `/dashboard/rider`
- Admin dashboard: `/dashboard/admin`
- Ride details: `/rides/[id]`

## Tech Stack

Frontend:

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Local shadcn-style UI primitives
- Lucide React icons
- Leaflet
- React Leaflet

Backend and database:

- Supabase Auth
- Supabase PostgreSQL
- PostGIS
- Row Level Security
- SQL migrations
- SQL triggers
- Supabase RPC functions

Maps and routing:

- OpenStreetMap tiles
- Nominatim public API for location search/geocoding
- OSRM public API for distance and ETA
- OpenStreetMap directions links for rider navigation

Deployment target:

- Vercel free/hobby deployment
- Supabase free tier

Not used in this MVP:

- Google Maps
- Mapbox
- Stripe/payment flow
- Firebase paid services
- Frontend service-role Supabase key

## User App

Route: `/dashboard/user`

Implemented:

- Role-protected user dashboard.
- Map-first booking screen.
- Ride now and advance booking modes.
- Pickup via search, current location, or map selection.
- Drop via search or map selection.
- Focused map-only choose-on-map mode.
- Scheduled ride creation.
- **I'm Ready** activation.
- Assigned rider visibility with live Supabase Realtime location updates.
- Private 4-digit confirmation code display with fallback RPC repair.
- Active ride progress with rider freshness, GPS accuracy, phase-aware route, ETA, and distance.
- Ride cancellation for scheduled, ready, and assigned-before-start rides with reason capture.
- Assigned-ride chat with the rider.
- Ride history sections:
  - Active rides
  - Upcoming / advance bookings
  - Completed / cancelled history
- Fare estimate, payment preference, and rider pickup note before confirming.
- Completed ride rating from the ride detail screen.
- Ride detail screen also shows private code and chat for assigned/started rides.
- User menu:
  - Profile
  - My rides
  - Settings
  - About Taxidi
  - Help and support
  - Sign out

## Rider App

Route: `/dashboard/rider`

Implemented:

- Role-protected rider dashboard.
- Rider online/offline availability.
- Foreground rider GPS tracking with map-click/manual refresh fallback.
- Ready ride request queue.
- Map demand signals for scheduled and ready pickups.
- Ride acceptance.
- Pickup/drop navigation links.
- Confirmation code entry.
- Ride start after successful code verification.
- Ride completion after drop-off.
- Accepted ride cancellation before trip start when a rider cannot continue.
- Assigned-ride chat with the user.
- Fare/payment/pickup-note visibility on ready ride cards.
- Rider vehicle identity form and verification status inside the account menu.
- Demand signal and route setup sections.
- Mobile map-first layout with corrected vertical flow, compact active-job controls, and request cards.
- Rider account menu with editable profile and recent job history.
- Availability state synchronized with the persisted Supabase rider location record.

## Admin App

Route: `/dashboard/admin`

Implemented:

- Role-protected admin dashboard.
- User/rider count.
- Scheduled ride count.
- Active rider count.
- People list from Supabase profiles.
- All rides list with search and status filters.
- Demand overview card.
- Rider verification review for submitted vehicle and licence details.
- Responsive layout improvements.

## Database

Schema files:

- `supabase/schema.sql`
- `supabase/migrations/20260608112450_readyride_core_schema.sql`
- `supabase/migrations/20260608143000_rider_scheduled_visibility.sql`
- `supabase/migrations/20260608145500_rider_role_rls.sql`
- `supabase/migrations/20260608153000_ride_execution_flow.sql`
- `supabase/migrations/20260608154500_explicit_rider_acceptance.sql`
- `supabase/migrations/20260622123000_daily_use_hardening.sql`
- `supabase/migrations/20260622142000_ride_chat_and_code_repair.sql`
- `supabase/migrations/20260623093000_live_tracking_metadata.sql`

Main tables:

- `profiles`
- `ride_requests`
- `rider_locations`
- `rider_routes`
- `ride_status_events`
- `ride_confirmation_codes`
- `rider_profiles`
- `ride_ratings`
- `ride_chat_messages`

Important RPC/functions:

- `mark_ride_ready_and_assign`
- `accept_ready_ride`
- `verify_ride_code`
- `complete_ride`
- `cancel_ride`
- `get_or_create_ride_confirmation_code`
- `is_admin`
- `is_rider`

Security:

- PostGIS enabled.
- RLS enabled.
- Users access their own ride records.
- Riders access ready/assigned ride records.
- Ride codes are visible only to the booking user.
- Admin access is role controlled.
- Ride ratings are restricted to the relevant ride participants.
- Rider profile verification is admin-controlled.
- Ride chat messages are restricted to the assigned user/rider pair and admins.

## Environment Variables

Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NEXT_PUBLIC_OSRM_BASE_URL=https://router.project-osrm.org
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Type check:

```bash
npx tsc --noEmit
```

## Documentation

Project documentation:

- Daily update: `docs/daily-update-2026-06-08.md`
- Manager email update: `docs/manager-update-email-2026-06-08.md`
- Progress report through 12 June: `docs/taxidi-progress-report-2026-06-08-to-2026-06-12.md`
- Progress report through 22 June: `docs/taxidi-progress-report-2026-06-08-to-2026-06-22.md`
- Latest full progress report: `docs/taxidi-progress-report-2026-06-08-to-2026-06-23.md`
- Daily update for 22 June: `docs/daily-update-2026-06-22.md`
- Latest daily update: `docs/daily-update-2026-06-23.md`
- Manager email for 22 June: `docs/manager-update-email-2026-06-22.md`
- Latest manager email: `docs/manager-update-email-2026-06-23.md`

## Development Timeline

Monday - 08 June 2026:

- Project setup.
- Supabase connection.
- Database schema and migrations.
- PostGIS and RLS.
- Auth and role separation.
- Initial user, rider, and admin flows.

Wednesday - 10 June 2026:

- App rename/branding to Taxidi.
- Map-first UI improvements.
- Pickup/drop UX fixes.
- Current location support for pickup.
- Ride-now and advance-booking separation.
- Ride history organization.
- Rider execution flow polish.

Friday - 12 June 2026:

- Next.js config/version fix.
- Ride cancellation.
- Map-only choose-on-map mode.
- User menu.
- Mobile compatibility pass.
- Focused lint and TypeScript verification.
- Main README update.
- Daily update, manager email update, and formal progress report for Monday-Wednesday-Friday work.

Monday - 22 June 2026:

- Corrected the accidental Next.js 9 dependency mismatch and restored Next.js 16.2.7.
- Added OSRM route path rendering and map auto-fit for user, rider, and ride-detail views.
- Added editable profile settings backed by the Supabase profiles table.
- Added ride-detail navigation from ride cards.
- Added the rider account menu, recent job history, safety information, support, and sign out.
- Synchronized rider availability UI with persisted Supabase state.
- Added fare estimates, payment preference, rider pickup notes, structured cancellation reasons, completed-ride ratings, rider vehicle verification, and admin ride operations filters.
- Added rider-side accepted-ride cancellation before trip start.
- Added robust ride-code fallback, map demand markers for riders, assigned-ride chat between user and rider, and ride-detail code/chat visibility.
- Passed focused ESLint and TypeScript verification for the daily-use hardening pass.

Tuesday - 23 June 2026:

- Added foreground rider GPS tracking and Supabase Realtime customer tracking.
- Added rider-to-pickup and rider-to-drop phase-aware routing with live ETA and distance.
- Improved confirmation-code handling and phase-aware assigned-ride chat.
- Improved ready-now and scheduled-demand signals for riders.
- Applied the additive live-tracking metadata migration.
- Removed mobile horizontal scrolling and fixed the rider screen's empty vertical area.
- Redesigned user booking and rider work sheets for cleaner small-device operation.
- Added accidental zoom and iPhone input-focus zoom prevention.
- Passed TypeScript, focused ESLint, production build, and route smoke checks.
## Verification Status

Latest verification completed on 23 June 2026:

- npm run lint: passed.
- npx tsc --noEmit: passed.
- `npm run build`: passed on Next.js 16.2.7 after live tracking, phase-aware routing, mobile layout, and zoom-prevention updates.
- Focused `npx eslint` and `npx tsc --noEmit` checks passed after the June 23 live-tracking and mobile UX update.
- User and rider dashboard routes returned HTTP 200.
- Supabase live-tracking migration applied successfully.
- All application routes compiled successfully.

Pending manual QA:

- Full browser/mobile visual QA with authenticated user and rider accounts.
- End-to-end ride test using two real accounts and live location permissions.
- Supabase Realtime verification across two browser sessions.

## Local Environment Status

The disk-space blocker remains resolved. The environment had sufficient space for repeated TypeScript, ESLint, and production builds on 23 June 2026.

Current framework versions:

- Next.js 16.2.7
- React 19.2.4
- React DOM 19.2.4

## Next To Do

High priority:

- Perform full responsive browser QA.
- Test the complete user-to-rider lifecycle with real accounts.
- Test live rider-to-pickup and rider-to-drop tracking on two real devices.
- Extend admin operational ride controls beyond search/filter/verification.
- Add loading skeletons, reconnect handling, and stronger network error recovery.

Medium priority:

- Persist notification and location preferences.
- Add a rider daily activity summary.
- Improve demand signals, route relevance, and active-trip refresh reliability.
- Add consistent empty, loading, and retry states.

Future scope:

- Push notifications.
- In-app chat/call masking.
- Payment flow.
- Production-grade geocoding/routing provider.
- Native mobile wrapper.










