# Taxiro - Predictive Bike Taxi MVP

**Taxiro** means **journey/trip** in Greek. Taxiro is a bike taxi web app MVP for India focused on scheduled demand, rider readiness, map-first booking, secure ride confirmation, and real Supabase-backed ride data.

The project is built as a free/open-stack MVP using Supabase, OpenStreetMap, Leaflet, Nominatim, and OSRM. It intentionally avoids paid map/payment APIs during this stage.

## Product Vision

Taxiro is designed around a practical ride-hailing flow:

1. A user creates an account.
2. The user books a ride now or schedules an advance booking.
3. The user selects pickup/drop through search, current location, or map selection.
4. The user taps **I'm Ready** when actually ready to travel.
5. Riders who are online can accept ready rides.
6. The user shares a private 4-digit confirmation code.
7. The rider verifies the code and starts the ride.
8. The rider marks drop reached and collects payment.
9. The rider confirms payment received, then the ride is completed.

This approach is intended to reduce fake demand and make scheduled ride demand more useful for riders.

## Current Status

The MVP currently includes:

- Real Supabase sign up and sign in.
- User/rider/admin role separation.
- User ride booking.
- Booking for self or another passenger with passenger name/phone capture.
- Ride now and advance booking modes.
- Pickup/drop search with Nominatim.
- Pickup current-location detection.
- Pickup/drop map selection.
- Focused map-only selection mode.
- Scheduled ride creation.
- **I'm Ready** ride activation with 15/30/60-minute signals, in-button progress, and visible error feedback.
- Rider online/offline availability.
- Rider location update.
- Rider ride acceptance.
- Private ride confirmation code with repair fallback if the code row is missing or not returned.
- Ride start, drop-reached payment collection, and payment-confirmed completion.
- Ride cancellation for scheduled, ready, and accepted-before-start rides with progress/error feedback and rider-specific release reasons.
- Accepted-ride cancellation fine: from the 3rd user cancellation onward, cancelling after rider acceptance records a Rs 50 fine.
- User menu with profile, rides, settings, about, help/support, and sign out.
- Admin monitoring dashboard with ride search, status filters, rider verification controls, and revenue split stats.
- Assigned-ride chat between user and rider.
- Rider map demand markers for scheduled and ready ride pickup signals.
- Fare estimate, distance, ETA, payment preference, and pickup note capture before booking.
- Fare locked at booking time with Taxiro 7% company commission and 93% rider earning split.
- Exact distance pricing: Rs 7/km normally and Rs 8/km during configured IST peak windows.
- Rider UPI ID and UPI QR image upload in rider account settings.
- UPI/cash payment status flow: pending, awaiting payment, and paid.
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
- Desktop hide/show side panels and mobile pull-down/pull-up ride sheets for stronger app-like map interaction.
- Accidental page zoom, iPhone input-focus zoom prevention, and Leaflet scroll-wheel zoom prevention.
- Compact user booking flow with duplicate-label cleanup, expandable pickup note, low-GPS-accuracy warning, and sticky booking action.
- Compact rider workflow with expandable On-The-Way route setup.
- Improved high-accuracy GPS acquisition with weak-fix rejection, progress feedback, movement filtering, and rider location heartbeats.
- Supabase Realtime publication enabled for live user, rider, admin, chat, code, ride-detail, and tracking updates.
- User/rider/admin dashboards now merge realtime row changes without requiring manual page refresh.
- Ride chat now refreshes on browser reconnect and tab visibility changes.
- GitHub push-protection cleanup completed by removing local MCP credentials from Git tracking.
- Production SEO metadata, sitemap, robots, PWA manifest, app icons, Open Graph image, `llms.txt`, `llms-full.txt`, and `humans.txt`.

## Main Routes

- Landing page: `/`
- Auth: `/auth`
- User app: `/dashboard/user`
- Rider app: `/dashboard/rider`
- Admin dashboard: `/dashboard/admin`
- Ride details: `/rides/[id]`
- Information pages: `/about`, `/help`, `/privacy`, `/rules`

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
- Stripe/payment gateway or online payment processing
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
  - About Taxiro
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
- `supabase/migrations/20260624093000_enable_realtime_publication.sql`
- `supabase/migrations/20260629093000_taxiro_fare_payment_flow.sql`
- `supabase/migrations/20260629113000_accepted_ride_cancellation_fine.sql`
- `supabase/migrations/20260630093000_signal_expiry_and_safety_alerts.sql`
- `supabase/migrations/20260630130000_distance_pricing_and_passenger_details.sql`
- `supabase/migrations/20260630173000_repair_ready_and_cancel_actions.sql`

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
- `safety_alerts`
- `app_notifications`

Important RPC/functions:

- `mark_ride_ready_and_assign`
- `accept_ready_ride`
- `verify_ride_code`
- `complete_ride`
- `cancel_ride`
- `mark_ride_reached_drop`
- `confirm_ride_payment_and_complete`
- `expire_ready_signals`
- `create_safety_alert`
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
NEXT_PUBLIC_SITE_URL=https://taxiro.vercel.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NEXT_PUBLIC_OSRM_BASE_URL=https://router.project-osrm.org
```

## Production SEO, App Icons, And AI Discovery

Implemented production-facing discovery and install assets:

- App icon source: `public/App Icon.jpeg`.
- Generated favicon and app icons:
  - `src/app/favicon.ico`
  - `src/app/icon.png`
  - `src/app/apple-icon.png`
  - `public/icons/taxiro-icon-16.png`
  - `public/icons/taxiro-icon-32.png`
  - `public/icons/taxiro-icon-48.png`
  - `public/icons/taxiro-icon-96.png`
  - `public/icons/taxiro-icon-180.png`
  - `public/icons/taxiro-icon-192.png`
  - `public/icons/taxiro-icon-256.png`
  - `public/icons/taxiro-icon-512.png`
- Social preview image: `public/og/taxiro-og.png`.
- PWA manifest route: `/manifest.webmanifest`.
- Robots route: `/robots.txt`.
- Sitemap route: `/sitemap.xml`.
- AI/LLM discovery files: `/llms.txt` and `/llms-full.txt`.
- Human-readable build info: `/humans.txt`.
- Microsoft tile config: `/browserconfig.xml`.
- Global metadata includes canonical URL, Open Graph, Twitter card, app install metadata, geo tags for Hyderabad/Telangana/India, and JSON-LD structured data for Organization, WebApplication, and Service.

Set `NEXT_PUBLIC_SITE_URL` in Vercel to the final production domain before launch so canonical URLs, sitemap URLs, Open Graph images, and structured data point to the correct host.

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
- Progress report through 12 June: `docs/taxiro-progress-report-2026-06-08-to-2026-06-12.md`
- Progress report through 22 June: `docs/taxiro-progress-report-2026-06-08-to-2026-06-22.md`
- Progress report through 23 June: `docs/taxiro-progress-report-2026-06-08-to-2026-06-23.md`
- Progress report through 24 June: `docs/taxiro-progress-report-2026-06-08-to-2026-06-24.md`
- Progress report through 29 June: `docs/taxiro-progress-report-2026-06-08-to-2026-06-29.md
- Latest full progress report: `docs/taxiro-progress-report-2026-06-08-to-2026-06-30.md`
- Daily update for 22 June: `docs/daily-update-2026-06-22.md`
- Daily update for 23 June: `docs/daily-update-2026-06-23.md`
- Daily update for 24 June: `docs/daily-update-2026-06-24.md`
- Daily update for 29 June: `docs/daily-update-2026-06-29.md
- Latest daily update: `docs/daily-update-2026-06-30.md`
- Manager email for 22 June: `docs/manager-update-email-2026-06-22.md`
- Manager email for 23 June: `docs/manager-update-email-2026-06-23.md`
- Manager email for 24 June: `docs/manager-update-email-2026-06-24.md`
- Manager email for 29 June: `docs/manager-update-email-2026-06-29.md
- Latest manager email: `docs/manager-update-email-2026-06-30.md`

## Development Timeline

Monday - 08 June 2026:

- Project setup.
- Supabase connection.
- Database schema and migrations.
- PostGIS and RLS.
- Auth and role separation.
- Initial user, rider, and admin flows.

Wednesday - 10 June 2026:

- App rename/branding to Taxiro.
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

Wednesday - 24 June 2026:

- Fixed realtime behavior that previously required manual refreshes.
- Enabled Supabase Realtime publication for Taxiro app tables.
- Added replica identity metadata for realtime update/delete payloads.
- Updated user dashboard live ride/code/rider-location updates.
- Updated rider dashboard live ready-job, active-job, availability, and location updates.
- Added admin dashboard realtime updates for operations data.
- Improved ride chat live updates, reconnect handling, and tab-visibility recovery.
- Fixed GitHub push protection issue by removing `.mcp.json` from Git tracking and ignoring it.
- Confirmed `.env.local` remains ignored and Vercel should only receive public frontend env variables.
- Passed TypeScript, focused ESLint, production build, Supabase realtime verification, and Git tracking checks.

Monday - 29 June 2026:

- Completed the public/package rename to Taxiro across the application, documentation, metadata, and user-facing content.
- Added distance-based fare locking and a transparent 7% Taxiro / 93% rider earnings split.
- Added rider UPI ID and QR image settings plus the `rider-upi-qr` Supabase Storage design.
- Added reached-drop, awaiting-payment, payment-confirmed, and ride-completed states for cash and UPI collection.
- Added fare and payment visibility across user, rider, ride-detail, demand, history, and admin views.
- Added the accepted-ride cancellation policy: a Rs 50 fine from the user's 3rd cancellation onward when a rider has accepted.
- Added About, Help and Support, Privacy Policy, and Rules and Regulations pages and linked them from app menus.
- Improved booking search, map selection, rider demand/request cards, and realtime recovery behavior.
- Hardened location detection with accuracy thresholds, weak-fix rejection, progress states, movement filtering, and rider GPS heartbeats.
- Created additive SQL migrations for fare/payment/UPI and cancellation-fine support. Remote Supabase application and live two-account verification remain pending.

Tuesday - 30 June 2026:

- Added timed ready signals with 15, 30, and 60 minute choices plus expiry support.
- Added safety-alert and app-notification foundations for SOS, late-trip, and route-change scenarios.
- Added exact fare rules: Rs 7/km standard and Rs 8/km during morning, evening, and night peak windows.
- Added booking-for selection so users choose whether a ride is for themselves or someone else.
- Added passenger name/phone capture for someone-else bookings and disabled current-device detect for those pickups.
- Added responsive desktop side panels and mobile pull-down/pull-up ride sheets.
- Added realtime ride-detail updates for `/rides/[id]`.
- Added passenger/fare-rate context to ride details, shared ride cards, rider demand cards, map popups, and admin operations.
- Added admin stats for guest bookings and peak-rate rides.
- Added additive Supabase migrations for ready-signal expiry, safety alerts, peak pricing, and passenger details.
- Passed TypeScript, focused ESLint, production build, fare boundary checks, and Git whitespace checks.
- Added production SEO/app-icon/PWA/LLM discovery setup using the app icon from `public/App Icon.jpeg`.

## Verification Status

Latest verification completed on 30 June 2026:

- `npx tsc --noEmit`: passed against the current code.
- Focused ESLint for changed user/rider/admin/ride-detail/map/demand/fare files: passed.
- `npm run build`: passed on Next.js 16.2.7.
- All 12 application routes compiled/generated successfully, including user, rider, admin, policy, auth, and ride-detail routes.
- Earlier Supabase live-tracking and Realtime publication verification passed.
- Fare boundary checks for standard and peak windows: passed.
- `git diff --check`: passed after formatting cleanup.

Remote database status:

- Payment/UPI and accepted-ride cancellation fields/functions are present remotely.
- `20260630093000_signal_expiry_and_safety_alerts.sql` is applied to remote Supabase.
- `20260630130000_distance_pricing_and_passenger_details.sql` is applied to remote Supabase.
- `20260630173000_repair_ready_and_cancel_actions.sql` is applied to align the Ready, expiry, and rider/user cancellation RPCs with the current app.
- Remote verification confirmed ready/fare/passenger columns, safety/notification tables, and required ride-action RPC signatures.

Pending manual QA:

- Full browser/mobile visual QA with authenticated user and rider accounts.
- End-to-end ride test using two real accounts and live location permissions.
- Supabase Realtime verification across two real authenticated browser/device sessions.

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
- Test live rider-to-pickup, rider-to-drop, chat, and status updates on two real devices without page refresh.
- Extend admin operational ride controls beyond search/filter/verification.
- Rotate the exposed Supabase Personal Access Token and deploy with only public Vercel frontend env variables.
- Add loading skeletons, reconnect handling, and stronger network error recovery.

Medium priority:

- Persist notification and location preferences.
- Add a rider daily activity summary.
- Improve demand signals, route relevance, and active-trip refresh reliability.
- Add consistent empty, loading, and retry states.

Future scope:

- Push notifications.
- In-app chat/call masking.
- Integrated payment gateway and automated payment verification.
- Production-grade geocoding/routing provider.
- Native mobile wrapper.
