Subject: Taxiro Development Update - 20 July 2026

Hi Sir,

This update covers the Taxiro work completed today, 20 July 2026.

Today I focused on production reliability, Supabase Preview stability, Admin Health diagnostics, and important app UX fixes around information-page navigation and rider demand signals.

Completed:

- Hardened `/api/health` Supabase readiness probes with a 6-second timeout.
- Added no-store cache behavior for `/api/health` so Admin Health shows fresh deployment and database status.
- Added a structured readiness summary showing passing checks, required failures, missing database objects, missing local migration files, and pilot-ready status.
- Added deployment blockers and migration recovery details inside Admin Health.
- Kept all health diagnostics secret-safe. No Supabase keys, service-role values, cron secrets, or raw sensitive env values are exposed.

Admin control-system work completed:

- Added an Admin Overview control map for Command, Verification, People, Ride Audit, Support, and Health workspaces.
- Upgraded People Control with search, role filters, status filters, account metrics, priority queue, account health chips, and safe suspend/reactivate actions.
- Improved admin panel usability with smoother rounded cards, clearer action hierarchy, and more premium control-room UX.

Supabase Preview fixes completed:

- Fixed the migration-history mismatch by matching local migration filenames to the exact remote Supabase migration versions.
- Split the realtime migration into the two versions already recorded in Supabase.
- Removed hidden UTF-8 BOM bytes from affected SQL migrations after Supabase Preview failed at statement 0.
- Added a local migration validator guard so future BOM-encoded SQL files are caught before push.
- Made the operational foundation migration's RLS policies idempotent using `drop policy if exists` guards, fixing duplicate-policy failures for support tickets, audit logs, service areas, pricing, fraud signals, saved places, ride stops, promos, wallets, incentives, and business account policies.

App UX and rider-demand fixes completed:

- Added Back navigation to About, Help, Support, Privacy, and Rules pages.
- Moved the light/dark theme switch into the app header so it no longer appears at the lower-right corner on information pages.
- Updated rider demand signals to show only matching vehicle demand within about 2 km of the rider's current/live location.
- Added active rider-dashboard expiry refresh so expired ready signals disappear while the rider app is open, instead of waiting only for the daily cron.
- Updated Help/About/Rules copy to explain nearby demand and ready-signal expiry behavior.

Verification completed:

- `npm run db:validate` passed with 28 additive Supabase migrations.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed earlier today with 11 unit tests.
- `npm run build` passed with 24 Next.js app routes.
- `git diff --check` passed.

Current deployment note:

The latest code has been pushed to GitHub. Supabase Preview should now progress beyond the migration-history, BOM parser, and duplicate-policy errors. After deployment, Admin Health should be rechecked in production.

Next planned work:

- Re-run GitHub/Supabase/Vercel checks after the latest push.
- Apply or confirm pending Supabase production migrations.
- Configure real service areas and pricing rules.
- Run two-device user/rider QA for booking, ready signal, matching, tracking, payment, notifications, and admin controls.

Regards,

Thangella G