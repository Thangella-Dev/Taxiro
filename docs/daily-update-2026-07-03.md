# Taxiro Daily Update - 03 July 2026

## Summary

Today focused on moving Taxiro from feature-heavy MVP work toward controlled pilot readiness. The work added production telemetry, automated quality gates, operational data models, tracked support workflows, scheduled ready-signal expiry, accessibility fixes, and release/backup/security procedures.

## Completed Work

### Production telemetry and recovery

- Added structured client telemetry with token redaction.
- Added browser error and unhandled-promise reporting.
- Added Core Web Vitals reporting.
- Added /api/telemetry for structured Vercel runtime logs.
- Added /api/health with deployment version and configuration status.
- Added the application error boundary with a user-facing retry state.

### Automated quality and CI

- Added Vitest with unit tests for standard/peak Bike, Auto, and Car fares, 7% commission, cancellation fines, profile validation, phone normalization, and vehicle registration validation.
- Added Playwright desktop and mobile projects.
- Added Axe accessibility checks for landing, authentication, About, Help, Privacy, and Rules pages.
- Added Supabase migration filename/destructive-operation validation.
- Added a production JavaScript performance budget.
- Added GitHub Actions jobs for migration, type, lint, unit, build, performance, browser, and accessibility checks.
- Added local Supabase project configuration.

### Accessibility fixes

- Added accessible names to Ready demand, Advance demand, pickup, destination, and rider Leaflet markers.
- Corrected the mobile Playwright project so iPhone-sized testing uses the available Chromium/Edge engine.
- Re-ran all browser checks successfully.

### Support and administration

- Added a tracked /support page for account, ride, payment, safety, rider, technical, and other cases.
- Added support case history and resolution visibility for signed-in users.
- Added an Admin Support workspace with open, urgent, and resolved counts.
- Added admin assignment, investigating, waiting-user, and resolution actions.
- Added admin audit-log writes for support case status changes.
- Connected support ticket changes to Supabase Realtime.

### Operational and product database foundation

Created additive migration 20260703110000_operational_and_product_foundation.sql with RLS for:

- Support tickets and admin audit logs.
- Service areas and configurable pricing rules.
- Fraud/fake-location signals.
- Saved places.
- Up to five ride stops.
- Recurring ride templates.
- Trip sharing.
- Promo codes and redemptions.
- Wallets and wallet transactions.
- Rider incentives.
- Business accounts and memberships.

The migration was validated locally but has not been applied to the remote Supabase project yet.

### Reliable ready-signal expiry

- Added server-only /api/jobs/expire-ready-signals.
- Added a Vercel Cron schedule running every five minutes.
- Protected the job with CRON_SECRET.
- Kept SUPABASE_SERVICE_ROLE_KEY server-only.
- Added the required variables to .env.example.

### Production procedures

- Added production readiness, backup/recovery, security, incident response, and migration procedures.
- Added a two-device pilot QA matrix.
- Added external provider gates for native mobile, FCM/APNs, SMS/voice, payment gateway, and production mapping.
- Documented staging-first migration and release practices.

## Verification

- npm run db:validate: passed for 26 additive migrations.
- npm run typecheck: passed.
- npm run lint: passed.
- npm run test: 2 files and 7 tests passed.
- npm run build: passed on Next.js 16.2.7.
- npm run perf:budget: passed.
- Production JavaScript: 34 chunks, 2,264,859 total bytes, largest chunk 355,987 bytes.
- npm run test:e2e: 14 desktop/mobile browser and accessibility checks passed.
- New routes compiled: /api/health, /api/telemetry, /api/jobs/expire-ready-signals, and /support.

## Deployment Actions Required

1. Apply supabase/migrations/20260703110000_operational_and_product_foundation.sql to staging, test it, then apply it to production.
2. Configure SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET as server-only Vercel environment variables.
3. Confirm the Vercel plan supports the five-minute cron schedule.
4. Run authenticated two-device Bike, Auto, and Car lifecycle tests.
5. Enable and test managed database backups/PITR.
6. Keep native push, SMS, payment, and production routing marked incomplete until provider accounts and credentials exist.
- Resolved the nested PostCSS advisory with a compatible 8.5.16 override; production npm audit now reports zero vulnerabilities.
