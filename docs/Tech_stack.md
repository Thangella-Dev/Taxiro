# Taxiro Technology Stack And Engineering Assessment

**Report date:** 07 July 2026  
**Application:** Taxiro  
**Current version:** 0.1.0  
**Product stage:** Advanced full-stack web MVP approaching controlled pilot readiness

## Executive Assessment

Taxiro is no longer a basic prototype or visual-only demo. It is a substantial real-data mobility web application with separate customer, rider, and administrator experiences.

The application supports most of the visible ride lifecycle:

1. Account creation and role separation.
2. Pickup/drop selection and route estimation.
3. Bike, Auto, and Car selection.
4. Ride-now and advance booking.
5. Timed ready signals.
6. Vehicle-aware rider matching.
7. Rider acceptance and foreground GPS.
8. Rider-to-pickup tracking.
9. Private ride-code verification.
10. Destination tracking after pickup.
11. User/rider chat.
12. Cancellation handling.
13. Fare, commission, earnings, and payment confirmation.
14. Ratings, SOS, notifications, rider verification, and admin operations.

Engineering estimate:

- **MVP feature completeness:** approximately 78%.
- **Controlled internal pilot readiness:** approximately 70%.
- **Unrestricted public production readiness:** approximately 50%.
- **Current stage:** between functional MVP and pilot-ready release candidate.

These are engineering estimates, not automated quality scores. Taxiro is advanced in feature breadth and UI, while production readiness still depends on reliability, operations, automated testing, security, compliance, and native-device capabilities.

## Codebase Measurements

Measurements were generated from the repository on 07 July 2026.

### Unique implementation

| Area | Files | Physical lines | Non-blank lines |
|---|---:|---:|---:|
| TypeScript and test tooling (.ts/.mjs) | 32 | 2,241 | 2,001 |
| React/TypeScript (.tsx) | 53 | 9,530 | 8,879 |
| Global CSS (.css) | 1 | 995 | 851 |
| Supabase migration history and schema snapshot (.sql) | 28 | 7,742 | 6,948 |
| CI YAML | 1 | 51 | 47 |
| **Tracked source/config total** | **115** | **20,559** | **18,726** |

The cumulative schema snapshot repeats SQL already represented in migration history and is excluded from the recommended unique implementation count. Generated .next output, node_modules, Git internals, test artifacts, images, icons, and binary assets are also excluded.

### Repository inventory

- 11 application pages.
- 3 role-specific dashboards.
- 41 React components.
- 27 additive Supabase migrations.
- 30 application database tables represented across migration history.
- 40 unique PostgreSQL/RPC functions across migration history.
- 2 Supabase Storage buckets.
- 19 public assets.
- 21 routes emitted by the latest successful Next.js build.
- 11 passing unit tests.
- 14 passing desktop/mobile Playwright and accessibility tests.

### Largest source files

| File | Physical lines | Responsibility |
|---|---:|---|
| src/app/dashboard/user/page.tsx | 1,860 | Booking, tracking, safety, history, active ride |
| src/app/dashboard/rider/page.tsx | 1,278 | Rider work, demand, GPS, execution, navigation |
| src/app/globals.css | 851 | Responsive UI, map styling, motion, containment |
| src/app/rides/[id]/page.tsx | 442 | Detailed ride lifecycle |
| src/app/dashboard/admin/page.tsx | 400+ | Operations, verification, people, support, controls, ride audit |
| src/components/MapPicker.tsx | 371 | Leaflet maps, routes, demand, rider markers |
| src/app/auth/page.tsx | 344 | Signup, sign-in, validation, onboarding |
| src/lib/tracking.ts | 304 | GPS acquisition, filtering, persistence |
| src/components/AppNotificationBell.tsx | 270 | Realtime notification inbox and dismissal |
| src/components/RiderIdentitySettings.tsx | 265 | Identity, vehicles, UPI, uploads |
## Complete Technology Stack

### Frontend

- **Next.js 16.2.7**
  - App Router.
  - Static and dynamic routes.
  - Turbopack.
  - Metadata routes.
  - Vercel-compatible output.
- **React 19.2.4**
- **React DOM 19.2.4**
- **TypeScript 5**
  - Strict mode.
  - Shared domain/database types.
  - Path alias @/*.
- **Tailwind CSS 4**
- **@tailwindcss/postcss**
- Local shadcn-style primitives:
  - Button.
  - Card.
  - Input.
  - Label.
  - Badge.
  - Tabs.
- **Lucide React 1.17.0**
- **class-variance-authority 0.7.1**
- **clsx 2.1.1**
- **tailwind-merge 3.6.0**
- Geist Sans and Geist Mono through next/font.
- Custom responsive and premium motion system.
- Reduced-motion accessibility support.
- Safe-area support for modern phones.
- Mobile bottom sheets and desktop collapsible side panels.

### Maps, routing, and location

- **Leaflet 1.9.4**
- **React Leaflet 5.0.0**
- **OpenStreetMap** map tiles.
- **Nominatim** search and reverse geocoding.
- **OSRM** route path, distance, and ETA.
- Browser Geolocation API:
  - Permission-aware requests.
  - High-accuracy fixes.
  - Accuracy, heading, and speed.
  - Foreground location watching.
  - Manual map fallback.
- PostGIS distance calculations.
- Phase-aware rider-to-pickup and rider-to-drop routing.
- Installed PWA geolocation hardening:
  - Production Permissions-Policy permits geolocation from the Taxiro origin.
  - User-triggered current-position requests work in standalone home-screen mode.
  - Fresh-position fallback avoids stale cached coordinates.
  - Installed-app permission recovery guidance.

### Backend and database

- **Supabase JavaScript client 2.107.0**
- **Supabase Auth**
  - Email/password authentication.
  - Persistent sessions and refresh.
  - Role-aware profiles.
  - Other-session revocation after a new login.
- **Supabase PostgreSQL**
- **PostGIS**
- **Supabase Realtime**
- **Supabase Storage**
- PostgreSQL functions/RPCs for authoritative ride transitions.
- Row Level Security for role and ownership access.

### Database tables

1. profiles
2. ride_requests
3. rider_locations
4. rider_routes
5. ride_status_events
6. ride_confirmation_codes
7. ride_chat_messages
8. ride_ratings
9. rider_profiles
10. rider_vehicles
11. safety_alerts
12. app_notifications
13. admin_broadcasts
14. account_sessions

### Storage buckets

- rider-verification: private rider identity photos.
- rider-upi-qr: rider payment QR images.

### Database capabilities

- User/rider/admin role helpers.
- Nearest-rider and vehicle-aware matching.
- Verified active-vehicle enforcement.
- Timed ready-signal publication and expiry.
- Ready-ride acceptance.
- Private ride-code creation and verification.
- Ride cancellation and status events.
- Drop-reached and payment-confirmed completion.
- Rider availability and assignment release.
- Emergency-contact matching.
- SOS, late-trip, and route-change alerts.
- Admin broadcasts and account controls.
- Privacy-safe approximate nearby-rider preview.
- Realtime publication configuration.

### Validation and identity

- Signup and sign-in validation.
- User/rider role separation.
- Profile validation.
- Phone normalization.
- Passenger details validation.
- Driving licence validation.
- Vehicle registration validation.
- UPI validation.
- Rider live photo capture.
- Verified-vehicle-only switching.
- Admin identity and vehicle approval.

### Fare and payment model

- Distance-based fares.
- Standard rate: Rs 7/km.
- Peak rate: Rs 8/km.
- Morning, evening, and night peak windows.
- Bike base pricing.
- Auto additional Rs 1/km.
- Car additional Rs 2/km.
- 7% Taxiro commission.
- 93% rider earning.
- Cash and UPI preference.
- Rider UPI ID and QR.
- Reached-drop and payment-confirmation states.
- No integrated payment gateway yet.

### Realtime communication and safety

- User/rider ride chat.
- Realtime in-app notifications.
- Swipe/tap notification dismissal.
- Admin broadcasts.
- Emergency-contact matching by normalized phone.
- SOS safety alerts.
- Delayed-trip and route-change foundations.
- Admin safety acknowledgement and resolution.
- Foreground live tracking.
- No external SMS, WhatsApp, native push, or emergency-service integration yet.

### SEO, PWA, and discovery

- Next.js Metadata API.
- Canonical URL.
- Open Graph and Twitter metadata.
- JSON-LD structured data.
- Hyderabad/India geo metadata.
- Sitemap and robots.
- Web app manifest.
- Favicon and responsive icons.
- Apple web-app metadata.
- Microsoft browser configuration.
- llms.txt.
- llms-full.txt.
- humans.txt.

Taxiro has PWA metadata and installable assets, but no complete offline service-worker strategy yet.

### Development and deployment

- npm run dev.
- npm run build.
- npm run start.
- npm run lint.
- ESLint 9.
- eslint-config-next 16.2.7.
- Next.js production build checks.
- Vercel deployment target.
- Supabase hosted backend.
- Environment-based configuration.

### Environment variables

- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_NOMINATIM_BASE_URL
- NEXT_PUBLIC_OSRM_BASE_URL

A Supabase service-role key must never be exposed through frontend or NEXT_PUBLIC variables.

## Implemented Product Areas

### Customer application

- Account and profile management.
- Bike, Auto, and Car booking.
- Ride now and advance booking.
- Booking for self or another passenger.
- Pickup GPS, search, and map selection.
- Drop search and map selection.
- Route, distance, ETA, fare, payment, and rider note.
- Timed 15/30/60 minute ready signals.
- Nearby active-rider preview.
- Rider assignment details.
- Live rider tracking.
- Pickup and destination route phases.
- Private ride confirmation code.
- Chat, cancellation, SOS, history, payment, and rating.

### Rider application

- Rider onboarding and live identity capture.
- Bike, Auto, and Car registration.
- Admin verification and vehicle switching.
- Online/offline state and foreground GPS.
- Ready jobs and advance demand.
- On-The-Way routes.
- Vehicle-aware matching.
- Accept and pre-code cancellation.
- Pickup navigation and code verification.
- Destination navigation.
- Chat.
- Fare, company share, rider earning.
- Drop reached, payment confirmation, completion.
- UPI profile and ride history.

### Administrator application

- Responsive section-based command center.
- Overview metrics and financial summaries.
- Ride operations, search, and filtering.
- User/rider account controls.
- Account suspension/reactivation.
- Identity and per-vehicle verification.
- Notification broadcasting.
- SOS and safety command.
- Realtime operational updates.

## Current Strengths

- Broad end-to-end product flow.
- Real Supabase records rather than duplicate demo data.
- Strong role separation.
- Additive migration history.
- Vehicle-aware matching.
- Map-first UX.
- Foreground tracking and phase-aware routing.
- Private ride-code workflow.
- Rider verification.
- Realtime notifications, chat, and admin data.
- Responsive mobile and desktop layouts.
- Strong feature breadth for an MVP.
- Passing TypeScript, lint, and production build checks.

## Current Risks And Limitations

1. **No native background GPS**
   - Browser tracking depends on permission, HTTPS, visibility, and OS browser behavior.
   - Real operations eventually need native Android/iOS tracking.

2. **No external push system**
   - In-app updates are insufficient when the app is closed.
   - Rider jobs and SOS require push/SMS escalation.

3. **Public Nominatim and OSRM**
   - Suitable for MVP testing, not guaranteed production SLA or capacity.

4. **No integrated payment gateway**
   - Payment is manually confirmed.
   - Refunds, settlements, reconciliation, and disputes are not automated.

5. **Limited automated testing**
   - TypeScript, ESLint, and build checks exist.
   - Unit, public browser, accessibility, migration, build, lint, type, and performance checks exist; authenticated full ride lifecycle E2E coverage remains incomplete.

6. **Incomplete production monitoring**
   - Error tracking, tracing, uptime alerts, and business analytics are required.

7. **Security needs formal review**
   - RLS, RPC permissions, rate limiting, abuse controls, storage, and admin authorization need an adversarial audit.

8. **Legal/compliance work remains**
   - Current policies are MVP language.
   - Final privacy, consent, insurance, regulations, retention, grievance, and safety procedures need professional review.

9. **Large dashboard modules**
   - User and rider dashboards need decomposition before major expansion.

10. **Support and fraud operations**
   - Refund, dispute, fake-GPS, document fraud, incident response, and customer support workflows are immature.

## Recommended Next Work

Status key: Complete means implemented and locally verified. Partial means a foundation exists but field, provider, remote database, or authenticated coverage remains.

### Priority 0: Pilot blockers

1. **Partial:** Apply and verify every migration in production Supabase. The July 3 operational foundation and July 7 operational enforcement migrations are still pending remote application unless applied manually.
2. **Pending:** Run at least ten repeated two-device user/rider ride lifecycles.
3. **Pending:** Field-test Bike, Auto, and Car matching with separate verified vehicles.
4. **Pending:** Field-test session persistence and new-device revocation.
5. **Pending:** Field-test Realtime reconnect after close, network loss, and sleep.
6. **Pending:** Field-test denied GPS, weak GPS, stale location, movement, and route changes.
7. **Partial:** RLS-first operational migration and security runbook are present; formal adversarial RPC/storage review remains.
8. **Complete:** Structured telemetry, browser errors, Web Vitals, health endpoint, and recovery UI.
9. **Partial:** Backup/recovery procedures are documented; managed backups/PITR and restoration drills must be activated.
10. **Partial:** Unit and public desktop/mobile E2E checks exist; authenticated ride-lifecycle and RLS integration tests remain.

### Priority 1: Real operational capability

1. **External:** Native Android/iOS or native tracking wrapper requires a mobile architecture and store credentials.
2. **External:** FCM/APNs requires provider projects, certificates, device tokens, consent, and delivery operations.
3. **External:** SMS/phone SOS escalation requires an India-compliant provider and approved templates.
4. **Partial:** Ready-signal expiry has a protected scheduled endpoint and Vercel Cron; dispatch retries and durable queues remain.
5. **External:** Production geocoding/routing requires a contracted provider or self-hosted OSRM/Nominatim.
6. **External:** Payment gateway requires merchant KYC, server webhooks, idempotency, and reconciliation.
7. **Partial:** Wallet, transaction, incentive, and pricing foundations exist; settlement, invoice, refund, and reconciliation execution remains.
8. **Complete foundation:** Tracked support cases, admin support operations, and admin audit writes are implemented.
9. **Partial:** Fraud/fake-location signal storage, rider GPS jump reporting, and admin review actions exist; automated scoring and enforcement remain.
10. **Partial:** Service-area/pricing models, admin creation UI, and booking enforcement exist locally; remote migration application, real area configuration, and field QA remain.

### Priority 2: Architecture and quality

1. **Pending:** Split the largest user/rider dashboard modules into feature components and hooks.
2. **Partial:** Fare and validation unit tests exist; component and tracking tests should expand.
3. **Pending:** Add database integration tests for RPC and RLS.
4. **Complete foundation:** Playwright desktop/mobile smoke tests are configured and passing.
5. **Complete foundation:** Axe serious/critical accessibility checks are passing for public routes.
6. **Complete foundation:** Production JavaScript budgets pass; route-level bundle analysis remains useful.
7. **Pending:** Add persisted funnel, matching, cancellation, ETA, and completion analytics.
8. **Partial:** Structured observability exists; external alerting and tracing remain.
9. **Complete:** CI validates migrations, types, lint, unit tests, build, performance, browser, and accessibility.
10. **Partial:** Staging-first procedures and Supabase local config exist; separate cloud staging resources must be provisioned.

### Priority 3: Product expansion

Database foundations now exist for saved places, multiple stops, promos, wallets, recurring rides, rider incentives, trip sharing, and business accounts. These are not complete user-facing features until their workflows, admin controls, and tests are implemented.

Still pending:

- Saved-place and favourite-route user UI.
- Multiple-stop booking and routing UI.
- Promo/referral redemption workflow.
- Wallet funding, refund, and ledger operations.
- Recurring ride generation worker and controls.
- Rider incentive progress and payout UI.
- Heat maps and demand forecasting.
- Support calling/chat escalation.
- Better continuous ETA recalculation.
- Secure public trip-sharing page.
- Localization and broader accessibility review.
- Business account billing and member administration.
## Release Definition

Taxiro should be called **pilot-ready** after:

- All migrations are verified remotely.
- At least ten complete two-device test rides pass without refresh.
- Session persistence works across browser restart.
- Ready signals and vehicle matching pass repeatedly.
- Tracking switches correctly between pickup and drop phases.
- Chat, code, cancellation, payment, rating, and notifications pass.
- SOS reaches both linked contact and admin.
- RLS/security review passes.
- Monitoring and backups are active.
- Critical E2E tests pass.

Taxiro should be called **public production-ready** only after native/background tracking, push notifications, production routing, payment operations, compliance, support, monitoring, and incident response are implemented.

## Final Opinion

Taxiro is an ambitious and technically meaningful application. Its strongest achievement is that customer, rider, and admin flows are connected through real shared database state rather than isolated screens.

The application is advanced for an MVP and demonstrates substantial full-stack engineering. The next major move should not be another broad feature expansion. The best next phase is to stabilize the complete ride lifecycle, decompose the largest modules, automate testing, and build production operations around the existing product.

In short:

- **Not a basic prototype.**
- **A strong advanced MVP.**
- **Close to controlled pilot testing.**
- **Not yet safe for unrestricted public operations.**
- **Next focus: reliability, native capability, operations, security, and compliance.**

## July 2, 2026 Reliability And Data Integrity Update

### Customer and mobile behavior

- User My Rides now opens during assigned/started trips instead of being overridden by the active-trip panel.
- The responsive bottom sheet remounts open when changing between My Rides and the live trip.
- Active trips provide a Back to live trip action from history.
- The active-rider tracking status respects iPhone safe-area and header-control spacing.

### Installed web-app location

- next.config.js emits Permissions-Policy: geolocation=(self).
- Location is requested directly from a user tap instead of trusting a potentially stale permission-state query.
- Low-accuracy fallback requests no longer accept a one-minute cached location.
- Installed Chrome/Safari mode receives actionable OS/browser permission guidance.
- Manual location search and map pinning remain available.

### Demand and rider reputation

- Leaflet demand markers include permanent Ready demand and Advance demand labels.
- Vehicle-specific assigned-rider markers remain Bike, Auto, and Car aware.
- Migration 20260702153000_real_rider_reputation_stats.sql derives rider statistics from real data.
- Completed-rides totals come from completed ride_requests.
- Average rating comes from ride_ratings.
- New riders with no submitted rating display New rider instead of a synthetic 5.0 score.
- Database triggers keep both summaries synchronized after ride or rating changes.

### Verified live state

- The migration is applied to the connected Supabase project.
- 5 completed rides are derived for the current rider profile.
- 0 completed-count mismatches exist.
- No rating is shown because no ride rating has been submitted.
- Ride and rating synchronization triggers are active.

### Verification

- TypeScript passed.
- Focused ESLint passed.
- Git diff validation passed.
- Next.js 16.2.7 production build passed with all 17 routes.
- Production HTTP response, geolocation header, and standalone PWA manifest checks passed.
## July 3, 2026 Production Readiness And Operations Update

- Added structured telemetry, Web Vitals, browser error reporting, health checks, and route recovery.
- Added Vitest, Playwright, Axe accessibility checks, migration validation, performance budgets, and GitHub Actions CI.
- Added tracked support cases for users/riders and an admin support queue with audit logging.
- Added the additive operational/product migration covering service areas, pricing, fraud signals, saved places, stops, recurring rides, sharing, promos, wallets, incentives, and business accounts.
- Added a protected ready-signal expiry endpoint and five-minute Vercel Cron configuration.
- Added accessible names to all interactive Leaflet markers.
- Added production migration, backup/recovery, security, incident response, provider, and two-device pilot runbooks.
- Current implementation footprint: 105 source/migration/test/CI files and 16,927 lines across TypeScript, JavaScript, SQL, and CI YAML.
- Verification passes: 26 migrations, TypeScript, ESLint, 7 unit tests, production build, 2.26 MB JavaScript budget, and 14 desktop/mobile browser/accessibility tests.
- The July 3 migration remains local until applied to staging and production Supabase.
- Added a compatible PostCSS 8.5.16 dependency override; the production dependency audit reports zero vulnerabilities.

## July 7, 2026 Operational Controls Update

### Implemented today

- Added `src/lib/operations.ts` for service-area matching, configured fare calculation, distance calculation, and suspicious GPS jump assessment.
- Added optional service-area enforcement in the user booking flow.
- Added configured pricing support using `service_areas` and `pricing_rules`.
- Added `service_area_id` and `pricing_rule_id` support on `ride_requests` types and booking inserts.
- Added configurable commission support in `calculateFareBreakdown` while preserving the default 7% Taxiro commission.
- Added `AdminOperationalControls` for service area creation, pricing rule creation, fare split preview, and fraud-signal review.
- Added rider GPS jump anomaly reporting from foreground tracking through `record_location_anomaly`.
- Added additive migration `20260706100000_operational_enforcement_and_fraud.sql`.
- Added unit tests for service-area matching, configured fare, and location anomaly behavior.

### Verification

- `npm run db:validate`: 27 additive migrations passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: 3 files and 11 tests passed.
- `npm run build`: passed on Next.js 16.2.7 with 21 app routes.
- `npm run perf:budget`: passed with 34 chunks, 2,278,886 total JavaScript bytes, and 355,987-byte largest chunk.
- `npm audit --omit=dev`: zero vulnerabilities.

### Updated readiness opinion

Taxiro now has a stronger operations layer: service areas, configurable pricing, admin controls, and fraud-review foundations. It is closer to a controlled pilot, but still needs remote migration application, real operating-zone configuration, authenticated two-device field testing, formal security/RLS review, external push/SMS/payment providers, and native/background tracking before unrestricted public production.

