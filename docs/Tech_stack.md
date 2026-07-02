# Taxiro Technology Stack And Engineering Assessment

**Report date:** 02 July 2026  
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

- **MVP feature completeness:** approximately 75%.
- **Controlled internal pilot readiness:** approximately 65-70%.
- **Unrestricted public production readiness:** approximately 45-50%.
- **Current stage:** between functional MVP and pilot-ready release candidate.

These are engineering estimates, not automated quality scores. Taxiro is advanced in feature breadth and UI, while production readiness still depends on reliability, operations, automated testing, security, compliance, and native-device capabilities.

## Codebase Measurements

Measurements were generated from the repository on 02 July 2026.

### Unique implementation

| Area | Files | Physical lines | Non-blank lines |
|---|---:|---:|---:|
| TypeScript (.ts) | 15 | 1,542 | 1,368 |
| React/TypeScript (.tsx) | 47 | 8,886 | 8,297 |
| Global CSS (.css) | 1 | 995 | 851 |
| Supabase migration history (.sql) | 25 | 3,750 | 3,359 |
| **Unique implementation total** | **88** | **15,173** | **13,875** |

### Additional tracked material

| Area | Files | Physical lines | Non-blank lines |
|---|---:|---:|---:|
| Cumulative Supabase schema snapshot | 1 | 3,295 | 2,950 |
| Existing project documentation | 25 | 3,330 | 2,599 |

The cumulative schema repeats SQL already represented in migration history. Therefore:

- **Recommended unique implementation count:** 15,173 physical lines.
- **Implementation plus cumulative schema:** 18,468 physical lines.
- **Implementation plus schema excluding blank lines:** 16,825 lines.

Generated .next output, node_modules, Git internals, images, icons, and binary assets are excluded.

### Repository inventory

- 10 application pages.
- 3 role-specific dashboards.
- 36 React components.
- 25 additive Supabase migrations.
- 14 application database tables.
- 35 unique PostgreSQL/RPC functions across migration history.
- 2 Supabase Storage buckets.
- 19 public assets.
- 17 routes emitted by the latest successful Next.js build, including metadata and icon routes.

### Largest source files

| File | Physical lines | Responsibility |
|---|---:|---|
| src/app/dashboard/user/page.tsx | 1,951 | Booking, tracking, safety, history, active ride |
| src/app/dashboard/rider/page.tsx | 1,277 | Rider work, demand, GPS, execution, navigation |
| src/app/globals.css | 995 | Responsive UI, map styling, motion, containment |
| src/app/rides/[id]/page.tsx | 471 | Detailed ride lifecycle |
| src/app/dashboard/admin/page.tsx | 421 | Operations, verification, people, ride audit |
| src/components/MapPicker.tsx | 391 | Leaflet maps, routes, demand, rider markers |
| src/app/auth/page.tsx | 360 | Signup, sign-in, validation, onboarding |
| src/components/RiderIdentitySettings.tsx | 291 | Identity, vehicles, UPI, uploads |
| src/components/AppNotificationBell.tsx | 289 | Realtime notification panel and dismissal |

The user and rider dashboards are large enough that decomposition into focused feature components and hooks should be a next-phase engineering task.

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
   - No complete unit, integration, or E2E suite is declared in package.json.

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

### Priority 0: Pilot blockers

1. Apply and verify every migration in production Supabase.
2. Run repeated two-device user/rider ride lifecycles.
3. Test Bike, Auto, and Car matching with verified vehicles.
4. Test session persistence and new-device revocation.
5. Test Realtime reconnect after close, network loss, and sleep.
6. Test denied GPS, weak GPS, stale location, and route changes.
7. Complete RLS/RPC/storage security review.
8. Add structured production error logging.
9. Add database backup and recovery procedures.
10. Add critical authentication and ride-lifecycle E2E tests.

### Priority 1: Real operational capability

1. Build native Android/iOS apps or a native tracking wrapper.
2. Add FCM/APNs push notifications.
3. Add SMS/phone escalation for SOS.
4. Move dispatch and expiry into reliable background jobs.
5. Use production geocoding/routing or self-host OSRM/Nominatim.
6. Integrate payment gateway and webhook verification.
7. Add rider settlement, invoices, refunds, and reconciliation.
8. Add support tickets, incidents, and admin audit logs.
9. Add fraud and fake-location detection.
10. Add service-area, pricing, and supply controls.

### Priority 2: Architecture and quality

1. Split user/rider dashboards into feature components and hooks.
2. Add component and utility unit tests.
3. Add database integration tests for RPC and RLS.
4. Add Playwright E2E tests.
5. Add accessibility testing.
6. Add performance budgets and bundle analysis.
7. Add funnel, matching, cancellation, ETA, and completion analytics.
8. Add production observability.
9. Add CI for build, lint, tests, and migration validation.
10. Separate staging and production environments.

### Priority 3: Product expansion

- Saved places and favourite routes.
- Multiple stops.
- Promo/referral system.
- Wallet and credits.
- Recurring scheduled rides.
- Rider incentives.
- Heat maps and demand forecasting.
- Support chat/calling.
- Better ETA recalculation.
- Trip sharing.
- Localization and accessibility.
- Business accounts.

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
