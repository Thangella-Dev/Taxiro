# Taxiro Daily Development Update - 20 July 2026

Project: **Taxiro**
Date: **20 July 2026**
Focus: **Admin Health, production reliability, and deployment diagnostics**

## Summary

Today I completed a real production-readiness upgrade for Taxiro. The work focused on making the app easier to diagnose after deployment, especially when Supabase migrations, Vercel deployment state, or production database objects are not fully synced.

## Completed Today

- Hardened `/api/health` Supabase probes with a 6-second timeout using `AbortController`.
- Added no-store cache headers to `/api/health` so Admin Health reads fresh deployment and database status.
- Added a health readiness summary with:
  - total checks,
  - passing checks,
  - required failures,
  - missing database objects,
  - missing local migration files,
  - pilot-ready status.
- Added a deployment-blocker list to `/api/health` so admin users can immediately see what must be fixed before production can be treated as pilot-ready.
- Added a local migration manifest to `/api/health` that shows:
  - total local SQL migration count,
  - latest local migration file,
  - required operational migration files,
  - present/missing status for each required file.
- Upgraded Admin Health UI with:
  - Readiness summary card,
  - Deployment blockers card,
  - Migration recovery card.
- Kept the health endpoint secret-safe. It does not return Supabase keys, service role keys, cron secrets, or raw environment values.
- Updated README and Tech Stack documentation with today's real engineering work.

## Verification Completed

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Result:

- TypeScript passed.
- ESLint passed.
- 11 unit tests passed.
- Next.js 16.2.7 production build passed.
- Build generated 24 app routes.

## Current Status

Taxiro now has a stronger production diagnostics layer. Admin users can use Admin Health to identify missing migrations, degraded Supabase checks, local migration file availability, and production readiness from inside the app.

## Next Recommended Work

- Apply pending Supabase migrations in production.
- Re-check Admin Health after deployment.
- Configure real service areas and vehicle pricing rules.
- Run two-device user/rider QA against production.
- Expand authenticated E2E tests for booking, ready signal, rider acceptance, tracking, payment, notifications, and admin verification.

## Additional Admin Control-System Work

After the production health upgrade, I completed another high-impact admin-panel improvement.

Completed:

- Added an Admin Overview control map for fast access to Command, Verification, People, Ride Audit, Support, and Health workspaces.
- Upgraded the People section into an account control center.
- Added profile search by name, phone, role, or profile ID.
- Added role filters for all, user, rider, and admin accounts.
- Added status filters for all, active, and suspended accounts.
- Added user/rider/admin/active/suspended/total account metrics.
- Added a priority queue for suspended accounts and accounts missing phone numbers.
- Added smoother account cards with account health chips and safe suspend/reactivate actions.
- Improved the admin UI with more premium rounded cards, hover lift, and clearer command hierarchy.

Additional verification:

```bash
npm run typecheck
npm run lint
```

## Supabase Preview Migration Repair

Completed after the Admin Health work:

- Investigated the Supabase Preview failure: `Remote migration versions not found in local migrations directory`.
- Read the remote Supabase migration history through the Supabase Management API in read-only mode.
- Found 7 remote migration versions missing from local filenames.
- Renamed five early local migration files to match the exact remote Supabase versions.
- Split the combined realtime migration into the two remote migration versions.
- Re-ran remote-vs-local comparison and confirmed **0 remote versions are missing locally**.
- Re-ran `npm run db:validate`; 28 additive migrations passed.
- Fixed the follow-up Supabase Preview parser failure by removing hidden UTF-8 BOM bytes from affected SQL migrations.
- Upgraded `npm run db:validate` to fail if any future migration includes a UTF-8 BOM.
## Supabase Preview Policy Idempotency Fixes

After the migration-history and BOM fixes, Supabase Preview exposed duplicate-policy replay errors. I fixed those properly instead of handling only one policy at a time.

Completed:

- Added `drop policy if exists` guards before recreating support-ticket RLS policies.
- Expanded the fix to the full operational foundation policy block, including audit logs, service areas, pricing rules, fraud signals, saved places, ride stops, recurring rides, trip shares, promos, wallets, rider incentives, and business account policies.
- Updated `supabase/schema.sql` to match the migration behavior.

## App UX And Demand-Signal Fixes

Completed after the deployment fixes:

- Added a Back button to About, Help, Support, Privacy, and Rules pages.
- Moved light/dark mode switching into the top app header so it no longer floats at the lower-right corner on info pages.
- Changed rider demand visibility to behave more like real ride apps:
  - only matching active vehicle type,
  - only ready or near-future scheduled demand,
  - only within about 2 km of the rider's current/live location,
  - expired ready signals are hidden immediately.
- Added active rider-dashboard expiry refresh so stale ready signals do not remain visible while the rider app is open.
- Updated Help/About/Rules copy to explain 2 km nearby demand and ready-signal expiry behavior.

## Final Verification Completed Today

```bash
npm run db:validate
npm run typecheck
npm run lint
npm run build
git diff --check
```

Result:

- 28 additive Supabase migrations validated.
- TypeScript passed.
- ESLint passed.
- Next.js 16.2.7 production build passed with 24 app routes.
- Git whitespace/diff check passed.
